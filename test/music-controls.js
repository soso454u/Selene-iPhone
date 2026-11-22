// Focused protocol fixture matching Selene 2.10.110 MUSIC_LIBRARY_API.md.
// No Audio, network music/lyric API, phone ledger or AI calls.
window.runMusicControlsSmoke = async () => {
    await window.runMusicV2Smoke(true);
    const f = window.musicFixture, p = f.phone, app = p.musicApp, bridge = p.musicIsland;
    const base = window.__SELENE_MUSIC_PLAYER__, delay = () => f.delay(35), checks = [], calls = [];
    const check = (name, value) => { if (!value) throw Error(name); checks.push(name); };
    let mode = 'loop', selected = 'auto', quality = 'auto', revision = 1, lyricsReads = 0, sourceReads = 0;
    let lyricsWait, sourceWait, failSource = false, status = 'ready', message = '', instance = 'controls-a', s01sEnabled = true;
    let timeline = Array.from({ length: 15 }, (_, index) => ({ time: index * 10, lines: [`第 ${index + 1} 句歌词`, `Translation ${index + 1}`] }));
    timeline[1].lines[0] = '<img src=x onerror=alert(1)> 按文本显示';
    const lyrics = () => ({ protocolVersion: 1, loaded: true, trackId: base.getPlaybackState().trackId, revision, status, message, lines: status === 'ready' ? timeline : [] });
    const sources = () => ({ ok: true, trackId: base.getPlaybackState().trackId, selected, actualSource: selected === 'lx-tencent' ? `S01S · QQ · ${quality}` : 'JOOX',
        options: [{ id: 'auto', label: '自动回退', available: true }, { id: 'joox', label: 'JOOX', available: true }, ...(s01sEnabled ? [{ id: 'lx-tencent', label: 'S01S · QQ', available: true }] : []), { id: 'disabled', label: '不可用来源', available: false }],
        quality, qualityOptions: s01sEnabled ? [{ id: 'auto', label: '默认' }, { id: 'sq', label: 'SQ 无损' }, { id: 'future-quality', label: '播放器新增音质' }] : [] });
    const optionsEvent = () => dispatchEvent(new CustomEvent('selene-music-playback-options-state', { detail: { protocolVersion: 1, loaded: true, trackId: base.getPlaybackState().trackId, playMode: mode, selectedSource: selected, actualSource: sources().actualSource, quality } }));
    const lyricsEvent = () => { const { lines, ...detail } = lyrics(); dispatchEvent(new CustomEvent('selene-music-lyrics-state', { detail })); };
    const api = () => ({ ...base,
        getCapabilities() { const data = base.getCapabilities(); return { ...data, instanceId: instance, capabilities: { ...data.capabilities, ...Object.fromEntries(['getLyricsState', 'getPlayMode', 'setPlayMode', 'getPlaybackSources', 'setPlaybackSource', 'setS01SQuality'].map(key => [key, true])) } }; },
        getLyricsState() { lyricsReads++; return lyricsWait ? lyricsWait() : lyrics(); },
        getPlayMode() { return { ok: true, mode }; },
        setPlayMode(value) { calls.push(['setPlayMode', value]); mode = value; optionsEvent(); return { ok: true, mode }; },
        getPlaybackSources() { sourceReads++; return sources(); },
        async setPlaybackSource(value) {
            calls.push(['setPlaybackSource', value]); if (sourceWait) await sourceWait;
            if (failSource) return { ...sources(), ok: false, error: { code: 'PLAYBACK_FAILED', message: '播放器返回的切源失败原因' } };
            selected = value; optionsEvent(); return sources();
        },
        async setS01SQuality(value) { calls.push(['setS01SQuality', value]); quality = value; selected = 'lx-tencent'; optionsEvent(); return sources(); },
    });
    const install = () => { window.__SELENE_MUSIC_PLAYER__ = api(); bridge.connect(true); };
    install(); await delay(); app.showFull(true); app.setFullView('lyrics'); await delay();
    check('歌词和翻译按真实时间轴分组，v2 音乐库仍启用', app.lyricRows.length === 15 && app.lyricRows[0].querySelector('.player-lyric-translation').textContent === 'Translation 1' && app.supports('getMusicLibrary'));
    check('歌词只作文本渲染，HTML 不执行', app.lyricRows[1].textContent.includes('<img') && !app.lyricsList.querySelector('img'));
    f.emit({ currentTime: 12, playing: false }); await delay();
    check('暂停保持对应活动行', app.lyricIndex === 1 && app.lyricRows[1].getAttribute('aria-current') === 'true');
    const savedNode = app.lyricRows[0], reads = lyricsReads;
    for (let index = 0; index < 20; index++) bridge.notify('progress');
    lyricsEvent(); await delay();
    check('进度和重复 revision 不重读歌词、不重建列表', lyricsReads === reads && app.lyricRows[0] === savedNode);
    f.emit({ currentTime: 25, playing: true }); await delay();
    check('恢复播放继续跟随当前行', app.lyricIndex === 2);
    app.lyricRows[4].click(); await delay();
    check('点击歌词调用真实 seekTo 并同步播放时钟', f.calls.at(-1)[0] === 'seekTo' && f.calls.at(-1)[1] === 40 && base.getPlaybackState().currentTime === 40 && app.lyricIndex === 4);
    app.range.value = '65'; app.range.oninput();
    check('拖动进度立即匹配歌词行', app.lyricIndex === 6);
    app.range.onchange(); await delay();
    check('提交进度后播放器同步跳转', base.getPlaybackState().currentTime === 65 && app.lyricIndex === 6);
    app.lyricsList.dispatchEvent(new WheelEvent('wheel', { deltaY: -100 })); app.lyricsList.scrollTop = 0; f.emit({ currentTime: 85 }); await delay();
    check('手动浏览时更新高亮但不抢回滚动位置', app.lyricsBrowsing && !app.followLyrics.hidden && app.lyricIndex === 8 && app.lyricsList.scrollTop < 10);
    app.followLyrics.click(); check('回到当前歌词恢复跟随', !app.lyricsBrowsing && app.followLyrics.hidden);
    app.lyricsList.dispatchEvent(new WheelEvent('wheel', { deltaY: -100 })); await f.delay(4500);
    check('停止手动浏览后自动恢复跟随', !app.lyricsBrowsing && !app.lyricsFollowTimer && app.followLyrics.hidden);
    app.browseLyrics(); app.setFullView('cover');
    check('切回封面停止歌词跟随定时器', !app.lyricsFollowTimer && app.lyricsPane.hidden && !app.fullArt.hidden);
    app.setFullView('lyrics'); await delay();
    let resolveOld, resolveNew;
    lyricsWait = () => new Promise(resolve => { if (!resolveOld) resolveOld = resolve; else resolveNew = resolve; }); revision++; lyricsEvent(); await delay();
    const oldData = { ...lyrics(), lines: [{ time: 0, lines: ['旧歌异步结果'] }] };
    status = 'loading'; message = '新歌曲正在准备歌词'; revision++;
    f.emit({ trackId: 'new-track', title: '新歌曲', currentTime: 0, playing: false });
    check('切歌立即清除旧歌词', app.lyricRows.length === 0 && !app.lyricsList.textContent.includes('旧歌异步结果'));
    lyricsWait = null; resolveOld(oldData); await delay();
    check('旧歌异步返回不会串到新歌', app.lyricRows.length === 0 && !app.lyricsList.textContent.includes('旧歌异步结果'));
    resolveNew(lyrics()); await delay();
    check('显示新歌加载提示', app.lyricsList.textContent.includes(message));
    for (const [nextStatus, hint] of [['instrumental', '纯音乐 · 请欣赏'], ['unavailable', 'MP3 直链歌曲'], ['error', '歌词请求限流，请稍后再试']]) {
        status = nextStatus; message = hint; revision++; lyricsEvent(); await delay();
        check(`播放器歌词状态 ${nextStatus} 原样显示`, app.lyricRows.length === 0 && app.lyricsList.textContent === hint);
    }
    status = 'ready'; message = ''; revision++; lyricsEvent(); await delay();
    app.sourceButton.click(); await delay();
    check('音源面板使用真实来源与音质选项，展示实际播放来源', !app.sourceOverlay.hidden && app.sourcesInfo.textContent.includes('JOOX') && app.sourcesList.textContent.includes('播放器新增音质') && [...app.sourcesList.querySelectorAll('button')].some(button => button.disabled && button.textContent.includes('不可用来源')));
    let releaseSource; sourceWait = new Promise(resolve => { releaseSource = resolve; });
    const beforeSource = calls.length;
    const pending = app.changeSource('setPlaybackSource', 'joox'); app.changeSource('setPlaybackSource', 'auto');
    check('切源处理中阻止重复提交', calls.length === beforeSource + 1 && app.sourceSheet.getAttribute('aria-busy') === 'true');
    releaseSource(); await pending; sourceWait = null; await delay();
    check('切源调用 setter 后回读真实状态', app.sources.selected === 'joox' && sourceReads > 1 && calls.some(row => row[0] === 'setPlaybackSource' && row[1] === 'joox'));
    await app.changeSource('setS01SQuality', 'future-quality'); await delay();
    check('S01S 音质按接口实际 ID 提交并回读', quality === 'future-quality' && app.sources.quality === quality && app.sources.selected === 'lx-tencent');
    const confirmed = app.sources.selected; failSource = true; await app.changeSource('setPlaybackSource', 'auto');
    check('切源失败保留已确认选项并展示具体错误', app.sources.selected === confirmed && app.sourcesFeedback.textContent.includes('播放器返回的切源失败原因'));
    failSource = false; selected = 'auto'; quality = 'sq'; optionsEvent(); await delay();
    check('播放器本体改来源和音质后手机同步', app.sources.selected === 'auto' && app.sources.quality === 'sq');
    app.closeSources();
    for (const next of ['one', 'shuffle', 'loop']) {
        app.modeButton.click(); await delay();
        check(`模式切换到 ${next} 使用 setter 和真实返回值`, mode === next && app.mode === next && calls.some(row => row[0] === 'setPlayMode' && row[1] === next));
    }
    mode = 'shuffle'; optionsEvent(); await delay();
    check('播放器本体切换模式同步图标', app.mode === 'shuffle' && app.modeButton.title.includes('随机播放'));
    const optionCalls = sourceReads; s01sEnabled = false; optionsEvent(); await delay();
    check('选项摘要相同的 S01S 配置事件仍刷新实际可用列表', sourceReads > optionCalls && app.sources.qualityOptions.length === 0 && !app.sources.options.some(option => option.id === 'lx-tencent'));
    s01sEnabled = true; optionsEvent(); await delay();
    const oldWidth = p.panel.style.width; p.panel.style.width = '280px';
    const buttons = [...app.full.querySelector('.player-transport').children].map(node => node.getBoundingClientRect());
    check('280px 窄屏五键不重叠、不溢出', buttons.length === 5 && buttons.every((rect, index) => rect.width > 20 && (!index || rect.left >= buttons[index - 1].right)) && buttons[4].right <= app.full.getBoundingClientRect().right);
    p.panel.style.width = oldWidth;
    let resolveReload; lyricsWait = () => new Promise(resolve => { resolveReload = resolve; }); revision++; lyricsEvent(); await delay();
    const staleReload = { ...lyrics(), lines: [{ time: 0, lines: ['旧实例异步歌词'] }] };
    lyricsWait = null; instance = 'controls-b'; revision = 1; timeline = [{ time: 0, lines: ['新实例歌词'] }]; install(); await delay(); resolveReload(staleReload); await delay();
    check('播放器热重载丢弃旧实例数据并读取新歌词', app.lyricsList.textContent.includes('新实例歌词') && !app.lyricsList.textContent.includes('旧实例异步歌词') && app.optionalInstance === instance);
    const beforeHidden = lyricsReads; app.browseLyrics(); p.minimize(); revision++; lyricsEvent(); optionsEvent(); await delay();
    check('最小化停止歌词更新、跟随定时器及选项读取', lyricsReads === beforeHidden && !app.lyricsFollowTimer && !app.lyricsReading && !bridge.progressTimer);
    p.open(); await delay(); app.showFull(true); app.setFullView('lyrics'); await delay();
    check('重新打开读取最新歌词状态', app.lyrics.revision === revision);
    // Same object reinitialization is signaled through the existing v2 instance ID.
    instance = 'controls-c'; revision = 1; timeline = [{ time: 0, lines: ['同句柄新实例歌词'] }];
    dispatchEvent(new CustomEvent('selene-music-library-state', { detail: { protocolVersion: 2, available: true, instanceId: instance, changed: [] } })); await delay();
    check('同公开句柄的新 v2 实例也重新读取歌词', app.lyricsList.textContent.includes('同句柄新实例歌词') && app.optionalInstance === instance);
    const optionalReads = lyricsReads;
    app.setFullView('cover'); await delay(); f.emit({ currentTime: 42 }); bridge.notify('progress');
    check('封面视图播放进度不读取歌词', lyricsReads === optionalReads);
    dispatchEvent(new CustomEvent('selene-music-library-state', { detail: { protocolVersion: 2, available: false, loaded: true, instanceId: instance } })); app.setFullView('lyrics'); await delay();
    check('音乐库暂不可用不影响独立歌词和播放选项', !app.capabilities && app.lyricRows.length > 0 && !app.modeButton.disabled && !app.sourceButton.disabled);
    const partial = api(); delete partial.getLyricsState; delete partial.setS01SQuality;
    window.__SELENE_MUSIC_PLAYER__ = partial; bridge.connect(true); await delay(); app.showFull(true); app.setFullView('lyrics'); app.sourceButton.click(); await delay();
    check('部分新方法缺失只降级对应功能', app.lyricsList.textContent === '当前 Selene 版本暂不支持歌词' && !app.modeButton.disabled && !app.sourceButton.disabled && [...app.sourcesList.querySelectorAll('button')].some(button => button.disabled && button.textContent.includes('SQ 无损')) && [...app.sourcesList.querySelectorAll('button')].some(button => !button.disabled && button.textContent.includes('JOOX')));
    app.closeSources();
    const noLibrary = api(); delete noLibrary.getCapabilities;
    window.__SELENE_MUSIC_PLAYER__ = noLibrary; bridge.connect(true); await delay(); app.showFull(true); app.setFullView('lyrics'); await delay();
    check('没有 v2 能力接口仍按实际方法启用新功能', !app.capabilities && app.lyricRows.length > 0 && !app.modeButton.disabled && !app.sourceButton.disabled);
    window.__SELENE_MUSIC_PLAYER__ = f.makeApi(); bridge.connect(true); await delay(); app.showFull(true); app.setFullView('lyrics'); await delay();
    check('v1 旧播放器只降级新功能，基础控制保持可用', app.lyricsList.textContent === '当前 Selene 版本暂不支持歌词' && app.modeButton.disabled && app.sourceButton.disabled && !app.fullPlay.disabled);
    app.fullPlay.click(); await delay();
    check('旧版播放暂停仍操作真实接口', f.calls.at(-1)[0] === 'togglePlayback');
    check('音乐操作未写入聊天、账本或 AI action', f.actions.every(name => name === 'open'));
    const oldApi = window.__SELENE_MUSIC_PLAYER__; delete window.__SELENE_MUSIC_PLAYER__; bridge.connect(true); await delay();
    check('播放器卸载清除歌词、来源和模式', !app.sources && !app.mode && app.lyricRows.length === 0 && app.full.hidden);
    p.close();
    check('销毁清理订阅、监听、定时器和异步引用', bridge.cleanups.length === 0 && bridge.subscribers.size === 0 && !bridge.progressTimer && app.uiCleanups.length === 0 && !app.lyricsFollowTimer && !app.lyricsReading && !app.optionsReading && !app.optionsOperation && !app.optionalApi && !app.lyrics && !app.sources);
    window.__SELENE_MUSIC_PLAYER__ = oldApi;
    document.querySelector('#report').textContent = checks.map(name => '✓ ' + name).join('\n');
    return { passed: checks.length, checks };
};
document.querySelector('#run-controls').onclick = () => window.runMusicControlsSmoke().catch(error => { document.querySelector('#report').textContent = error.stack; });
