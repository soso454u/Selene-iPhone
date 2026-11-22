const importers = new WeakMap();

function tavernApiUrl(host, path) {
    return new URL(`/api/${path}`, host.location?.href || host.document.baseURI);
}

function isHtmlResponse(response, text) {
    return /\btext\/html\b/i.test(response.headers?.get('content-type') || '') || /^\s*<(?:!doctype\b|html\b|head\b|body\b)/i.test(text || '');
}

async function loadModule(host, path) {
    try {
        let importer = importers.get(host);
        if (!importer) {
            if (typeof host.Function !== 'function') throw new Error('宿主窗口未提供模块加载能力');
            importer = host.Function('url', 'return import(url);');
            importers.set(host, importer);
        }
        return await importer(new URL(path, host.document.baseURI).href);
    } catch (error) {
        throw new Error(`酒馆宿主模块加载失败（${path}）：${error.message}`, { cause: error });
    }
}

module.exports = { loadModule, tavernApiUrl, isHtmlResponse };
