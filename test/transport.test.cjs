const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadModule } = require('../src/host.cjs');
const { DEFAULTS, phoneSettings, normalizeOutput } = require('../src/context.cjs');
const { Transport, modelList, parseReply } = require('../src/api.cjs');

test('native modules load through the host realm and retain the failing module stage', async () => {
    let constructors = 0;
    const paths = [];
    const native = { ready: true };
    const host = { document: { baseURI: 'https://tavern.test/' }, Function: (argument, body) => {
        constructors++;
        assert.equal(argument, 'url'); assert.equal(body, 'return import(url);');
        return async url => { paths.push(url); return native; };
    } };
    assert.equal(await loadModule(host, 'scripts/openai.js'), native);
    assert.equal(await loadModule(host, 'scripts/world-info.js'), native);
    assert.equal(constructors, 1);
    assert.deepEqual(paths, ['https://tavern.test/scripts/openai.js', 'https://tavern.test/scripts/world-info.js']);
    const blocked = { document: host.document, Function: () => { throw new Error('blocked'); } };
    await assert.rejects(loadModule(blocked, 'scripts/personas.js'), /scripts\/personas.js.*blocked/);
});

test('unlimited output migrates old caps once; explicit positive limits have no 4000 ceiling', () => {
    assert.equal(DEFAULTS.output, 0);
    assert.equal(phoneSettings({ output: 4000, model: 'saved-model' }).output, 0);
    assert.equal(phoneSettings({ output: 4000, model: 'saved-model' }).model, 'saved-model');
    assert.equal(phoneSettings({ output: 128000, outputLimitVersion: 1 }).output, 128000);
    assert.equal(normalizeOutput(''), 0);
    for (const value of [-1, 1.5, 'NaN', Infinity]) assert.throws(() => normalizeOutput(value), /非负整数/);
});

test('custom API omits token caps by default and never imports native modules for model queries', async () => {
    const requests = [];
    const host = { document: { baseURI: 'https://tavern.test/' }, fetch: async (url, options) => {
        requests.push({ url: url.pathname, body: JSON.parse(options.body) });
        return Response.json(url.pathname.endsWith('/status') ? { data: [{ id: 'test-model' }] } : { choices: [{ message: { content: '{"messages":[]}' } }] });
    } };
    const transport = new Transport(host, assert.fail);
    const settings = { ...DEFAULTS, apiMode: 'custom', base: 'https://example.test/v1', model: 'test-model' };
    const context = { getRequestHeaders: () => ({}) };
    const messages = [{ role: 'user', content: 'hello' }];
    await transport.execute(settings, context, messages);
    assert.equal(Object.hasOwn(requests.at(-1).body, 'max_tokens'), false);
    await transport.execute({ ...settings, output: 128000 }, context, messages);
    assert.equal(requests.at(-1).body.max_tokens, 128000);
    await transport.execute(settings, context, messages, { test: true });
    assert.equal(requests.at(-1).body.max_tokens, 16);
    assert.deepEqual(await transport.execute({ ...settings, model: '' }, context, [], { models: true }), ['test-model']);
    for (const key of ['messages', 'model', 'max_tokens', 'temperature']) assert.equal(Object.hasOwn(requests.at(-1).body, key), false);
});

test('model lists accept provider and proxy envelopes but never treat upstream errors as empty success', () => {
    const entries = [{ id: 'provider-chat' }, { id: 'provider-reasoning' }, { id: 'provider-chat' }];
    for (const result of [{ data: entries }, { data: { data: entries } }, { models: entries }, entries]) assert.deepEqual(modelList(result), ['provider-chat', 'provider-reasoning']);
    assert.deepEqual(modelList({ models: [{ name: 'named-model' }] }), ['named-model']);
    assert.throws(() => modelList({ error: true, data: { data: [] } }), /酒馆转发报告连接失败/);
    assert.throws(() => modelList({ data: [] }), /空模型列表/);
    assert.throws(() => modelList({ choices: [] }), /格式无法识别/);
});

test('HTML at the native model route falls back to one read-only request to the configured API', async () => {
    const requests = [];
    const host = {
        location: { href: 'https://tavern.test/chat' }, document: { baseURI: 'https://static.test/phone/' },
        fetch: async (url, options) => {
            requests.push({ url: String(url), options });
            return new URL(url).origin === 'https://tavern.test'
                ? new Response('<!DOCTYPE html><title>Login</title>') : Response.json({ data: [{ id: 'run-model' }] });
        },
    };
    const transport = new Transport(host, assert.fail);
    transport.token = 'test-key';
    const settings = { ...DEFAULTS, apiMode: 'custom', base: 'https://provider.test/v1/models', model: 'run-model' };
    const context = { getRequestHeaders: () => ({ 'X-CSRF-Token': 'tavern-only' }) };
    assert.deepEqual(await transport.execute(settings, context, [], { models: true }), ['run-model']);
    assert.deepEqual(requests.map(request => request.url), ['https://tavern.test/api/backends/chat-completions/status', 'https://provider.test/v1/models']);
    assert.equal(requests[0].options.mode, 'same-origin');
    assert.equal(requests[1].options.method, 'GET');
    assert.equal(requests[1].options.credentials, 'omit');
    assert.equal(requests[1].options.redirect, 'error');
    assert.deepEqual(requests[1].options.headers, { Accept: 'application/json', Authorization: 'Bearer test-key' });
    await assert.rejects(transport.execute(settings, context, [], { test: true }), /酒馆生成接口/);
    assert.equal(requests.length, 3);
});

