const importers = new WeakMap();

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

module.exports = { loadModule };
