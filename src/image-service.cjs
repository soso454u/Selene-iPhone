const { clip, newId } = require('./domain.cjs');
const { safeUrl } = require('./media.cjs');
const { loadModule } = require('./host.cjs');
const { photoSource, dataImageBlob, validImageBlob } = require('./photos.cjs');
const { imageRules, IMAGE_RULES_LIMIT } = require('./image-rules.cjs');

const MODES = ['tavern', 'direct', 'proxy'];
const IMAGE_DEFAULTS = Object.freeze({ provider: 'custom', format: 'openai', endpoint: '', upstreamEndpoint: '', modelsEndpoint: '', model: '', style: 'inherit', customStyle: '', extraPrompt: '', negativePrompt: '', niniSize: '832x1216', niniSteps: '28', niniScale: '5', niniCfg: '0', niniSampler: 'k_euler_ancestral', openaiSize: '1024x1024', openaiQuality: 'auto', characterProfiles: '', token: '', upstreamKey: '' });
function imageSettings(input = {}) {
    const result = Object.fromEntries(Object.entries(IMAGE_DEFAULTS).map(([key, fallback]) => [key, typeof input?.[key] === 'string' ? clip(input[key], key === 'characterProfiles' ? 12000 : 4000) : fallback]));
    if (!['novelai', 'custom', 'openai'].includes(result.provider)) result.provider = 'custom';
    if (!['openai', 'link', 'json'].includes(result.format)) result.format = 'openai';
    for (const key of ['endpoint', 'upstreamEndpoint', 'modelsEndpoint']) result[key] = safeUrl(result[key]);
    for (const [key, min, max] of [['niniSteps', 1, 100], ['niniScale', 0, 30], ['niniCfg', 0, 10]]) {
        const number = Number(result[key]); result[key] = String(Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : IMAGE_DEFAULTS[key]);
    }
    for (const key of ['niniSize', 'openaiSize']) if (!/^\d{3,4}x\d{3,4}$/.test(result[key])) result[key] = IMAGE_DEFAULTS[key];
    return result;
}
const IMAGE_PROMPT_FIELDS = ['style', 'customStyle', 'extraPrompt', 'negativePrompt'];
const promptValues = input => { const clean = imageSettings(input); return Object.fromEntries(IMAGE_PROMPT_FIELDS.map(key => [key, clean[key]])); };
function cleanPromptPresets(input) {
    if (!Array.isArray(input)) return [];
    const result = new Map();
    for (const row of input.slice(0, 30)) {
        if (!row || typeof row.id !== 'string' || !row.id || typeof row.name !== 'string' || !row.name.trim()) continue;
        result.set(row.id, { id: clip(row.id, 120), name: clip(row.name, 80), values: promptValues(row.values) });
    }
    return [...result.values()];
}
function configuration(input = {}) {
    return { version: 2, mode: MODES.includes(input?.mode) ? input.mode : 'tavern', autoGenerate: input?.autoGenerate === true,
        imageRules: imageRules(input?.imageRules), promptPresets: cleanPromptPresets(input?.promptPresets), activePromptPreset: clip(input?.activePromptPreset, 120),
        profiles: Object.fromEntries(MODES.map(mode => [mode, imageSettings(input?.profiles?.[mode] || (mode === 'proxy' && !input?.version ? { ...input, endpoint: '' } : mode === 'tavern' ? { style: 'inherit' } : {}))])) };
}
function endpointUrl(value) {
    const url = new URL(value || 'invalid:');
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('请填写有效的生图服务地址。');
    if (url.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('非本地生图服务请使用 HTTPS。');
    return url;
}
function openaiEndpoint(value, models = false) {
    const url = endpointUrl(value); let path = url.pathname.replace(/\/+$/, '');
    if (/\/images\/generations$/.test(path)) path = path.replace(/\/images\/generations$/, '');
    else if (/\/models$/.test(path)) path = path.replace(/\/models$/, '');
    if (!path) path = '/v1'; else if (!/\/v\d+$/.test(path)) path += '/v1';
    url.pathname = `${path}/${models ? 'models' : 'images/generations'}`; return url;
}
function characterReferenceRows(value) {
    try {
        const rows = JSON.parse(value);
        if (Array.isArray(rows)) return rows.filter(row => row && typeof row.name === 'string' && typeof row.prompt === 'string').map(row => ({ name: row.name.trim(), prompt: row.prompt.trim() }));
    } catch {}
    const rows = [];
    for (const line of String(value || '').split('\n')) {
        const match = line.match(/^\s*([^:：]{1,60})[:：]\s*(.*)$/);
        if (match) rows.push({ name: match[1].trim(), prompt: match[2].trim() });
        else if (line.trim()) {
            if (rows.length) rows.at(-1).prompt += `\n${line.trim()}`;
            else rows.push({ name: '', prompt: line.trim() });
        }
    }
    return rows;
}
function namedReferences(value, task) {
    const all = characterReferenceRows(value);
    const explicit = new Set([task.character, ...(Array.isArray(task.characters) ? task.characters : [])].filter(name => typeof name === 'string').map(name => name.trim()));
    const description = [task.description, task.prompt].filter(Boolean).join('\n');
    // Whole Latin names only; longer known names claim overlapping mentions first.
    // Single-character names require an explicit identity to avoid broad substring matches.
    const mentioned = new Set(); const spans = [];
    for (const row of [...all].sort((a, b) => b.name.length - a.name.length)) {
        if ([...row.name].length < 2) continue;
        const escaped = row.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = /^[\p{Script=Latin}\p{Number}\s.'’-]+$/u.test(row.name) ? `(?<![\\p{Script=Latin}\\p{Number}_])${escaped}(?![\\p{Script=Latin}\\p{Number}_])` : escaped;
        for (const match of description.matchAll(new RegExp(pattern, 'giu'))) {
            const end = match.index + match[0].length;
            if (spans.some(([start, stop]) => match.index < stop && end > start)) continue;
            mentioned.add(row.name); spans.push([match.index, end]);
        }
    }
    const rows = all.filter(row => !row.name || explicit.has(row.name) || mentioned.has(row.name))
        .sort((a, b) => Number(explicit.has(b.name)) - Number(explicit.has(a.name)));
    return [rows.map(row => `${row.name ? `${row.name}: ` : ''}${row.prompt}`).join('\n'), task.characterProfile].filter(Boolean).join('\n');
}

function promptParts(config, task) {
    const refs = namedReferences(config.characterProfiles, task);
    const style = config.style === 'custom' ? config.customStyle : ({ anime: 'anime style', cinematic: 'cinematic lighting', soft: 'soft lighting', dark: 'dark cinematic lighting' })[config.style];
    return [task.prompt?.trim() || task.description, style, config.extraPrompt, refs ? `Character appearance references:\n${refs}\nKeep each named appearance bound to its character.` : ''].filter(Boolean);
}
function promptFor(config, task) { return promptParts(config, task).join('\n'); }

class ImageService {
    constructor(host, ledger, account, getContext = () => host.SillyTavern?.getContext?.(), loadNative = path => loadModule(host, path)) {
        Object.assign(this, { host, ledger, key: `image-settings:${account}`, getContext, loadNative, tasks: new Map() });
    }
    async load() { this.config ??= configuration(await this.ledger.readMeta(this.key)); return this.config; }
    async publicConfig() {
        const root = await this.load(); const { token, upstreamKey, ...values } = root.profiles[root.mode];
        return { ...values, imageRules: root.imageRules, mode: root.mode, autoGenerate: root.autoGenerate, hasToken: !!token, hasUpstreamKey: !!upstreamKey, promptPresets: root.promptPresets, activePromptPreset: root.activePromptPreset };
    }
    async save(input) {
        if (typeof input.characterProfiles === 'string' && input.characterProfiles.length > 12000) throw new Error('角色外貌提示词合计最多 12000 字，请缩短后保存。');
        if (Object.hasOwn(input, 'imageRules') && (typeof input.imageRules !== 'string' || input.imageRules.length > IMAGE_RULES_LIMIT || input.imageRules.includes('\0'))) throw new Error(`生图规则请输入 ${IMAGE_RULES_LIMIT} 字以内的纯文本。`);
        const root = structuredClone(await this.load());
        const mode = MODES.includes(input.mode) ? input.mode : root.mode;
        root.profiles[mode] = imageSettings({ ...root.profiles[mode], ...input }); root.mode = mode;
        if (typeof input.autoGenerate === 'boolean') root.autoGenerate = input.autoGenerate;
        if (typeof input.imageRules === 'string') root.imageRules = input.imageRules;
        const preset = root.promptPresets.find(row => row.id === root.activePromptPreset);
        if (preset && IMAGE_PROMPT_FIELDS.some(key => root.profiles[mode][key] !== preset.values[key])) root.activePromptPreset = '';
        await this.ledger.saveMeta(this.key, root); this.config = root;
    }
    async savePromptPreset(name, values) {
        const title = clip(name, 80);
        if (!title) throw new Error('请给提示词方案起个名字。');
        const root = structuredClone(await this.load());
        const existing = root.promptPresets.find(row => row.name === title);
        if (!existing && root.promptPresets.length >= 30) throw new Error('最多保存 30 套提示词方案，请先删除不用的方案。');
        const preset = { id: existing?.id || newId(), name: title, values: promptValues(values) };
        root.promptPresets = [...root.promptPresets.filter(row => row.id !== preset.id), preset];
        root.profiles[root.mode] = { ...root.profiles[root.mode], ...preset.values }; root.activePromptPreset = preset.id;
        await this.ledger.saveMeta(this.key, root); this.config = root;
    }
    async applyPromptPreset(id) {
        const root = structuredClone(await this.load()); const preset = root.promptPresets.find(row => row.id === id);
        if (!preset) throw new Error('这套提示词方案已不存在。');
        root.profiles[root.mode] = { ...root.profiles[root.mode], ...preset.values }; root.activePromptPreset = id;
        await this.ledger.saveMeta(this.key, root); this.config = root;
    }
    async deletePromptPreset(id) {
        const root = structuredClone(await this.load());
        root.promptPresets = root.promptPresets.filter(row => row.id !== id);
        if (root.activePromptPreset === id) root.activePromptPreset = '';
        await this.ledger.saveMeta(this.key, root); this.config = root;
    }
    async models() {
        const root = await this.load(); const config = root.profiles[root.mode];
        if (root.mode === 'tavern') {
            const select = this.host.document.querySelector('#sd_model');
            const list = [...select?.options || []].map(option => clip(option.value, 200)).filter(Boolean);
            if (!list.length) throw new Error('请先在酒馆 Image Generation 扩展中配置服务并加载模型。');
            return list;
        }
        let url; let options;
        if (root.mode === 'proxy') {
            const endpoint = endpointUrl(config.endpoint);
            url = config.modelsEndpoint || new URL('/api/models', endpoint);
            options = { method: 'POST', body: JSON.stringify({ provider: config.provider, upstreamEndpoint: config.upstreamEndpoint, upstreamKey: config.upstreamKey, token: config.token }), headers: { 'Content-Type': 'application/json' } };
        } else {
            if (config.format !== 'openai' && !config.modelsEndpoint) throw new Error('该接口没有通用模型列表，请填写模型名称或模型列表地址。');
            url = config.modelsEndpoint || openaiEndpoint(config.endpoint, true);
            options = { headers: config.upstreamKey ? { Authorization: `Bearer ${config.upstreamKey}` } : {} };
        }
        try {
            const response = await this.host.fetch(url, { ...options, credentials: 'omit', redirect: 'error' });
            const result = await response.json().catch(() => null);
            const rows = result?.models || result?.data;
            if (!response.ok || !Array.isArray(rows)) throw new Error('未能读取模型列表，可手动填写模型名称。');
            return [...new Set(rows.map(item => clip(typeof item === 'string' ? item : item?.id, 200)).filter(Boolean))];
        } catch (error) { if (error instanceof TypeError) throw new Error('模型接口无法跨域读取，请切换自定义代理或手动填写模型。'); throw error; }
    }
    generate(task) {
        const id = task.taskId || newId();
        if (this.tasks.has(id)) return this.tasks.get(id);
        if (this.job) return Promise.reject(new Error('已有生图任务进行中，请等待任务结束。'));
        const controller = new AbortController();
        const job = { id, controller, mode: null };
        this.job = job;
        const promise = Promise.resolve().then(() => this.run(task, job)).finally(() => { this.tasks.delete(id); if (this.job === job) this.job = null; });
        this.tasks.set(id, promise); return promise;
    }
    async tavernCommand() {
        let parser;
        try { parser = (await this.loadNative('scripts/slash-commands/SlashCommandParser.js')).SlashCommandParser; }
        catch { throw new Error('当前酒馆无法调用静默生图命令，请启用官方 Image Generation 扩展，或切换直连/自定义代理。'); }
        const command = parser?.commands?.sd || parser?.commands?.imagine;
        if (typeof command?.callback !== 'function' || !command.namedArgumentList?.some(arg => arg.name === 'quiet')) throw new Error('Image Generation 未启用或当前版本不支持 quiet 静默生图，请先在酒馆配置。');
        return command;
    }
    async tavern(config, task, prompt = promptFor(config, task), command) {
        command ||= await this.tavernCommand();
        // Call the registered /sd command with structured arguments: no parser, no prompt-to-command injection.
        const value = await command.callback({ quiet: 'true', ...(config.negativePrompt ? { negative: config.negativePrompt } : {}) }, prompt);
        const url = photoSource(typeof value === 'string' ? value : value?.pipe);
        if (!url) throw new Error('酒馆没有返回图片路径，请检查官方 Image Generation 的服务、模型和认证配置。');
        return { url, persistent: !/^data:|^blob:/.test(url) };
    }
    async decode(response, job, config, strictImageFetch = false) {
        if (!response.ok) throw new Error(`生图服务返回 HTTP ${response.status}，未自动重试。请检查认证、模型和参数。`);
        const type = (response.headers?.get('content-type') || '').toLowerCase();
        if (type.startsWith('image/')) {
            const blob = await response.blob(); if (!validImageBlob(blob)) throw new Error('接口返回的图片格式不支持或超过 20 MiB。'); return { blob };
        }
        const text = await response.text();
        let result; try { result = JSON.parse(text); } catch { result = text.trim(); }
        const first = result?.data?.[0] || result?.images?.[0];
        const base64 = result?.base64 || result?.b64_json || first?.b64_json || (typeof first === 'string' && !photoSource(first) ? first : '');
        if (base64) return { blob: dataImageBlob(`data:image/png;base64,${base64}`) };
        const url = photoSource(typeof result === 'string' ? result : result?.imageUrl || result?.url || result?.image || first?.url || (typeof first === 'string' ? first : ''));
        if (!url) throw new Error('服务未返回 URL、Base64 或图片 Blob；未自动重试。');
        if (url.startsWith('data:')) return { blob: dataImageBlob(url) };
        const secretInUrl = [config.upstreamKey, config.token].some(secret => secret && (url.includes(secret) || url.includes(encodeURIComponent(secret))));
        try {
            const imageResponse = await this.host.fetch(new URL(url, this.host.document.baseURI), { credentials: 'omit', signal: job.controller.signal, referrerPolicy: 'no-referrer' });
            if (!imageResponse.ok) throw new Error('图片读取失败');
            const blob = await imageResponse.blob(); if (!validImageBlob(blob)) throw new Error('返回的图片无效'); return { blob };
        } catch {
            job.controller.signal.throwIfAborted();
            if (strictImageFetch || result?.mode === 'browser_redirect' || secretInUrl) throw new Error('图片接口无法读取，可能受跨域限制。为避免重复扣费，未尝试图片标签或重发请求；请配置可跨域读取的代理。');
            return { url, skipCache: true, warning: '图片链接无法跨域缓存，可能在上游过期；可改用支持 Blob/Base64 的服务。' };
        }
    }
    async run(task, job) {
        const root = await this.load(); const config = { ...root.profiles[root.mode] }; job.mode = root.mode;
        if (!clip(task.prompt, 6000) && !clip(task.description)) throw new Error('请填写生图提示词或画面描述。');
        const signal = job.controller.signal;
        const timeout = this.host.setTimeout(() => job.controller.abort(), 180000);
        try {
            const nativeCommand = root.mode === 'tavern' ? await this.tavernCommand() : null;
            const endpoint = root.mode === 'tavern' ? null : endpointUrl(config.endpoint);
            // Text-model calls belong only to the explicit AI prompt button.
            const prompt = promptFor(config, task);
            signal.throwIfAborted(); task.onPromptReady?.();
            let image;
            if (root.mode === 'tavern') image = await this.tavern(config, task, prompt, nativeCommand);
            else {
                let url = endpoint; let options;
                if (root.mode === 'proxy') {
                    options = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...config, mode: undefined, endpoint: undefined, format: undefined, modelsEndpoint: undefined, style: 'inherit', extraPrompt: '', customStyle: '', characterProfiles: '', prompt, imageDescription: prompt, sourceLanguage: 'en', promptLanguage: 'en', translatePhotoDescription: false, character: task.character, requestId: job.id, forceRegenerate: true, openaiN: '1', seed: Math.floor(Math.random() * 4294967295) }) };
                } else if (config.format === 'link') {
                    if (!url.pathname.replace(/\/$/, '').endsWith('/generate')) url.pathname = `${url.pathname.replace(/\/$/, '')}/generate`;
                    for (const [key, value] of Object.entries({ token: config.upstreamKey, model: config.model, size: config.niniSize, steps: config.niniSteps, scale: config.niniScale, cfg: config.niniCfg, sampler: config.niniSampler, negative: config.negativePrompt, tag: prompt, seed: Math.floor(Math.random() * 4294967295) })) url.searchParams.set(key, String(value));
                    options = { method: 'GET' };
                } else {
                    const [width, height] = config.niniSize.split('x').map(Number);
                    const body = config.format === 'openai' ? { model: config.model, prompt: config.negativePrompt ? `${prompt}\nAvoid: ${config.negativePrompt}` : prompt, n: 1, size: config.openaiSize, ...(config.openaiQuality && config.openaiQuality !== 'none' ? { quality: config.openaiQuality } : {}) }
                        : { model: config.model, prompt, negative_prompt: config.negativePrompt, width, height, steps: Number(config.niniSteps), cfg_scale: Number(config.niniScale), cfg_rescale: Number(config.niniCfg), sampler_name: config.niniSampler, seed: -1, batch_size: 1 };
                    if (config.format === 'openai') url = openaiEndpoint(config.endpoint);
                    options = { method: 'POST', headers: { 'Content-Type': 'application/json', ...(config.upstreamKey ? { Authorization: `Bearer ${config.upstreamKey}` } : {}) }, body: JSON.stringify(body) };
                }
                signal.throwIfAborted();
                const response = await this.host.fetch(url, { ...options, signal, credentials: 'omit', redirect: root.mode === 'direct' && config.format !== 'link' ? 'error' : 'follow', referrerPolicy: 'no-referrer' });
                image = await this.decode(response, job, config, root.mode === 'direct' && config.format === 'link');
            }
            signal.throwIfAborted(); return { ...image, mode: root.mode };
        } catch (error) {
            if (signal.aborted) throw new Error('生图已取消或超时，未保存本次结果，也不会自动重试。');
            if (error instanceof TypeError) throw new Error('生图请求无法跨域读取或网络连接失败；未重发请求，请使用酒馆生图或自定义代理。');
            throw error;
        } finally { this.host.clearTimeout(timeout); }
    }
    cancel() { this.job?.controller.abort(); }
}
module.exports = { ImageService, IMAGE_DEFAULTS, imageSettings, configuration, openaiEndpoint, promptFor, characterReferenceRows, namedReferences, IMAGE_PROMPT_FIELDS };