test('DeepSeek requests require an explicit session key and preserve its authorization through the proxy', async () => {
    let calls = 0;
    const host = { document: { baseURI: 'https://tavern.test/' }, fetch: async (url, options) => {
        calls++;
        const data = JSON.parse(options.body);
        assert.equal(data.custom_url, 'https://api.deepseek.com/v1');
        assert.equal(JSON.parse(data.custom_include_headers).Authorization, 'Bearer test-session-key');
        return Response.json({ data: [{ id: 'server-model' }] });
    } };
    const transport = new Transport(host, assert.fail);
    const settings = { ...DEFAULTS, apiMode: 'custom', base: 'https://api.deepseek.com/v1', model: '' };
    const context = { getRequestHeaders: () => ({}) };
    await assert.rejects(transport.execute(settings, context, [], { models: true }), /尚未设置 DeepSeek 独立 API 密钥/);
    assert.equal(calls, 0);
    transport.token = 'test-session-key';
    assert.deepEqual(await transport.execute(settings, context, [], { models: true }), ['server-model']);
    assert.equal(calls, 1);
});

test('model failures retain authentication or proxy diagnostics without exposing credentials', async () => {
    let response;
    const transport = new Transport({ document: { baseURI: 'https://tavern.test/' }, fetch: async () => response });
    transport.token = 'secret-test-key';
    const settings = { ...DEFAULTS, apiMode: 'custom', base: 'https://example.test/v1', model: '' };
    const context = { getRequestHeaders: () => ({}) };
    response = Response.json({ error: { message: 'Unauthorized Bearer secret-test-key' } });
    await assert.rejects(transport.execute(settings, context, [], { models: true }), error => /密钥未通过验证/.test(error.message) && !error.message.includes(transport.token));
    response = Response.json({ error: true, data: { data: [] } });
    await assert.rejects(transport.execute(settings, context, [], { models: true }), /酒馆转发报告连接失败/);
    response = Response.json({ error: 'not found' }, { status: 404 });
    await assert.rejects(transport.execute(settings, context, [], { models: true }), /接口地址不存在/);
    response = new Response('<html>Gateway Timeout</html>', { status: 504 });
    await assert.rejects(transport.execute({ ...settings, model: 'model' }, context, [], {}), /网关或上游等待超时.*504/);
});

test('streaming collects complete UTF-8 JSON, ignores keepalive and reasoning, and reports progress', async () => {
    const chunks = [': keep-alive\r\n\r\n', 'data: {"choices":[{"delta":{"reasoning_content":"不应保存的分析"}}]}\r\n\r\n',
        `data: ${JSON.stringify({ choices: [{ delta: { content: '{"messages":["你好' } }] })}\r\n\r\n`,
        `data: ${JSON.stringify({ choices: [{ delta: { content: '，晚点见。"]}' }, finish_reason: 'stop' }] })}\n\n`, 'data: [DONE]\n\n'];
    const encoded = new TextEncoder().encode(chunks.join(''));
    let sent; const progress = [];
    const transport = new Transport({ document: { baseURI: 'https://tavern.test/' }, fetch: async (url, options) => {
        sent = JSON.parse(options.body);
        return new Response(new ReadableStream({ start(controller) { for (let index = 0; index < encoded.length; index += 7) controller.enqueue(encoded.slice(index, index + 7)); controller.close(); } }), { headers: { 'Content-Type': 'text/event-stream' } });
    } });
    const result = await transport.execute({ ...DEFAULTS, apiMode: 'custom', base: 'https://example.test/v1', model: 'model' }, { getRequestHeaders: () => ({}) }, [], { onProgress: value => progress.push(value) });
    assert.equal(sent.stream, true);
    assert.deepEqual(parseReply(result, 'reply').messages, ['你好，晚点见。']);
    assert.doesNotMatch(result, /不应保存的分析/);
    assert.equal(progress.at(-1).characters, result.length);
});

test('interrupted streams and truncated output never return partial replies or automatically retry', async () => {
    let source = ''; let calls = 0;
    const transport = new Transport({ document: { baseURI: 'https://tavern.test/' }, fetch: async () => { calls++; return new Response(source, { headers: { 'Content-Type': 'text/event-stream' } }); } });
    const settings = { ...DEFAULTS, apiMode: 'custom', base: 'https://example.test/v1', model: 'model' };
    const context = { getRequestHeaders: () => ({}) };
    source = `data: ${JSON.stringify({ choices: [{ delta: { content: '{"messages":[' } }] })}\n\n`;
    await assert.rejects(transport.execute(settings, context, []), /流式连接提前结束/);
    source = `data: ${JSON.stringify({ choices: [{ delta: { content: '{"messages":[]}' }, finish_reason: 'length' }] })}\n\ndata: [DONE]\n\n`;
    await assert.rejects(transport.execute(settings, context, []), /Token 上限/);
    assert.equal(calls, 2);
    assert.equal(transport.job, null);
});

