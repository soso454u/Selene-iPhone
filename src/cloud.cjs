const { digest } = require('./domain.cjs');
const { fingerprint } = require('./resources.cjs');
const { backupState, stateHashes, mergeBackupData } = require('./portable.cjs');
const { tavernApiUrl, isHtmlResponse } = require('./host.cjs');

const FIELD = 'tavern_pocket_v1';
function mergeEvents(local, remote) {
    const merged = new Map(remote.map(row => [row.id, row]));
    for (const row of local) {
        const previous = merged.get(row.id);
        if (!previous || (row.revision ?? 1) > (previous.revision ?? 1) || ((row.revision ?? 1) === (previous.revision ?? 1) && row.deleted && !previous.deleted)) merged.set(row.id, row);
        else if (fingerprint({ ...row, scope: '' }) !== fingerprint({ ...previous, scope: '' }) && (row.revision ?? 1) === (previous.revision ?? 1)) {
            merged.set(`${row.id}:conflict`, { ...row, id: `conflict:${digest(JSON.stringify(row))}`, sync: false, conflictOf: row.id });
        }
    }
    return [...merged.values()];
}

class Cloud {
    constructor(host, ledger, portable = {}) { Object.assign(this, { host, ledger, portable }); this.status = '尚未保存'; }
    async backup(session) {
        const phone = await this.portable.capture?.(session) || {};
        return this.ledger.backup(session.scope, session.trail, session.manual, session.groups, phone);
    }
    async restore(backup, session, preferBackup = false) {
        if (!session.valid()) throw new Error('聊天已切换，未恢复。');
        this.applying = true;
        try {
            const count = await this.ledger.restore(backup, session.scope, session.manual, session.groups, preferBackup);
            if (session.valid()) await this.portable.apply?.(backup.phone, session);
            return count;
        } finally { this.applying = false; }
    }
    async clear(session) {
        if (this.busy) throw new Error('云端操作正在进行，请稍后清空。');
        if (session.context.groupId) { this.status = '已清空本机数据（群聊不支持云端备份）'; return; }
        this.busy = true;
        try {
            const remote = await this.read(session);
            if (!session.valid()) throw new Error('聊天已切换，未清空。');
            if (!this.storyMatches) throw new Error('服务器聊天与本设备不同，请先重新载入或保存正文；未清空数据。');
            const context = session.context;
            const previous = context.chatMetadata?.[FIELD];
            if (remote || previous) {
                if (!context.chatMetadata || typeof context.saveChat !== 'function') throw new Error('当前酒馆未提供聊天保存能力，未清空数据。');
                delete context.chatMetadata[FIELD];
                try {
                    await context.saveChat();
                    const saved = await this.read(session);
                    if (saved) throw new Error('云端备份清空未通过服务器回读验证，未清空本机数据。');
                } catch (error) { if (previous !== undefined) context.chatMetadata[FIELD] = previous; throw error; }
            }
            this.status = '手机云端备份已清空';
        } finally { this.busy = false; }
    }
    async read(session) {
        const context = session.context;
        if (context.groupId) throw new Error('群聊云端元数据保存尚未适配；可使用本地账本导出恢复。');
        const file = String(context.getCurrentChatId()).replace(/\.jsonl$/, '');
        const response = await this.host.fetch(tavernApiUrl(this.host, 'chats/get'), {
            method: 'POST', mode: 'same-origin', headers: context.getRequestHeaders(), body: JSON.stringify({ avatar_url: context.characters[context.characterId].avatar, file_name: file }),
        });
        if (!response.ok) throw new Error(`云端回读失败 HTTP ${response.status}`);
        const text = await response.text();
        let rows;
        try { rows = JSON.parse(text.trim()); }
        catch { throw new Error(isHtmlResponse(response, text) ? '酒馆聊天接口返回了网页，请刷新酒馆页面后重试。' : '酒馆聊天接口返回的数据无法读取。'); }
        if (!Array.isArray(rows)) throw new Error('服务器尚无可验证的聊天文件，请先在酒馆保存一次聊天。');
        const story = values => fingerprint(values.map(row => [row.name, row.is_user, row.mes, row.swipe_id ?? 0]));
        this.storyMatches = story(rows.slice(1)) === story(session.chat);
        return rows[0]?.chat_metadata?.[FIELD];
    }
    async sync(session, restore = false) {
        if (this.busy) throw new Error('云端操作正在进行。');
        this.busy = true;
        try {
            const remote = await this.read(session);
            if (!session.valid()) throw new Error('聊天已切换，未同步。');
            if (!restore && !this.storyMatches) throw new Error('服务器聊天与本设备不同，请先在酒馆重新载入或保存正文；未覆盖远端聊天。');
            const revision = this.portable.revision?.();
            const local = await this.backup(session);
            if (remote?.backup && JSON.stringify(remote.backup.chat) !== JSON.stringify(local.chat)) throw new Error('云端记录不属于当前角色和聊天。');
            const base = await this.ledger.readMeta?.(`${session.scope}:cloud-state`) || {};
            const backup = { ...mergeBackupData(local, remote?.backup, base, restore), events: mergeEvents(local.events, this.ledger.cleanEvents ? this.ledger.cleanEvents(remote?.backup?.events ?? [], session.scope) : remote?.backup?.events ?? []) };
            if (restore) {
                if (!remote?.backup) throw new Error('当前聊天尚无手机云端备份。');
                await this.restore(backup, session, true);
                await this.ledger.saveMeta?.(`${session.scope}:cloud-state`, stateHashes(backupState(backup)));
                this.status = '已恢复聊天、各平台、相册、设置与提示词（API 保持本机）'; return;
            }
            const bytes = new TextEncoder().encode(JSON.stringify(backup)).length;
            if (bytes > 64 * 1024 * 1024) throw new Error('完整手机备份超过 64 MiB，请先导出归档或减少相册体积；未截断数据、未覆盖云端。');
            if (typeof session.context.saveChat !== 'function') throw new Error('当前酒馆未提供聊天保存能力。');
            const envelope = { backup, updated: new Date().toISOString(), signature: digest(JSON.stringify(backup)) };
            if (!session.valid()) throw new Error('聊天已切换，未保存。');
            const previous = session.context.chatMetadata[FIELD];
            session.context.chatMetadata[FIELD] = envelope;
            try {
                await session.context.saveChat();
                const saved = await this.read(session);
                if (saved?.signature !== envelope.signature) throw new Error('手机数据未通过服务器回读验证。');
            } catch (error) { session.context.chatMetadata[FIELD] = previous; throw error; }
            if (revision !== this.portable.revision?.()) {
                this.status = '已保存本轮快照，新的修改等待下一次同步';
                this.portable.retry?.(session); return;
            }
            if (this.ledger.restore) await this.restore(backup, session, true);
            else await this.ledger.write(backup.events.map(row => ({ ...row, scope: session.scope })));
            await this.ledger.saveMeta?.(`${session.scope}:cloud-state`, stateHashes(backupState(backup)));
            this.status = `已保存并同步 ${backup.events.length} 条记录 / ${backup.photos.length} 张图片 · ${Math.ceil(bytes / 1024)} KiB`;
        } finally { this.busy = false; }
    }
}

module.exports = { Cloud, mergeEvents };
