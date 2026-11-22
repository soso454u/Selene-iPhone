const { clip, newId } = require('./domain.cjs');
const { loadModule, normalizeOutput } = require('./context.cjs');
const { tavernApiUrl, isHtmlResponse } = require('./host.cjs');

const OUTPUT_KEYS = ['max_tokens', 'max_completion_tokens', 'max_output_tokens', 'max_new_tokens', 'max_length', 'n_predict', 'num_predict', 'max_tokens_to_generate'];
function clearOutputLimit(data) {
    for (const key of OUTPUT_KEYS) delete data[key];
}

function failureMessage(result, status, models) {
    const error = result?.error;
    const upstream = Number(error?.status ?? error?.status_code ?? result?.status_code ?? result?.status ?? status);
    const detail = String(typeof error === 'string' ? error : error?.message ?? result?.message ?? '');
    const action = models ? '获取模型列表失败' : '手机请求失败';
    if ([408, 504, 524].includes(upstream) || /gateway[_ -]?timeout|timed?\s*out|\b(?:504|524)\b/i.test(detail)) return `${action}：网关或上游等待超时${upstream >= 400 ? `（HTTP ${upstream}）` : ''}，不是密钥验证失败。可开启流式接收、缩小正文上下文后手动重试；反向代理的超时/缓冲限制需在服务器端调整。`;
    if (upstream === 401 || /invalid[_ -]api[_ -]key|authentication|unauthori[sz]ed|invalid token/i.test(detail)) return `${action}：API 密钥未通过验证，请重新填写独立 API 密钥。可在设置中更新已保存的密钥。`;
    if (upstream === 403) return `${action}：服务拒绝访问，请检查密钥权限或服务端访问限制。`;
    if (upstream === 404) return `${action}：接口地址不存在，请检查 Base URL 是否为服务商的 API 根地址。`;
    if (upstream === 429) return `${action}：服务限流或额度不足，请稍后重试并检查账户状态。`;
    return upstream >= 400 ? `${action}（HTTP ${upstream}）。请检查独立 API 地址、密钥和酒馆服务器连接。`
        : `${action}：酒馆转发报告连接失败，未取得有效响应。请核对独立 API 地址和已保存的密钥；可查看酒馆服务器日志确认上游原因。`;
}

function modelList(result) {
    const layers = [result, result?.data, result?.data?.data];
    if (layers.some(layer => layer?.error)) throw new Error(failureMessage(layers.find(layer => layer?.error), 200, true));
    const entries = layers.flatMap(layer => [layer, layer?.models]).find(Array.isArray);
    if (!entries) throw new Error('酒馆返回的模型列表格式无法识别；可以手动填写服务商提供的模型 ID。');
    const models = [...new Set(entries.map(model => clip(typeof model === 'string' ? model : model?.id || model?.name, 200)).filter(Boolean))].sort();
    if (!models.length) throw new Error('服务返回了空模型列表，请检查该密钥可访问的模型；也可手动填写模型 ID。');
    return models;
}