test('stream cancellation releases its reader without returning partial content', async () => {
    let receiving;
    const ready = new Promise(resolve => { receiving = resolve; });
    let closed = false;
    const transport = new Transport({ document: { baseURI: 'https://tavern.test/' }, fetch: async () => new Response(new ReadableStream({
        start(controller) { controller.enqueue(new TextEncoder().encode(': keep-alive\n\n')); receiving(); }, cancel() { closed = true; },
    }), { headers: { 'Content-Type': 'text/event-stream' } }) });
    const pending = transport.execute({ ...DEFAULTS, apiMode: 'custom', base: 'https://example.test/v1', model: 'model' }, { getRequestHeaders: () => ({}) }, []);
    await ready;
    transport.cancel();
    await assert.rejects(pending, /已取消/);
    assert.equal(transport.job, null);
    assert.equal(closed, true);
});

test('content sniffing accepts mislabeled SSE and JSON, including proxy frames without blank separators', async () => {
    let body = 'data: {"choices":[{"delta":{"content":"{\\"messages\\":[]}"},"finish_reason":"stop"}]}\ndata: [DONE]\n';
    const transport = new Transport({ document: { baseURI: 'https://tavern.test/' }, fetch: async (url, options) => {
        assert.equal(options.headers.get('Content-Type'), 'application/json');
        return new Response(body, { headers: { 'Content-Type': 'application/json' } });
    } });
    const settings = { ...DEFAULTS, apiMode: 'custom', base: 'https://example.test/v1', model: 'model' };
    const context = { getRequestHeaders: () => ({}) };
    assert.equal(await transport.execute(settings, context, []), '{"messages":[]}');
    body = '\ufeff\n' + JSON.stringify({ choices: [{ message: { content: [{ type: 'text', text: '{"messages":[]}' }] } }] });
    assert.equal(await transport.execute(settings, context, []), '{"messages":[]}');
});

test('native chat and text paths clear limits while retaining mandatory Claude limits and original settings', async () => {
    const bodies = [];
    const config = { chat_completion_source: 'openai', openai_max_tokens: 8192 };
    const host = { document: { baseURI: 'https://tavern.test/' }, fetch: async (url, options) => { bodies.push(JSON.parse(options.body)); return Response.json({ choices: [{ message: { content: 'OK' } }] }); } };
    const native = { getChatCompletionModel: () => 'test-model', createGenerationParameters: async settings => ({ generate_data: { max_tokens: settings.openai_max_tokens, max_completion_tokens: settings.openai_max_tokens } }) };
    const transport = new Transport(host, async () => native);
    const context = { mainApi: 'openai', chatCompletionSettings: config, getRequestHeaders: () => ({}) };
    await transport.execute(DEFAULTS, context, []);
    assert.equal(Object.hasOwn(bodies.at(-1), 'max_tokens'), false);
    assert.equal(Object.hasOwn(bodies.at(-1), 'max_completion_tokens'), false);
    await transport.execute({ ...DEFAULTS, output: 64000 }, context, []);
    assert.equal(bodies.at(-1).max_tokens, 64000);
    await transport.execute(DEFAULTS, { ...context, chatCompletionSettings: { ...config, chat_completion_source: 'claude' } }, []);
    assert.equal(bodies.at(-1).max_tokens, 8192);
    assert.equal(config.openai_max_tokens, 8192);
    let textPayload;
    const textNative = { getTextGenModel: () => 'text-model', createTextGenGenerationData: () => ({ max_new_tokens: 480, max_length: 480, n_predict: 480 }) };
    const text = new Transport(host, async () => textNative);
    await text.execute(DEFAULTS, { mainApi: 'textgenerationwebui', TextCompletionService: { sendRequest: async data => { textPayload = data; return { content: 'OK' }; } } }, []);
    for (const key of ['max_new_tokens', 'max_length', 'n_predict']) assert.equal(Object.hasOwn(textPayload, key), false);
});

test('platform request credentials override the default key without replacing it', async () => {
    const authorization = [];
    const transport = new Transport({ document: { baseURI: 'https://tavern.test/' }, fetch: async (url, options) => {
        authorization.push(JSON.parse(JSON.parse(options.body).custom_include_headers).Authorization);
        return Response.json({ choices: [{ message: { content: '{"messages":["已生成"]}' } }] });
    } });
    transport.token = 'default-key';
    const settings = { ...DEFAULTS, apiMode: 'custom', base: 'https://example.test/v1', model: 'test' };
    const context = { getRequestHeaders: () => ({}) };
    await transport.execute(settings, context, [], { token: 'redbook-key' });
    await transport.execute(settings, context, [], { token: '' });
    await transport.execute(settings, context, []);
    assert.deepEqual(authorization, ['Bearer redbook-key', '', 'Bearer default-key']);
    assert.equal(transport.token, 'default-key');
});
