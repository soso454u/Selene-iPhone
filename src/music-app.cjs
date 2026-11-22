const { artworkUrl } = require('./music-island.cjs');
const PAGE_SIZE = 30;
const CHANNEL = 'selene-phone-music';
const PLAY_MODES = { loop: ['顺序循环', 'repeat'], one: ['单曲循环', 'repeat-1'], shuffle: ['随机播放', 'shuffle'] };
const clock = value => { const seconds = Math.max(0, Math.floor(value || 0)); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`; };

// UI only. The single MusicIsland bridge owns the connection, events and clock.
class MusicApp {
    constructor(phone, bridge) {
        this.phone = phone; this.bridge = bridge; this.active = false; this.disposed = false;
        this.tab = 'home'; this.offset = 0; this.query = ''; this.sequence = 0; this.queue = null;
        this.optionalEpoch = 0; this.fullView = 'cover'; this.lyricRows = []; this.lyricIndex = -1;
        this.root = phone.el('div', 'player-app');
        this.body = phone.el('div', 'player-scroll');
        this.feedback = phone.el('p', 'player-feedback'); this.feedback.hidden = true; this.feedback.setAttribute('role', 'status');
        this.miniArt = this.art('', 'player-mini-art'); this.miniTitle = phone.el('strong'); this.miniArtist = phone.el('small');
        const open = phone.button('', () => this.showFull(true), 'player-mini-open', '展开正在播放');
        open.append(this.miniArt, phone.el('span', 'player-mini-label', this.miniTitle, this.miniArtist));
        this.miniPlay = this.control('play', '播放', () => this.run('togglePlayback'));
        this.mini = phone.el('div', 'player-mini', open, this.miniPlay, this.control('next', '下一首', () => this.run('nextTrack')));
        this.mini.hidden = true;
        this.tabs = phone.el('nav', 'player-tabs', ...[['home', 'home', '首页'], ['search', 'search', '搜索'], ['library', 'album', '音乐库'], ['queue', 'queue', '待播']].map(([key, icon, name]) => {
            const button = phone.button('', () => this.go(key), '', name); button.dataset.tab = key;
            button.append(phone.icon(icon), phone.el('span', '', name)); return button;
        }));
        this.tabs.setAttribute('aria-label', '音乐导航');
        this.full = phone.el('section', 'player-full'); this.full.hidden = true;
        this.full.setAttribute('aria-label', '正在播放');
        this.fullArt = this.art('', 'player-large-art'); this.fullTitle = phone.el('h2'); this.fullArtist = phone.el('p');
        this.range = phone.input('range', 0); this.range.min = '0'; this.range.max = '0'; this.range.step = '.1'; this.range.className = 'player-range';
        this.range.setAttribute('aria-label', '歌曲播放进度');
        this.elapsed = phone.el('span'); this.duration = phone.el('span');
        this.range.oninput = () => { this.seeking = true; this.seekTrack = bridge.state?.trackId; this.elapsed.textContent = clock(Number(this.range.value)); this.paintLyrics(Number(this.range.value)); };
        this.range.onchange = () => {
            const value = Number(this.range.value), track = this.seekTrack; this.seeking = false;
            if (track === bridge.state?.trackId) this.run('seekTo', value);
        };
        this.range.addEventListener('pointercancel', () => { this.seeking = false; this.paintProgress(); });
        this.fullPlay = this.control('play', '播放', () => this.run('togglePlayback'), 'player-main-control');
        this.favorite = this.control('heart', '收藏歌曲', () => this.run('toggleFavorite', this.queue?.currentTrack?.trackRef));
        this.viewSwitch = phone.el('div', 'player-view-switch', ...[['cover', '封面'], ['lyrics', '歌词']].map(([view, label]) => {
            const button = phone.button(label, () => this.setFullView(view), ''); button.dataset.view = view; return button;
        }));
        this.viewSwitch.setAttribute('role', 'group'); this.viewSwitch.setAttribute('aria-label', '播放页视图');
        this.lyricsList = phone.el('div', 'player-lyrics-list'); this.lyricsList.tabIndex = 0; this.lyricsList.setAttribute('aria-label', '同步歌词，点击歌词跳转');
        this.followLyrics = phone.button('回到当前歌词', () => this.resumeLyrics(), 'player-lyrics-follow'); this.followLyrics.hidden = true;
        this.lyricsPane = phone.el('div', 'player-lyrics-pane', this.lyricsList, this.followLyrics); this.lyricsPane.hidden = true;
        this.uiCleanups = [];
        const listen = (node, type, callback, options) => { node.addEventListener(type, callback, options); this.uiCleanups.push(() => node.removeEventListener(type, callback, options)); };
        for (const type of ['wheel', 'touchstart', 'pointerdown']) listen(this.lyricsList, type, () => this.browseLyrics(), { passive: true });
        listen(this.lyricsList, 'pointerdown', () => { this.lyricsDragging = true; });
        for (const type of ['pointerup', 'pointercancel']) listen(phone.doc, type, () => {
            if (this.lyricsDragging) { this.lyricsDragging = false; if (this.lyricsVisible()) this.browseLyrics(); }
        }, { passive: true });
        listen(this.lyricsList, 'keydown', event => { if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) this.browseLyrics(); });
        listen(this.lyricsList, 'scroll', () => { if (this.lyricsBrowsing) this.browseLyrics(); }, { passive: true });
        this.sourceButton = this.control('transfer', '选择播放源', () => this.openSources(), 'player-side-control');
        this.modeButton = this.control('repeat', '播放模式', () => this.cyclePlayMode(), 'player-side-control');
        this.fullFeedback = phone.el('p', 'player-full-feedback'); this.fullFeedback.hidden = true; this.fullFeedback.setAttribute('role', 'status');
        this.sourcesList = phone.el('div', 'player-source-list'); this.sourcesInfo = phone.el('p', 'player-source-info');
        this.sourcesFeedback = phone.el('p', 'player-source-feedback'); this.sourcesFeedback.setAttribute('role', 'status');
        const closeSources = phone.button('完成', () => this.closeSources(), 'player-source-done');
        this.sourceSheet = phone.el('section', 'player-source-sheet', phone.el('div', 'player-source-heading', phone.el('h3', '', '播放源'), closeSources), this.sourcesInfo, this.sourcesList, this.sourcesFeedback);
        this.sourceSheet.setAttribute('role', 'dialog'); this.sourceSheet.setAttribute('aria-modal', 'true'); this.sourceSheet.setAttribute('aria-label', '播放源与音质');
        this.sourceOverlay = phone.el('div', 'player-source-overlay', this.sourceSheet); this.sourceOverlay.hidden = true;
        listen(this.sourceOverlay, 'click', event => { if (event.target === this.sourceOverlay) this.closeSources(); });
        listen(this.sourceOverlay, 'keydown', event => {
            if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); this.closeSources(); }
            if (event.key === 'Tab') {
                const nodes = [...this.sourceSheet.querySelectorAll('button:not(:disabled)')], first = nodes[0], last = nodes.at(-1);
                const focused = this.phone.shadow.activeElement;
                if (event.shiftKey && focused === first) { event.preventDefault(); last?.focus(); }
                else if (!event.shiftKey && focused === last) { event.preventDefault(); first?.focus(); }
            }
        });
        this.full.append(phone.el('div', 'player-full-top', this.control('down', '收起播放页', () => this.showFull(false)), phone.el('span', '', '正在播放'), this.control('more', '打开 Selene 播放器', () => this.run('setVisible', true, { expand: true }))),
            this.viewSwitch, this.fullArt, this.lyricsPane, phone.el('div', 'player-now-title', phone.el('div', '', this.fullTitle, this.fullArtist), this.favorite),
            this.range, phone.el('div', 'player-time', this.elapsed, this.duration),
            phone.el('div', 'player-transport', this.sourceButton, this.control('previous', '上一首', () => this.run('previousTrack')), this.fullPlay, this.control('next', '下一首', () => this.run('nextTrack')), this.modeButton), this.fullFeedback,
            phone.button('待播清单', () => { this.showFull(false); this.go('queue'); }, 'player-queue-link'), this.sourceOverlay);
        this.root.append(this.body, this.feedback, this.mini, this.tabs, this.full);
        this.unsubscribe = bridge.subscribe((type, detail) => this.onBridge(type, detail));
    }

    control(icon, label, callback, extra = '') { return this.phone.iconButton(icon, label, callback, `player-control ${extra}`); }
    art(url, classes = '') {
        const node = this.phone.el('span', `player-art ${classes}`, this.phone.icon('music'));
        this.setArt(node, url); return node;
    }
    setArt(node, value) {
        const url = artworkUrl(value, this.phone.doc.baseURI);
        if (node.dataset.source === url) return;
        node.dataset.source = url; node.querySelector('img')?.remove();
        if (!url) return;
        const image = this.phone.el('img'); image.alt = ''; image.loading = 'lazy'; image.decoding = 'async'; image.referrerPolicy = 'no-referrer';
        image.onerror = () => { image.onerror = null; image.remove(); }; image.src = url; node.append(image);
    }
    setActive(active) {
        if (this.active === active || this.disposed) return;
        if (!active) { this.cancelSearch(); this.sequence++; this.showFull(false); this.suspendOptional(); }
        this.active = active; this.bridge.setAppActive(active);
        if (active) { this.paintPlayback(); this.handshake(); }
    }
    onBridge(type, detail) {
        if (!this.active || this.disposed) return;
        if (!this.bridge.isVisible()) { this.cancelSearch(); this.suspendOptional(); return; }
        if (type === 'visibility') { this.handshake(); this.syncOptional(); if (!this.full.hidden) { this.readPlaybackOptions(); if (this.fullView === 'lyrics') this.readLyrics(); } return; }
        if (type === 'progress') { this.paintProgress(); return; }
        if (type === 'appearance') { this.paintColor(); return; }
        if (type === 'lyrics') {
            if (!detail.loaded) { this.resetOptional(); return; }
            if (detail.trackId !== this.bridge.state?.trackId) return;
            if (Number.isFinite(detail.revision) && detail.revision <= (this.lyrics?.revision ?? -1)) return;
            this.lyricsHint = detail;
            if (this.lyrics?.revision !== detail.revision) this.clearLyrics(detail.message || '加载歌词…', false);
            this.readLyrics(); return;
        }
        if (type === 'options') {
            if (!detail.loaded) { this.resetOptional(); return; }
            if (detail.trackId !== this.bridge.state?.trackId) return;
            // The source list can change (e.g. S01S enabled) without changing
            // the event's selected source/quality summary. Re-read its snapshot.
            this.readPlaybackOptions();
            return;
        }
        if (type === 'library') {
            if (detail.available === false) {
                this.cancelSearch(); if (detail.loaded === false) this.resetOptional();
                this.capabilities = null; this.queue = null; this.sequence++; this.render();
                if (detail.loaded !== false && !this.full.hidden) { this.readPlaybackOptions(); if (this.fullView === 'lyrics') this.readLyrics(); }
                return;
            }
            if (this.optionalInstance && detail.instanceId !== this.optionalInstance) {
                this.resetOptional(); this.optionalInstance = detail.instanceId; this.handshaking = null;
            }
            if (detail.instanceId !== this.instanceId) { this.handshake(); return; }
            const changed = detail.changed || [];
            if (changed.includes('queue') || changed.includes('favorites')) this.readQueue();
            if ((this.tab === 'library' && changed.some(key => ['favorites', 'playlists'].includes(key))) || (this.tab === 'queue' && changed.includes('queue'))) this.refreshVisible();
            if (this.tab === 'search' && changed.includes('favorites')) this.refreshSearchFavorites();
            return;
        }
        this.paintPlayback();
        if (this.api !== this.bridge.api) { this.handshake(); return; }
        const key = `${this.bridge.state?.trackId || ''}\n${this.bridge.state?.title || ''}`;
        if (key !== this.trackKey) { this.trackKey = key; if (this.capabilities) this.readQueue(); }
    }
    async handshake() {
        const api = this.bridge.api;
        if (this.handshaking === api && api) return;
        const sequence = this.handshakeSequence = (this.handshakeSequence || 0) + 1;
        this.handshaking = api; this.api = api; this.capabilities = null; this.queue = null; this.instanceId = null;
        this.searchPage = null; this.recent = []; this.sequence++; this.render();
        if (!api || !this.bridge.has('getCapabilities')) { this.handshaking = null; return; }
        try {
            const result = await this.bridge.request('getCapabilities');
            if (!this.active || api !== this.bridge.api || this.disposed || sequence !== this.handshakeSequence) return;
            if (result?.protocolVersion === 2 && result.available && result.loaded) {
                if (this.optionalInstance && this.optionalInstance !== result.instanceId) this.resetOptional();
                this.optionalInstance = result.instanceId;
                this.instanceId = result.instanceId; this.capabilities = result.capabilities || {};
                this.searchModes = result.searchModes || [];
            }
        } catch (error) { if (this.active && api === this.bridge.api && sequence === this.handshakeSequence) this.message(error.message); }
        finally { if (this.handshaking === api && sequence === this.handshakeSequence) this.handshaking = null; }
        if (this.active && api === this.bridge.api && sequence === this.handshakeSequence) {
            this.render(); this.readQueue(); this.load();
            if (!this.full.hidden) { this.readPlaybackOptions(); if (this.fullView === 'lyrics') this.readLyrics(); }
        }
    }
    supports(method) { return !!this.capabilities?.[method] && this.bridge.has(method); }
    message(text = '') { this.feedback.textContent = this.fullFeedback.textContent = text; this.feedback.hidden = this.fullFeedback.hidden = !text; }
    async run(method, ...args) {
        if (!this.active || !this.bridge.api) return;
        if (args[0] == null && ['playTrack', 'toggleFavorite', 'addToQueue'].includes(method)) return;
        try {
            const result = await this.bridge.request(method, ...args);
            if (!this.active || this.disposed) return;
            this.bridge.connect(true); this.paintPlayback();
            if (method === 'addToQueue') this.message(result?.added === false ? '这首歌已在待播清单中' : '已加入待播');
            else if (method === 'toggleFavorite') this.message(result?.favorite ? '已加入喜欢的歌曲' : '已取消收藏');
            else this.message('');
            if (['playTrack', 'playPlaylist', 'toggleFavorite', 'addToQueue'].includes(method)) { this.readQueue(); this.refreshVisible(); }
        } catch (error) {
            if (!this.active || this.disposed) return;
            this.message(error.message);
            if (['STALE_REF', 'NOT_FOUND', 'EXPIRED_SEARCH', 'UNLOADED'].includes(error.code)) {
                if (error.code === 'EXPIRED_SEARCH') this.searchPage = null;
                else this.refreshVisible();
            }
        }
    }
    async readQueue() {
        if (!this.active || !this.bridge.isVisible() || !this.supports('getQueueState')) return;
        if (this.queueReading) { this.queueDirty = true; return; }
        this.queueReading = true;
        const api = this.bridge.api;
        try {
            let result = await this.bridge.request('getQueueState', { offset: 0, limit: PAGE_SIZE });
            if (this.active && this.tab === 'home' && result.queueIndex >= 0 && result.queueIndex + 1 < result.total && !result.items?.some(track => track.index === result.queueIndex + 1)) {
                result = await this.bridge.request('getQueueState', { offset: result.queueIndex, limit: PAGE_SIZE });
            }
            if (!this.active || api !== this.bridge.api || result.instanceId !== this.instanceId || this.disposed) return;
            this.queue = result;
            if (result.currentTrack && this.bridge.state?.playing && result.currentTrack.title === this.bridge.state.title) {
                const current = result.items?.find(item => item.trackId === result.currentTrackId) || result.currentTrack;
                this.recent = [current, ...(this.recent || []).filter(item => item.trackId !== current.trackId)].slice(0, 5);
            }
            this.paintPlayback();
            if (this.tab === 'home') this.renderHome();
        } catch { /* A v1 playback page stays usable if the library is unavailable. */ }
        finally { this.queueReading = false; if (this.queueDirty) { this.queueDirty = false; this.readQueue(); } }
    }
    go(tab, options = {}) {
        this.cancelSearch(); this.sequence++; this.tab = tab; this.offset = 0; this.playlist = options.playlist || null;
        this.libraryKind = options.kind || 'favorites'; this.message(''); this.showFull(false); this.render(); this.load();
    }
    render() {
        if (!this.active || this.disposed) return;
        for (const button of this.tabs.children) button.setAttribute('aria-current', button.dataset.tab === this.tab ? 'page' : 'false');
        this.body.replaceChildren();
        if (!this.bridge.api) {
            this.body.append(this.phone.el('div', 'player-offline', this.phone.el('span', 'player-offline-icon', this.phone.appIcon('music')), this.phone.el('h2', '', '音乐，随时在这里'),
                this.phone.el('p', '', 'Selene 播放器运行后，会自动连接。'), this.phone.button('重新检测', () => { this.bridge.connect(true); this.handshake(); }, 'player-pill')));
            this.paintPlayback(); return;
        }
        if (!this.capabilities) {
            this.renderHome();
            this.body.append(this.phone.el('p', 'player-compatibility', '当前可使用基础播放控制。搜索、喜欢和歌单需要支持音乐库接口的 Selene。'));
            if (this.bridge.has('setVisible')) this.body.append(this.phone.button('打开 Selene 播放器', () => this.run('setVisible', true, { expand: true }), 'player-pill'));
            return;
        }
        const heading = this.phone.el('header', 'player-heading', this.phone.el('span', '', 'SELENE MUSIC'), this.phone.el('h1', '', ({ home: '现在就听', search: '搜索', library: this.playlist?.name || '音乐库', queue: '待播清单' })[this.tab]));
        this.body.append(heading);
        if (this.tab === 'home') this.renderHome();
        else if (this.tab === 'search') this.renderSearch();
        else if (this.tab === 'library') {
            const libraryNav = this.phone.el('div', 'player-segments', ...[['favorites', '喜欢的歌曲'], ['playlists', '我的歌单']].map(([kind, title]) => this.phone.button(title, () => this.go('library', { kind }), this.libraryKind === kind && !this.playlist ? 'selected' : '')));
            this.body.append(libraryNav); this.list = this.phone.el('div', 'player-list'); this.body.append(this.list);
            if (this.playlist && this.supports('playPlaylist')) this.body.insertBefore(this.phone.button('播放歌单', () => this.run('playPlaylist', this.playlist.playlistId), 'player-pill'), this.list);
        } else { this.list = this.phone.el('div', 'player-list'); this.body.append(this.list); }
        this.paintPlayback();
    }
    renderHome() {
        if (!this.active || this.tab !== 'home' && this.capabilities) return;
        this.body.querySelector('.player-home')?.remove();
        const state = this.bridge.state, loaded = state?.loaded && (state.title || state.trackId);
        const home = this.phone.el('div', 'player-home');
        const hero = this.phone.button('', () => this.showFull(true), 'player-hero', '展开当前歌曲'); hero.disabled = !loaded;
        hero.append(this.art(loaded ? state.artwork : '', 'player-hero-art'), this.phone.el('span', '', this.phone.el('small', '', loaded ? '正在聆听' : '从喜欢的歌曲开始'), this.phone.el('strong', '', loaded ? state.title || '未知曲目' : '你的音乐时光'), this.phone.el('span', '', loaded ? state.artist || '未知歌手' : '收藏、歌单与播放状态跟随 Selene')));
        home.append(hero);
        if (this.capabilities) {
            home.append(this.phone.el('div', 'player-shortcuts', this.phone.button('♡ 喜欢的歌曲', () => this.go('library', { kind: 'favorites' }), ''), this.phone.button('♫ 我的歌单', () => this.go('library', { kind: 'playlists' }), '')));
            if (this.recent?.length) home.append(this.phone.el('div', 'player-section-head', this.phone.el('h2', '', '最近播放'), this.phone.el('small', '', '本次打开期间')), this.phone.el('div', 'player-list', ...this.recent.map(track => this.trackRow(track))));
            const upcoming = (this.queue?.items || []).filter(item => item.index > this.queue.queueIndex).slice(0, 5);
            home.append(this.phone.el('div', 'player-section-head', this.phone.el('h2', '', '接下来播放'), this.phone.button('查看全部', () => this.go('queue'), '')),
                upcoming.length ? this.phone.el('div', 'player-list', ...upcoming.map(track => this.trackRow(track))) : this.phone.el('p', 'player-empty', '待播清单里还没有后续歌曲'));
        }
        this.body.append(home);
    }
    renderSearch() {
        const query = this.phone.input('search', this.query, '歌曲、歌手或专辑'); query.maxLength = 200; query.setAttribute('aria-label', '搜索 Selene 音乐');
        query.oninput = () => { this.query = query.value; };
        const mode = this.phone.select([['', '跟随 Selene'], ...(this.searchModes || []).map(key => [key, key === 'gd' ? '音乐搜索' : '其他音源'])], this.searchMode || '');
        mode.setAttribute('aria-label', '音乐搜索来源'); mode.onchange = () => { this.searchMode = mode.value; this.cancelSearch(); this.searchPage = null; };
        const form = this.phone.el('form', 'player-search', query, this.phone.button('搜索', () => this.search(false), 'player-search-submit'), mode);
        form.onsubmit = event => { event.preventDefault(); this.search(false); };
        this.body.append(form); this.list = this.phone.el('div', 'player-list'); this.body.append(this.list);
        if (this.searchPage) this.renderPage(this.searchPage);
        else this.list.append(this.phone.el('p', 'player-empty', '搜索由 Selene 完成，结果与操作都来自真实播放器。'));
    }
    cancelSearch() {
        if (!this.searchController) return;
        this.searchController.abort(); this.searchController = null;
        if (this.bridge.has('cancelMusicSearch')) this.bridge.request('cancelMusicSearch', CHANNEL).catch(() => {});
    }
    async search(next = false, offset) {
        if (!this.supports('searchMusic') || !this.active || !this.query.trim()) return;
        this.cancelSearch(); const sequence = ++this.sequence; const query = this.query.trim();
        const controller = new this.phone.host.AbortController(); this.searchController = controller;
        this.message('正在搜索…');
        try {
            const result = await this.bridge.request('searchMusic', query, { channel: CHANNEL, signal: controller.signal, limit: PAGE_SIZE,
                ...(this.searchMode ? { mode: this.searchMode } : {}), ...(next && this.searchPage ? { searchId: this.searchPage.searchId, offset: offset ?? this.searchPage.nextOffset, mode: this.searchPage.mode, source: this.searchPage.source } : {}) });
            if (!this.active || sequence !== this.sequence || controller.signal.aborted || this.tab !== 'search' || this.disposed) return;
            this.searchPage = result; this.message(''); this.renderPage(result);
        } catch (error) { if (this.active && sequence === this.sequence && !controller.signal.aborted) this.message(error.message); }
        finally { if (this.searchController === controller) this.searchController = null; }
    }
    refreshVisible() {
        if (this.refreshQueued || !this.active || !this.bridge.isVisible()) return;
        this.refreshQueued = true;
        Promise.resolve().then(() => { this.refreshQueued = false; if (this.active && !this.disposed) this.load(); });
    }
    load() {
        if (!this.active || !this.bridge.isVisible() || !this.capabilities || this.disposed) return;
        if (this.tab === 'home') return this.readQueue();
        if (this.tab === 'search') return;
        return this.loadList();
    }
    async loadList() {
        const sequence = ++this.sequence;
        const queue = this.tab === 'queue';
        if (!this.supports(queue ? 'getQueueState' : 'getMusicLibrary')) return;
        try {
            const options = { offset: this.offset, limit: PAGE_SIZE };
            const result = queue ? await this.bridge.request('getQueueState', options) : await this.bridge.request('getMusicLibrary', { ...options, kind: this.playlist ? 'playlist' : this.libraryKind, ...(this.playlist ? { playlistId: this.playlist.playlistId } : {}) });
            if (!this.active || sequence !== this.sequence || this.disposed) return;
            if (queue) this.queue = result;
            this.renderPage(result); this.paintPlayback();
        } catch (error) { if (this.active && sequence === this.sequence) this.message(error.message); }
    }
    renderPage(page) {
        if (!this.list || !this.active) return;
        this.list.replaceChildren();
        const playlists = this.tab === 'library' && !this.playlist && this.libraryKind === 'playlists';
        for (const item of (page.items || []).slice(0, PAGE_SIZE)) {
            if (playlists) {
                const button = this.phone.button('', () => this.go('library', { playlist: item }), 'player-playlist');
                button.append(this.art('', 'player-row-art'), this.phone.el('span', '', this.phone.el('strong', '', item.name), this.phone.el('small', '', `${item.trackCount || 0} 首歌曲`)), this.phone.icon('right')); this.list.append(button);
            } else this.list.append(this.trackRow(item));
        }
        if (!this.list.children.length) this.list.append(this.phone.el('p', 'player-empty', playlists ? '还没有歌单，在 Selene 中创建后会显示在这里。' : '这里还没有歌曲'));
        const pagination = this.phone.el('div', 'player-pagination');
        const turn = offset => { if (this.tab === 'search') this.search(true, offset); else { this.offset = offset; this.loadList(); } };
        if (page.offset > 0) pagination.append(this.phone.button('上一页', () => turn(Math.max(0, page.offset - PAGE_SIZE)), ''));
        pagination.append(this.phone.el('small', '', `${page.total || 0} ${playlists ? '个歌单' : '首歌曲'}`));
        if (page.nextOffset != null) pagination.append(this.phone.button('下一页', () => turn(page.nextOffset), ''));
        this.list.append(pagination);
    }
    trackRow(track) {
        const playing = this.queue?.currentTrackId === track.trackId;
        const row = this.phone.el('div', `player-track${playing ? ' is-current' : ''}`); row.dataset.track = track.trackId;
        const open = this.phone.button('', () => this.queue?.currentTrackId === track.trackId && this.bridge.state?.loaded ? this.showFull(true) : this.run('playTrack', track.trackRef), 'player-track-open', `播放 ${track.title || '未知曲目'}`);
        open.disabled = track.playable === false || !this.supports('playTrack');
        open.append(this.art(track.artwork, 'player-row-art'), this.phone.el('span', 'player-track-label', this.phone.el('strong', '', track.title || '未知曲目'), this.phone.el('small', '', track.artist || '未知歌手')));
        const favorite = this.control('heart', track.favorite ? '取消收藏歌曲' : '收藏歌曲', () => this.run('toggleFavorite', track.trackRef));
        favorite.classList.toggle('is-favorite', !!track.favorite); favorite.disabled = !this.supports('toggleFavorite');
        favorite.dataset.favorite = track.trackId;
        const enqueue = this.control('add', '加入待播清单', () => this.run('addToQueue', track.trackRef)); enqueue.disabled = !this.supports('addToQueue') || track.playable === false;
        row.append(open, favorite, enqueue); return row;
    }
    refreshSearchFavorites() {
        // Preserve the exact search-session refs; do not re-search on a favorite event.
        if (!this.searchPage || this.searchController || this.refreshSearchQueued || this.query.trim() !== this.searchPage.query) return;
        this.refreshSearchQueued = true;
        Promise.resolve().then(() => {
            this.refreshSearchQueued = false;
            if (this.active && !this.disposed && this.tab === 'search' && this.searchPage && !this.searchController) this.search(true, this.searchPage.offset);
        });
    }
    optional(method) { return this.bridge.has(method) && this.capabilities?.[method] !== false; }
    lyricsVisible() { return this.active && !this.disposed && this.bridge.isVisible() && !this.full.hidden && this.fullView === 'lyrics'; }
    suspendOptional() {
        this.optionalEpoch++;
        this.lyricsReading = this.optionsReading = this.optionsOperation = null;
        this.phone.host.clearTimeout(this.lyricsFollowTimer); this.lyricsFollowTimer = null;
        this.lyricsBrowsing = this.lyricsDragging = false; this.followLyrics.hidden = true;
    }
    resetOptional() {
        this.suspendOptional(); this.closeSources(false);
        this.optionalApi = this.bridge.api; this.optionalTrack = this.bridge.state?.trackId; this.optionalLoaded = !!this.bridge.state?.loaded;
        this.mode = this.sources = this.lyricsHint = null; this.sourceError = '';
        this.clearLyrics(this.optionalLoaded ? '加载歌词…' : '播放器尚未就绪'); this.paintOptionButtons();
    }
    syncOptional() {
        if (this.optionalApi === this.bridge.api && this.optionalTrack === this.bridge.state?.trackId && this.optionalLoaded === !!this.bridge.state?.loaded) return;
        this.resetOptional();
        if (!this.full.hidden) { this.readPlaybackOptions(); if (this.fullView === 'lyrics') this.readLyrics(); }
    }
    optionalTask() { return { epoch: this.optionalEpoch, api: this.bridge.api, track: this.bridge.state?.trackId }; }
    currentTask(task) {
        return this.active && !this.disposed && this.bridge.isVisible() && task.epoch === this.optionalEpoch && task.api === this.bridge.api && task.track === this.bridge.state?.trackId;
    }
    setFullView(view) {
        this.fullView = view; const lyrics = view === 'lyrics'; this.full.classList.toggle('is-lyrics', lyrics);
        this.fullArt.hidden = lyrics; this.lyricsPane.hidden = !lyrics;
        for (const button of this.viewSwitch.children) button.setAttribute('aria-pressed', String(button.dataset.view === view));
        this.phone.host.clearTimeout(this.lyricsFollowTimer); this.lyricsFollowTimer = null;
        this.lyricsBrowsing = false; this.followLyrics.hidden = true;
        if (!lyrics) this.lyricsReading = null;
        if (lyrics) { this.readLyrics(true); this.paintLyrics(this.bridge.estimatedTime(), true); }
    }
    clearLyrics(message, reset = true) {
        if (reset) this.lyrics = null;
        this.lyricRows = []; this.lyricIndex = -1;
        this.lyricsList.replaceChildren(this.phone.el('p', 'player-lyrics-message', message));
    }
    async readLyrics(force = false) {
        if (!this.lyricsVisible()) return;
        if (!this.optional('getLyricsState')) { this.clearLyrics('当前 Selene 版本暂不支持歌词'); return; }
        if (!this.bridge.state?.loaded || !this.bridge.state.trackId) { this.clearLyrics('尚未播放歌曲'); return; }
        if (this.lyricsReading) {
            if (force || (this.lyricsHint?.revision ?? -1) > this.lyricsReading.revision) this.lyricsReading.dirty = true;
            return;
        }
        const task = { ...this.optionalTask(), revision: this.lyricsHint?.revision ?? -1 }; this.lyricsReading = task;
        try {
            const result = await this.bridge.request('getLyricsState');
            if (!this.currentTask(task) || this.lyricsReading !== task || !this.lyricsVisible()) return;
            if (result?.protocolVersion !== 1 || !Number.isFinite(result.revision)) throw new Error('播放器返回的歌词状态无效');
            if (!result.loaded || result.trackId !== task.track) { this.clearLyrics(result.loaded ? '加载歌词…' : result.message || '播放器尚未就绪'); return; }
            if (task.dirty && result.revision < (this.lyricsHint?.revision ?? -1) || result.revision < (this.lyrics?.revision ?? -1)) return;
            if (this.lyrics?.revision === result.revision) return;
            const lines = result.status === 'ready' && Array.isArray(result.lines) ? result.lines
                .filter(line => Number.isFinite(line?.time) && line.time >= 0 && Array.isArray(line.lines))
                .map(line => ({ time: line.time, lines: line.lines.filter(text => typeof text === 'string') })).sort((a, b) => a.time - b.time) : [];
            this.lyrics = { trackId: result.trackId, revision: result.revision, status: result.status, message: result.message, lines };
            this.lyricIndex = -1;
            if (!lines.length) {
                const fallback = { idle: '尚未播放歌词', loading: '加载歌词…', ready: '暂无歌词', instrumental: '纯音乐 · 请欣赏', unavailable: '暂无歌词', error: '歌词加载失败' };
                this.clearLyrics(result.message || fallback[result.status] || '暂无歌词', false); return;
            }
            this.lyricRows = lines.map(line => {
                const button = this.phone.button('', () => { this.resumeLyrics(); this.run('seekTo', line.time); }, 'player-lyric-line', `跳转到 ${clock(line.time)}`);
                button.append(...(line.lines.length ? line.lines : ['···']).map((text, index) => this.phone.el('span', index ? 'player-lyric-translation' : '', text || '···')));
                return button;
            });
            this.lyricsList.replaceChildren(...this.lyricRows); this.paintLyrics(this.bridge.estimatedTime(), true);
        } catch (error) {
            if (this.currentTask(task) && this.lyricsReading === task && this.lyricsVisible()) this.clearLyrics(error.message);
        } finally {
            if (this.lyricsReading === task) { this.lyricsReading = null; if (task.dirty && this.currentTask(task)) this.readLyrics(); }
        }
    }
    paintLyrics(time, center = false) {
        if (!this.lyricsVisible() || !this.lyricRows.length) return;
        const lines = this.lyrics.lines;
        let low = 0, high = lines.length;
        while (low < high) { const middle = (low + high) >>> 1; if (lines[middle].time <= time) low = middle + 1; else high = middle; }
        const index = low - 1, previous = this.lyricIndex;
        if (index === previous && !center) return;
        this.lyricIndex = index;
        for (const at of new Set([previous - 1, previous, previous + 1, index - 1, index, index + 1])) {
            const row = this.lyricRows[at]; if (!row) continue;
            row.classList.toggle('active', at === index); row.classList.toggle('near', Math.abs(at - index) === 1);
            if (at === index) row.setAttribute('aria-current', 'true'); else row.removeAttribute('aria-current');
        }
        if (!this.lyricsBrowsing) this.centerLyrics();
    }
    centerLyrics() {
        if (!this.lyricsVisible()) return;
        const row = this.lyricRows[Math.max(0, this.lyricIndex)]; if (!row) return;
        const top = this.lyricsList.scrollTop + (row.getBoundingClientRect().top - this.lyricsList.getBoundingClientRect().top) / (this.phone.displayScale || 1) - (this.lyricsList.clientHeight - row.offsetHeight) / 2;
        const reduce = this.phone.host.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        this.lyricsList.scrollTo({ top: Math.max(0, top), behavior: reduce || !this.bridge.state?.playing ? 'instant' : 'smooth' });
    }
    browseLyrics() {
        if (!this.lyricsVisible()) return;
        this.lyricsBrowsing = true; this.followLyrics.hidden = false;
        this.phone.host.clearTimeout(this.lyricsFollowTimer);
        this.lyricsFollowTimer = this.phone.host.setTimeout(() => {
            this.lyricsFollowTimer = null; if (!this.lyricsDragging && this.lyricsVisible()) this.resumeLyrics();
        }, 3500);
    }
    resumeLyrics() {
        this.phone.host.clearTimeout(this.lyricsFollowTimer); this.lyricsFollowTimer = null;
        this.lyricsBrowsing = false; this.followLyrics.hidden = true;
        this.paintLyrics(this.seeking ? Number(this.range.value) : this.bridge.estimatedTime(), true);
    }
    paintOptionButtons() {
        const busy = !!this.optionsOperation, mode = PLAY_MODES[this.mode];
        this.sourceButton.disabled = !this.optional('getPlaybackSources') || !this.bridge.state?.loaded || busy;
        this.sourceButton.title = this.optional('getPlaybackSources') ? '选择播放源' : '当前 Selene 版本暂不支持播放源切换';
        this.modeButton.disabled = !this.optional('getPlayMode') || !this.optional('setPlayMode') || !mode || busy;
        this.modeButton.replaceChildren(this.phone.icon(mode?.[1] || 'repeat'));
        const label = mode ? `播放模式：${mode[0]}` : '当前 Selene 版本暂不支持播放模式或尚未就绪';
        this.modeButton.title = label; this.modeButton.setAttribute('aria-label', label);
    }
    async readPlaybackOptions() {
        if (!this.active || this.disposed || !this.bridge.isVisible() || this.full.hidden) return;
        if (this.optionsOperation) return;
        if (this.optionsReading) { this.optionsReading.dirty = true; return; }
        const task = this.optionalTask(); this.optionsReading = task;
        const methods = ['getPlayMode', 'getPlaybackSources'].filter(method => this.optional(method));
        try {
            const results = await Promise.allSettled(methods.map(method => this.bridge.request(method)));
            if (!this.currentTask(task) || this.optionsReading !== task || this.optionsOperation) return;
            for (const [index, result] of results.entries()) {
                const method = methods[index];
                if (result.status === 'rejected') {
                    if (method === 'getPlaybackSources') this.sourceError = result.reason?.message || '播放源读取失败';
                    else this.message(result.reason?.message || '播放模式读取失败');
                    continue;
                }
                const value = result.value;
                if (method === 'getPlayMode') {
                    if (value?.ok === true && PLAY_MODES[value.mode]) this.mode = value.mode;
                    else this.message('播放器未返回有效播放模式');
                } else if (value?.ok === true && value.trackId === task.track && Array.isArray(value.options) && Array.isArray(value.qualityOptions)) {
                    this.sources = value; this.sourceError = '';
                } else { this.sources = null; this.sourceError = value?.trackId !== task.track ? '正在读取新歌曲的播放源…' : '播放器未返回有效播放源'; }
            }
            this.paintOptionButtons(); this.renderSources();
        } finally {
            if (this.optionsReading === task) { this.optionsReading = null; if (task.dirty && this.currentTask(task)) this.readPlaybackOptions(); }
        }
    }
    openSources() {
        if (!this.optional('getPlaybackSources') || this.full.hidden) return;
        this.sourceOverlay.hidden = false; this.renderSources(); this.sourceSheet.querySelector('button').focus(); this.readPlaybackOptions();
    }
    closeSources(focus = true) {
        const open = !this.sourceOverlay.hidden; this.sourceOverlay.hidden = true;
        if (open && focus && !this.full.hidden && this.active) this.sourceButton.focus({ preventScroll: true });
    }
    renderSources() {
        if (this.sourceOverlay.hidden) return;
        const state = this.sources, busy = !!this.optionsOperation;
        this.sourceSheet.setAttribute('aria-busy', String(busy));
        this.sourcesInfo.textContent = state ? `当前选择：${state.options.find(option => option.id === state.selected)?.label || state.selected || '未选择'}\n实际来源：${state.actualSource || '正在解析，尚未确认'}` : this.sourceError || '正在读取当前歌曲的播放源…';
        this.sourcesFeedback.textContent = busy ? '正在应用，请稍候…' : this.sourceError || '';
        const signature = JSON.stringify([state, busy, this.optional('setPlaybackSource'), this.optional('setS01SQuality')]);
        if (this.sourcesSignature === signature) return;
        this.sourcesSignature = signature; this.sourcesList.replaceChildren();
        if (!state) return;
        const optionButton = (option, selected, method) => {
            const button = this.phone.button('', () => this.changeSource(method, option.id), 'player-source-option');
            button.append(this.phone.el('span', '', option.label || option.id), this.phone.icon('check'));
            button.setAttribute('aria-pressed', String(option.id === selected));
            button.disabled = busy || !this.optional(method) || (method === 'setPlaybackSource' && option.available !== true);
            return button;
        };
        this.sourcesList.append(...state.options.filter(option => typeof option?.id === 'string').map(option => optionButton(option, state.selected, 'setPlaybackSource')));
        if (state.qualityOptions.length) this.sourcesList.append(this.phone.el('h4', '', 'S01S 音质'), ...state.qualityOptions.filter(option => typeof option?.id === 'string').map(option => optionButton(option, state.quality, 'setS01SQuality')));
    }
    async changeSource(method, id) {
        if (this.optionsOperation || !this.optional(method) || !this.sources || this.sources.trackId !== this.bridge.state?.trackId) return;
        const task = this.optionalTask(); this.optionsOperation = task; this.optionsReading = null; this.sourceError = '';
        this.paintOptionButtons(); this.renderSources(); let success = false;
        try {
            const result = await this.bridge.request(method, id);
            if (!this.currentTask(task) || this.optionsOperation !== task) return;
            if (result?.ok !== true || result.trackId !== task.track) throw new Error('播放器未确认此音源操作');
            success = true; this.bridge.connect(true);
        } catch (error) {
            if (this.currentTask(task) && this.optionsOperation === task) { this.sourceError = error.message; this.message(error.message); }
        } finally {
            if (this.optionsOperation === task) {
                this.optionsOperation = null; this.paintOptionButtons(); this.renderSources();
                if (success && this.currentTask(task)) await this.readPlaybackOptions();
            }
        }
    }
    async cyclePlayMode() {
        if (this.optionsOperation || !this.optional('getPlayMode') || !this.optional('setPlayMode')) return;
        const task = this.optionalTask(); this.optionsOperation = task; this.optionsReading = null; this.paintOptionButtons();
        try {
            const current = await this.bridge.request('getPlayMode');
            if (!this.currentTask(task) || this.optionsOperation !== task) return;
            if (current?.ok !== true || !PLAY_MODES[current.mode]) throw new Error('播放器未返回有效播放模式');
            const next = { loop: 'one', one: 'shuffle', shuffle: 'loop' }[current.mode];
            const result = await this.bridge.request('setPlayMode', next);
            if (!this.currentTask(task) || this.optionsOperation !== task) return;
            if (result?.ok !== true || !PLAY_MODES[result.mode]) throw new Error('播放器未确认播放模式');
            this.mode = result.mode; this.message(PLAY_MODES[this.mode][0]);
        } catch (error) { if (this.currentTask(task) && this.optionsOperation === task) this.message(error.message); }
        finally {
            if (this.optionsOperation === task) { this.optionsOperation = null; this.paintOptionButtons(); if (this.currentTask(task)) await this.readPlaybackOptions(); }
        }
    }
    paintPlayback() {
        if (!this.active || this.disposed) return;
        const state = this.bridge.state, loaded = state?.loaded && !!(state.title || state.trackId);
        this.mini.hidden = !loaded || !this.full.hidden;
        this.miniTitle.textContent = this.fullTitle.textContent = loaded ? state.title || '未知曲目' : '尚未播放';
        this.miniArtist.textContent = this.fullArtist.textContent = loaded ? state.artist || '未知歌手' : '';
        this.setArt(this.miniArt, loaded ? state.artwork : ''); this.setArt(this.fullArt, loaded ? state.artwork : '');
        const playing = !!state?.playing;
        for (const button of [this.miniPlay, this.fullPlay]) {
            button.replaceChildren(this.phone.icon(playing ? 'pause' : 'play')); button.setAttribute('aria-label', playing ? '暂停' : '播放'); button.title = playing ? '暂停' : '播放'; button.disabled = !loaded;
        }
        this.range.max = String(state?.duration || 0); this.range.disabled = !loaded || !state.duration;
        if (this.seekTrack !== state?.trackId) this.seeking = false;
        this.favorite.disabled = !this.supports('toggleFavorite') || !this.queue?.currentTrack?.trackRef;
        this.favorite.classList.toggle('is-favorite', !!this.queue?.currentTrack?.favorite);
        this.full.querySelector('[aria-label="打开 Selene 播放器"]').hidden = !this.bridge.has('setVisible');
        this.paintColor();
        this.syncOptional();
        if (!loaded) this.showFull(false);
        this.paintProgress();
    }
    paintColor() {
        this.phone.panel.style.setProperty('--music-color', this.bridge.camera.style.getPropertyValue('--music-color') || '#ba91ac');
    }
    paintProgress() {
        if (!this.active || this.full.hidden || this.seeking) return;
        const current = this.bridge.estimatedTime(), duration = this.bridge.state?.duration || 0;
        this.range.value = String(current); this.elapsed.textContent = clock(current); this.duration.textContent = clock(duration);
        this.range.style.setProperty('--progress', `${duration ? current / duration * 100 : 0}%`);
        this.paintLyrics(current);
    }
    showFull(show) {
        this.phone.panel.classList.toggle('music-full', show);
        this.full.hidden = !show; this.mini.hidden = show || !this.bridge.state?.loaded || !(this.bridge.state.title || this.bridge.state.trackId); this.seeking = false; this.paintProgress();
        if (show) { this.syncOptional(); this.setFullView(this.fullView); this.readPlaybackOptions(); }
        else { this.closeSources(false); this.suspendOptional(); }
    }
    dispose() {
        this.phone.panel.classList.remove('music-full');
        this.cancelSearch(); this.active = false; this.disposed = true; this.sequence++;
        this.suspendOptional(); for (const cleanup of this.uiCleanups.splice(0)) cleanup();
        this.unsubscribe(); this.bridge.setAppActive(false); this.root.remove();
        for (const image of this.root.querySelectorAll('img')) image.onerror = null;
        this.root.replaceChildren(); this.recent = []; this.queue = this.searchPage = this.api = this.capabilities = null;
        this.lyrics = this.sources = this.optionalApi = this.optionalInstance = null; this.lyricRows = [];
        this.lyricsHint = this.sourcesSignature = this.optionalTrack = this.mode = null;
        this.lyricsList.replaceChildren(); this.sourcesList.replaceChildren();
    }
}

module.exports = { MusicApp };