async function streamReply(response, signal, onProgress = () => {}) {
    if (!response.body?.getReader) throw new Error('浏览器不支持流式读取，请关闭独立 API 流式接收后重试。');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = ''; let content = ''; let complete = false; let finish = ''; let updated = 0; let format = ''; let lines = [];
    const cancel = () => { reader.cancel().catch(() => {}); };
    signal.addEventListener('abort', cancel, { once: true });
    const event = block => {
        const data = block.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n').trim();
        if (!data) return;
        if (data === '[DONE]') { complete = true; return; }
        let value;
        try { value = JSON.parse(data); } catch { throw new Error('流式数据格式异常，未将不完整内容写入手机。'); }
        if (value?.error) throw new Error(failureMessage(value, 200, false));
        const choice = value?.choices?.[0];
        if (choice?.finish_reason) finish = choice.finish_reason;
        const delta = choice?.delta?.content ?? choice?.message?.content ?? choice?.text;
        if (typeof delta === 'string') content += delta;
        else if (Array.isArray(delta)) content += delta.map(part => typeof part === 'string' ? part : part?.text || '').join('');
        if (content.length > 2 * 1024 * 1024) throw new Error('模型返回内容异常过大，已停止接收；未写入手机。');
        if (Date.now() - updated >= 250) { updated = Date.now(); onProgress({ characters: content.length }); }
    };
    try {
        onProgress({ characters: 0 });
        while (!complete) {
            signal.throwIfAborted();
            const { value, done } = await reader.read();
            signal.throwIfAborted();
            buffer += decoder.decode(value, { stream: !done });
            if (!format) {
                const start = buffer.replace(/^\uFEFF/, '').trimStart();
                if (/^(?:data:|event:|id:|retry:|:)/.test(start)) format = 'sse';
                else if (start && (done || !['data:', 'event:', 'id:', 'retry:'].some(prefix => prefix.startsWith(start)))) format = 'json';
            }
            if (format === 'json') {
                if (buffer.length > 2 * 1024 * 1024) throw new Error('API 响应异常过大。');
                if (done) return { raw: buffer };
                continue;
            }
            let boundary;
            while ((boundary = /\r\n|\r|\n/.exec(buffer)) && !complete) {
                if (!done && boundary[0] === '\r' && boundary.index === buffer.length - 1) break;
                const line = buffer.slice(0, boundary.index); buffer = buffer.slice(boundary.index + boundary[0].length);
                if (!line.trim()) { if (lines.length) event(lines.join('\n')); lines = []; }
                else if (line.startsWith('data:')) {
                    lines.push(line);
                    const candidate = lines.map(value => value.slice(5).trimStart()).join('\n').trim();
                    let ready = candidate === '[DONE]';
                    if (!ready) { try { JSON.parse(candidate); ready = true; } catch {} }
                    if (ready) { event(lines.join('\n')); lines = []; }
                }
            }
            if (buffer.length > 2 * 1024 * 1024) throw new Error('流式数据未形成有效事件，已停止接收。');
            if (done) { if (buffer.startsWith('data:')) lines.push(buffer); if (lines.length && !complete) event(lines.join('\n')); break; }
        }
        if (!complete && !finish) throw new Error('流式连接提前结束，未将不完整回复写入手机。请检查网关超时后手动重试。');
        if (finish === 'length') throw new Error('模型输出达到服务端 Token 上限而被截断，未写入不完整回复。请调整输出上限或改用更适合短回复的模型。');
        if (!content.trim()) throw new Error('模型流式请求结束，但未返回正文内容。');
        onProgress({ characters: content.length });
        return content;
    } catch (error) {
        if (error instanceof TypeError && !signal.aborted) throw new Error('流式连接中断，未将不完整回复写入手机。请检查网关连接后手动重试。', { cause: error });
        throw error;
    } finally { signal.removeEventListener('abort', cancel); await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

function connection(settings, token) {
    let url;
    try { url = new URL(settings.base.trim()); } catch { throw new Error('请输入有效的独立 API Base URL'); }
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('Base URL 必须使用 HTTP(S)，且不能包含凭据、查询参数或锚点');
    if (token && url.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('非本地 API 使用密钥时必须是 HTTPS');
    let path = url.pathname.replace(/\/+$/, '').replace(/\/(?:chat\/completions|models)$/i, '');
    if (!path) path = '/v1';
    return { chat_completion_source: 'custom', custom_url: `${url.origin}${path}`, custom_include_headers: JSON.stringify({ Authorization: token ? `Bearer ${token}` : '' }) };
}

class Transport {
    constructor(host, loadNative = path => loadModule(host, path)) { this.host = host; this.loadNative = loadNative; this.token = ''; }

    async execute(settings, context, messages, { models = false, test = false, onProgress, token = this.token } = {}) {
        if (this.job) throw new Error('小手机已有请求在进行中');
        const controller = new AbortController();
        const job = { id: newId(), controller };
        this.job = job;
        try {
            const output = test ? 16 : normalizeOutput(settings.output ?? 0);
            if (settings.apiMode === 'tavern' && context.mainApi === 'textgenerationwebui') {
                const native = await this.loadNative('scripts/textgen-settings.js');
                const config = { ...context.textCompletionSettings, streaming: false, json_schema: null, grammar_string: '', negative_prompt: '', guidance_scale: 1, include_reasoning: false, min_length: 0 };
                const prompt = models ? null : messages.map(message => message.content).join('\n\n');
                const data = native.createTextGenGenerationData(config, native.getTextGenModel(config), prompt, output || undefined);
                if (!output) clearOutputLimit(data);
                data.stream = false;
                delete data.stop;
                delete data.stopping_strings;
                controller.signal.throwIfAborted();
                if (models) return this.request(context, 'text-completions/status', { api_server: data.api_server, api_type: data.api_type }, controller.signal, true);
                const result = await context.TextCompletionService.sendRequest(data, true, controller.signal);
                if (typeof result?.content !== 'string') throw new Error('文本补全服务未返回可读内容');
                return result.content;
            }
            const data = settings.apiMode === 'custom' ? connection(settings, token) : {};
            if (settings.apiMode === 'custom') {
                if (new URL(data.custom_url).hostname === 'api.deepseek.com' && !token.trim()) throw new Error('尚未设置 DeepSeek 独立 API 密钥，请填写后重试。可在设置中更新已保存的密钥。');
                if (!models && !settings.model.trim()) throw new Error('请输入独立 API 模型名称');
                if (!models) Object.assign(data, { model: settings.model.trim(), ...(output ? { max_tokens: output } : {}), temperature: settings.temperature, stream: settings.streaming !== false, messages });
            } else {
                if (context.mainApi !== 'openai') throw new Error('当前连接类型未适配；请选择独立 API 或先切换到聊天补全／文本补全');
                const native = await this.loadNative('scripts/openai.js');
                if (!native.createGenerationParameters || !native.getChatCompletionModel) throw new Error('酒馆当前版本未提供隔离的聊天补全参数构建入口');
                const config = { ...context.chatCompletionSettings, stream_openai: false, n: 1, enable_web_search: false,
                    request_images: false, enable_function_calling: false, ...(output ? { openai_max_tokens: output } : {}),
                    custom_include_body: '', custom_exclude_body: '', bias_preset_selected: '', show_thoughts: false, verbosity: 'auto' };
                const model = native.getChatCompletionModel(config);
                Object.assign(data, models ? await currentModelQuery(config, model, native) : (await native.createGenerationParameters(config, model, 'quiet', messages)).generate_data);
                if (!output && config.chat_completion_source !== 'claude') clearOutputLimit(data);
                if (!models) { data.stream = false; delete data.tools; delete data.tool_choice; delete data.stop; }
            }
            controller.signal.throwIfAborted();
            try {
                return await this.request(context, `chat-completions/${models ? 'status' : 'generate'}`, data, controller.signal, models, onProgress);
            } catch (error) {
                if (!models || settings.apiMode !== 'custom' || error.code !== 'TAVERN_ROUTE') throw error;
                return await this.directModels(data.custom_url, token, controller.signal, error);
            }
        } catch (error) {
            if (controller.signal.aborted) throw new Error('手机请求已取消');
            if (error instanceof TypeError) throw new Error('无法连接酒馆服务器或响应格式异常');
            throw error;
        } finally { if (this.job === job) this.job = null; }
    }

    async directModels(base, token, signal, routeError) {
        const headers = { Accept: 'application/json' };
        if (token) headers.Authorization = `Bearer ${token}`;
        let response;
        try {
            response = await this.host.fetch(`${base}/models`, { method: 'GET', headers, credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer', signal });
        } catch {
            signal.throwIfAborted();
            throw new Error(`${routeError.message} 浏览器直连失败，可手动填写模型 ID。`);
        }
        const result = await response.json().catch(() => null);
        if (!response.ok || result?.error) throw new Error(failureMessage(result, response.status, true));
        if (result == null) throw new Error('独立 API 的模型列表接口返回了无效响应，可手动填写模型 ID。');
        return modelList(result);
    }

    async request(context, endpoint, data, signal, models, onProgress) {
        const headers = new Headers(context.getRequestHeaders());
        headers.set('Content-Type', 'application/json');
        const response = await this.host.fetch(tavernApiUrl(this.host, `backends/${endpoint}`), {
            method: 'POST', mode: 'same-origin', credentials: 'same-origin', headers, body: JSON.stringify(data), signal,
        });
        let raw;
        if (response.ok && !models && response.body?.getReader) {
            const received = await streamReply(response, signal, onProgress);
            if (typeof received === 'string') return received;
            raw = received.raw;
        }
        let result;
        if (raw !== undefined || typeof response.text === 'function') {
            raw ??= await response.text();
            try { result = JSON.parse(raw.replace(/^\uFEFF/, '').trim()); } catch { result = null; }
        } else result = await response.json().catch(() => null);
        const missingRoute = [404, 405].includes(response.status);
        if (result == null && (missingRoute || response.ok && isHtmlResponse(response, raw))) {
            const error = new Error(models ? '酒馆模型列表接口返回了网页或路由不可用。' : '酒馆生成接口返回了网页或路由不可用，请刷新酒馆页面并检查代理路由。');
            error.code = 'TAVERN_ROUTE';
            throw error;
        }
        if (!response.ok || result?.error) throw new Error(failureMessage(result, response.status, models));
        if (result == null) throw new Error('API 响应既不是有效 JSON，也不是可识别的流式数据；未写入手机。');
        if (models) return modelList(result);
        const value = result?.choices?.[0]?.message?.content ?? result?.choices?.[0]?.text ?? result?.content ?? result?.response ?? context.extractMessageFromData?.(result, 'openai');
        const content = Array.isArray(value) ? value.map(part => typeof part === 'string' ? part : part?.text ?? '').join('') : value;
        if (typeof content !== 'string' || !content || result?.error) throw new Error(models ? '该模型服务未返回可读的模型列表，可手动填写模型' : '模型服务未返回文本。请查看酒馆服务器状态。');
        return content;
    }

    cancel() { this.job?.controller.abort(); }
    close() { this.cancel(); this.token = ''; }
}

async function currentModelQuery(config, model, native) {
    const { generate_data: data } = await native.createGenerationParameters(config, model, 'quiet', []);
    delete data.messages;
    return data;
}

function socialPayload(payload) {
    if (payload == null) return undefined;
    if (typeof payload !== 'object' || Array.isArray(payload)) throw new Error('动态 payload 应为对象。');
    const output = { ...payload };
    if (payload.postedAt != null) {
        if (typeof payload.postedAt !== 'string' || payload.postedAt.length > 80) throw new Error('动态发布时间应为 80 字以内的剧情时间文本。');
        output.postedAt = payload.postedAt.trim();
    }
    if (payload.comments == null) return output;
    if (!Array.isArray(payload.comments) || payload.comments.length > 40) throw new Error('每条动态的 comments 应为最多 40 条评论的数组。');
    const comments = payload.comments.map(comment => {
        if (!comment || typeof comment.nickname !== 'string' || !comment.nickname.trim() || comment.nickname.length > 80 || typeof comment.text !== 'string' || !comment.text.trim() || comment.text.length > 500) throw new Error('模拟评论需要昵称和正文，昵称最多 80 字，正文最多 500 字；本次未保存。');
        if (comment.postedAt != null && (typeof comment.postedAt !== 'string' || comment.postedAt.length > 80)) throw new Error('评论时间应为 80 字以内的剧情时间文本。');
        return { id: clip(comment.id || comment.nickname, 120), nickname: comment.nickname.trim(), text: comment.text.trim(), quote: clip(comment.quote, 300), ...(comment.postedAt != null ? { postedAt: comment.postedAt.trim() } : {}) };
    });
    return { ...output, comments };
}

function parseReply(text, mode, count = 1) {
    const cleaned = String(text).trim().replace(/^```(?:json)?\s*|\s*```$/gi, '').trim();
    let result;
    try { result = JSON.parse(cleaned); } catch { throw new Error('回复不是手机预设要求的 JSON；未把它写入剧情，可重试'); }
    if (mode === 'comments') {
        const comments = socialPayload({ comments: result?.comments ?? result?.payload?.comments })?.comments;
        if (!comments?.length) throw new Error('本次未返回评论，原帖保留；不会自动追加请求。');
        return { comments };
    }
    if (mode === 'post' && count > 1) {
        if (!result || !Array.isArray(result.posts) || result.posts.length > count || result.posts.some(post => !post || typeof post.text !== 'string' || !post.text.trim() || post.text.trim().length > 2000 || (post.payload != null && (typeof post.payload !== 'object' || Array.isArray(post.payload))))) throw new Error('批量动态格式不合法，应返回 posts 数组；本次未保存，也不会自动追加请求。');
        const posts = result.posts.map(post => ({ text: clip(post.text), payload: socialPayload(post.comments != null && post.payload?.comments == null ? { ...post.payload, comments: post.comments } : post.payload), memory: typeof post.memory === 'string' ? clip(post.memory, 300) : '' }));
        return { posts, messages: posts.map(post => post.text) };
    }
    if (!result || !Array.isArray(result.messages) || result.messages.length > 6 || result.messages.some(message => typeof message !== 'string' || message.trim().length > 2000)) throw new Error('手机回复格式不合法；未写入剧情');
    const messages = result.messages.map(message => clip(message)).filter(Boolean);
    const payload = result.payload && typeof result.payload === 'object' ? result.payload : Array.isArray(result.components) ? { components: result.components.slice(0, 12) } : undefined;
    return { messages: mode === 'post' ? messages.slice(0, 1) : messages, payload: mode === 'post' ? socialPayload(result.comments != null && payload?.comments == null ? { ...payload, comments: result.comments } : payload) : payload, memory: typeof result.memory === 'string' ? clip(result.memory, 300) : '' };
}

// A model-generated player reply is discarded locally; it must not discard its
// valid parent post, other comments, or cause a second paid generation request.
function filterPlayerComments(comments, playerNames = []) {
    const normalize = value => String(value || '').normalize('NFKC').trim().toLowerCase();
    const aliases = new Set(['$player', 'player', 'user', '{{user}}', '玩家', '用户', ...playerNames].map(normalize).filter(Boolean));
    return comments.filter(comment => !aliases.has(normalize(comment.id)) && !aliases.has(normalize(comment.nickname)));
}

module.exports = { Transport, connection, parseReply, modelList, streamReply, filterPlayerComments };
