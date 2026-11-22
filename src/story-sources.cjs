const { clip, dialogue, unique } = require('./domain.cjs');

function cacheMemoryBlocks(value) {
    if (typeof value !== 'string') return [];
    return unique(Array.from(value.matchAll(/<CACHE_MEMORY>\s*([^]*?)\s*<\/CACHE_MEMORY>/gi), match => {
        if (match[1].length > 40000 || /<\/?CACHE_MEMORY>/i.test(match[1])) return '';
        return match[1].replace(/^冻结块按提交顺序排列。后续有证据的事实更新优先；旧记录保留历史意义，已解决事项不要恢复为未解决。\s*/, '').trim();
    }));
}

function savedSummary(chat) {
    for (let floor = chat.length - 1; floor >= 0; floor--) {
        const row = chat[floor];
        if (dialogue(row) && typeof row.extra?.memory === 'string' && row.extra.memory.trim()) return { floor, text: row.extra.memory };
    }
    return null;
}

function cacheSummaries(context, chat) {
    const records = context.chatMetadata?.cache_memory?.summaries;
    if (!records || typeof records !== 'object') return [];
    const result = [];
    for (const record of Object.values(records)) {
        if (!['frozen', 'manual-edited'].includes(record?.status) || !Number.isInteger(record.messageIndex) || !record.sourceFingerprint) continue;
        const row = chat[record.messageIndex];
        if (!dialogue(row) || row.is_user || !row.mes) continue;
        const identity = [row.name ?? '', row.send_date ?? '', row.gen_started ?? '', row.extra?.gen_id ?? ''];
        if (!identity.slice(1).some(Boolean)) identity.push(row.mes);
        const id = `message-${fingerprint(identity.join('\u001f'))}`;
        if (record.messageId !== id || record.sourceFingerprint !== fingerprint([id, row.swipe_id ?? 0, row.mes].join('\u001f'))) continue;
        const text = [record.title, record.characters && `人物：${record.characters}`, record.storyTime && `时间：${record.storyTime}`,
            record.location && `地点：${record.location}`, typeof record.event === 'string' && record.event].filter(Boolean).join('\n');
        if (text && typeof record.event === 'string' && record.event.trim()) result.push({ floor: record.messageIndex, text });
    }
    return result.sort((left, right) => left.floor - right.floor).slice(-6);
}

function fingerprint(value) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index++) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
    return (hash >>> 0).toString(36);
}

function loreType(entry) {
    if (entry.comment === 'IM丨线上规则' || /^\s*<线上消息>/.test(entry.content)) return 'im';
    if (entry.comment === 'IM丨表情包' || /^\s*【表情库存】/.test(entry.content)) return 'stickers';
    if (entry.comment === '线上丨社交美化' || /^\s*<社交动态>/.test(entry.content)) return 'social';
    if (/(?:摘要|总结|剧情记忆|历史记忆|summary|checkpoint)/i.test(entry.comment ?? '') || cacheMemoryBlocks(entry.content).length) return 'summary';
    return 'lore';
}

function loreContent(entry, type, { post, sticker, coversChat, coversSocial }) {
    if (type === 'social') {
        return post ? entry.content.split(/\r?\n/).filter(line => /^2\./.test(line) || (!coversSocial && /^3\./.test(line))).map(line => line.replace(/^\d+\.\s*/, '')).join('\n') : '';
    }
    if (post && (type === 'im' || type === 'stickers')) return '';
    if (type === 'stickers') {
        const inventory = entry.content.match(/可选名称\s*[:：]\s*([^\n]+)/)?.[1];
        return sticker && inventory ? `只可使用库存中已有的表情名称：${inventory.replace(/https?:\/\/[^\s、]+/gi, '')}` : '';
    }
    if (type === 'im') {
        if (coversChat) return '';
        return entry.content.split(/\r?\n/).find(line => /^9\.\s*聊天/.test(line))?.replace(/^9\.\s*/, '') ?? '';
    }
    return entry.content;
}

function readOnlyLore(entries, settings, { context, rows, taskText, scanFields, render, parseRegex, observed = [], trigger = 'normal' }) {
    const avatar = context.characters?.[context.characterId]?.avatar;
    const tagIds = context.tagMap?.[avatar];
    const result = [...observed];
    const observedKeys = new Set(observed.map(entry => JSON.stringify([entry.world, entry.uid])));
    const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    for (const entry of entries) {
        if (observedKeys.has(JSON.stringify([entry.world, entry.uid]))) continue;
        if (entry.disable || !entry.content || entry.decorators?.includes('@@dont_activate') || (entry.triggers?.length && !entry.triggers.includes(trigger))) continue;
        const filter = entry.characterFilter;
        if (filter?.names?.length && (!avatar || filter.names.includes(avatar.replace(/\.[^.]+$/, '')) === !!filter.isExclude)) continue;
        if (filter?.tags?.length && (!Array.isArray(tagIds) || filter.tags.some(tag => tagIds.includes(tag)) === !!filter.isExclude)) continue;
        const type = loreType(entry);
        if (entry.delay || entry.delayUntilRecursion || entry.group || entry.sticky || entry.cooldown || (entry.useProbability && entry.probability < 100)) continue;
        if (entry.constant || entry.decorators?.includes('@@activate')) { result.push(entry); continue; }
        const depth = Math.max(0, entry.scanDepth ?? settings.world_info_depth ?? 2);
        const task = type === 'im' ? taskText.im : type === 'social' ? taskText.social : type === 'stickers' ? taskText.stickers : taskText.regular;
        const text = [task, ...rows.slice(0, depth), ...Object.entries(scanFields).filter(([key]) => entry[key]).map(([, value]) => value)].filter(Boolean).join('\n');
        const matches = raw => {
            const key = render(raw).trim();
            if (!key) return false;
            const regex = parseRegex?.(key);
            if (regex) return regex.test(text);
            const flags = (entry.caseSensitive ?? settings.world_info_case_sensitive) ? '' : 'i';
            return (entry.matchWholeWords ?? settings.world_info_match_whole_words) && !/\s/u.test(key)
                ? new RegExp(`(?:^|\\W)${escape(key)}(?:$|\\W)`, flags).test(text)
                : new RegExp(escape(key), flags).test(text);
        };
        if (!entry.key?.some(matches)) continue;
        const secondary = entry.keysecondary ?? [];
        if (entry.selective && secondary.length) {
            const hits = secondary.filter(matches).length;
            if (![hits > 0, hits < secondary.length, hits === 0, hits === secondary.length][entry.selectiveLogic ?? 0]) continue;
        }
        result.push(entry);
    }
    return result;
}

function withoutArtwork(value) {
    return String(value ?? '').replace(/<(svg|style|script)\b[^>]*>[^]*?<\/\1>/gi, '')
        .replace(/!\[[^\]]*\]\([^\n)]*\)|<img\b[^>]*>/gi, '')
        .replace(/\bhttps?:\/\/[^\s<>"'、，]+?\.(?:png|jpe?g|webp|gif|svg)(?:[?#][^\s<>"'、，)]*)?(?=[\s<>"'、，)]|$)/gi, '');
}

function memoryText(value) {
    return clip(withoutArtwork(value), 40000);
}

module.exports = { cacheMemoryBlocks, savedSummary, cacheSummaries, loreType, loreContent, readOnlyLore, withoutArtwork, memoryText };
