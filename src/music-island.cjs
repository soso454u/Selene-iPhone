// Optional, UI-only bridge. Never writes playback metadata to phone/story state.
const EVENT = 'selene-music-playback-state';
const METHODS = ['getPlaybackState', 'play', 'pause', 'togglePlayback', 'previousTrack', 'nextTrack', 'seekTo'];
const LIBRARY_METHODS = ['getCapabilities', 'getMusicLibrary', 'getQueueState', 'searchMusic', 'cancelMusicSearch', 'playTrack', 'playPlaylist', 'addToQueue', 'toggleFavorite'];
const DEFAULT_COLOR = '#a99bab';

function musicRoots(host, frame) {
    const roots = [];
    for (const start of [frame, host]) {
        let root = start;
        while (root && !roots.includes(root)) {
            try {
                // Accessing document is the same-origin boundary; never walk sibling frames.
                if (!root.document) break;
                roots.push(root);
                if (root.parent === root) break;
                root = root.parent;
            } catch { break; }
        }
    }
    return roots.reverse();
}

function playbackState(value) {
    if (!value || value.protocolVersion !== 1 || typeof value.loaded !== 'boolean' || typeof value.playing !== 'boolean') return null;
    const number = (key, fallback = 0) => Number.isFinite(value[key]) ? Math.max(0, value[key]) : fallback;
    const text = key => typeof value[key] === 'string' ? value[key].slice(0, key === 'artwork' ? 3 * 1024 * 1024 : 1000) : '';
    return { protocolVersion: 1, loaded: value.loaded, trackId: text('trackId'), title: text('title'), artist: text('artist'), artwork: text('artwork'),
        playing: value.playing, loading: value.loading === true, currentTime: number('currentTime'), duration: number('duration'), playbackRate: number('playbackRate', 1) };
}

function artworkUrl(value, base) {
    if (!value) return '';
    if (/^data:image\/(?:png|jpeg|webp|gif);base64,[a-z\d+/=]+$/i.test(value)) return value;
    try { const url = new URL(value, base); return ['http:', 'https:', 'blob:'].includes(url.protocol) ? url.href : ''; } catch { return ''; }
}

const timeLabel = seconds => { const value = Math.max(0, Math.floor(seconds || 0)); return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`; };

class MusicIsland {
    constructor(phone, frame, enabled = true) {
        this.phone = phone; this.host = phone.host; this.roots = musicRoots(phone.host, frame);
        this.islandEnabled = enabled; this.appActive = false; this.enabled = enabled; this.subscribers = new Set();
        this.disposed = false; this.state = null; this.api = null; this.apiRoot = null; this.cleanups = [];
        this.camera = phone.camera;
        this.art = phone.el('span', 'music-art');
        this.bars = phone.el('span', 'music-bars', ...Array.from({ length: 6 }, () => phone.el('i')));
        this.camera.append(this.art, this.bars);
        this.camera.setAttribute('role', 'button'); this.camera.setAttribute('aria-label', '音乐控制');
        this.camera.setAttribute('aria-expanded', 'false'); this.camera.tabIndex = -1;
        this.card = phone.el('section', 'music-card'); this.card.hidden = true;
        this.card.setAttribute('aria-label', 'Selene 音乐控制');
        this.cardArt = phone.el('div', 'music-card-art');
        this.cardBars = this.bars.cloneNode(true); this.cardBars.classList.add('music-card-bars');
        this.cardBars.setAttribute('aria-hidden', 'true');
        this.title = phone.el('strong'); this.artist = phone.el('span');
        this.range = phone.el('input', 'music-seek'); this.range.type = 'range'; this.range.min = '0'; this.range.max = '0'; this.range.step = '0.1';
        this.range.setAttribute('aria-label', '播放进度');
        this.elapsed = phone.el('span'); this.total = phone.el('span');
        const button = (name, label, callback) => {
            const node = phone.button('', callback, 'music-control', label);
            node.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${name}"/></svg>`;
            return node;
        };
        this.play = button('M8 4v16l13-8Z', '播放', () => this.call('togglePlayback'));
        this.play.classList.add('music-play');
        this.card.append(phone.el('div', 'music-track', this.cardArt, phone.el('div', 'music-metadata', this.title, this.artist), this.cardBars),
            phone.el('div', 'music-progress', this.elapsed, this.range, this.total), phone.el('div', 'music-controls',
                button('M11.5 5.4Q13 4.5 13 6.2v11.6q0 1.7-1.5.8L2 12.8q-1.5-.8 0-1.6Zm10 0Q23 4.5 23 6.2v11.6q0 1.7-1.5.8L12 12.8q-1.5-.8 0-1.6Z', '上一首', () => this.call('previousTrack')), this.play,
                button('M2.5 5.4Q1 4.5 1 6.2v11.6q0 1.7 1.5.8l9.5-5.8q1.5-.8 0-1.6Zm10 0Q11 4.5 11 6.2v11.6q0 1.7 1.5.8l9.5-5.8q1.5-.8 0-1.6Z', '下一首', () => this.call('nextTrack'))));
        phone.panel.append(this.card);
        this.listen(this.camera, 'click', event => {
            event.stopPropagation();
            if (Date.now() < (this.suppressClickUntil || 0) || !this.interactive()) return;
            this.toggleCard();
        });
        this.listen(this.camera, 'keydown', event => {
            if (!this.interactive() || !['Enter', ' ', 'Escape'].includes(event.key)) return;
            event.preventDefault(); event.stopPropagation();
            if (event.key === 'Escape') this.closeCard();
            else if (!event.repeat) this.toggleCard();
        });
        this.listen(this.camera, 'pointerdown', event => this.pointerDown(event));
        this.listen(this.camera, 'pointermove', event => {
            if (!this.gesture || event.pointerId !== this.gesture.id) return;
            if (Math.hypot(event.clientX - this.gesture.x, event.clientY - this.gesture.y) > 8) {
                this.cancelHold(); this.suppressClickUntil = Date.now() + 700;
            }
            event.stopPropagation();
        });
        for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) this.listen(this.camera, type, event => {
            if (!this.gesture) return;
            event.stopPropagation();
            if (type !== 'pointerup' || this.gesture.longPressed) this.suppressClickUntil = Date.now() + 700;
            this.cancelHold(); this.gesture = null;
        });
        this.listen(this.camera, 'contextmenu', event => { if (this.interactive()) { event.preventDefault(); event.stopPropagation(); } });
        for (const type of ['pointerdown', 'pointermove', 'pointerup', 'click', 'dblclick', 'touchstart', 'touchmove']) this.listen(this.card, type, event => event.stopPropagation());
        this.listen(this.card, 'keydown', event => {
            event.stopPropagation(); if (event.key === 'Escape') { event.preventDefault(); this.closeCard(); this.camera.focus({ preventScroll: true }); }
        });
        this.listen(this.range, 'input', () => {
            if (!this.seeking) this.seekTrack = this.state?.trackId;
            this.seeking = true; this.elapsed.textContent = timeLabel(Number(this.range.value));
        });
        this.listen(this.range, 'change', () => {
            const seconds = Number(this.range.value);
            const valid = this.seeking && this.seekTrack === this.state?.trackId;
            this.seeking = false;
            if (valid) this.call('seekTo', seconds);
            this.paintProgress();
        });
        this.listen(this.range, 'pointercancel', () => { this.seeking = false; this.paintProgress(); });
        this.listen(phone.shadow, 'pointerdown', event => {
            const path = event.composedPath();
            if (!path.includes(this.camera) && !path.includes(this.card)) this.closeCard();
        }, true);
        // Outside a closed ShadowRoot the browser intentionally hides its inner path.
        this.listen(phone.doc, 'pointerdown', event => { if (!event.composedPath().includes(phone.root)) this.closeCard(); }, true);
        for (const root of this.roots) this.listen(root, EVENT, event => {
            if (!this.enabled || this.disposed) return;
            this.connect(false);
            if (root !== this.apiRoot) return;
            try { this.accept(playbackState(event.detail)); } catch { this.accept(null); }
        });
        for (const root of this.roots) this.listen(root, 'selene-music-library-state', event => {
            if (!this.enabled || this.disposed) return;
            this.connect(false);
            if (root !== this.apiRoot || event.detail?.protocolVersion !== 2) return;
            this.notify('library', event.detail);
        });
        for (const [eventName, type] of [['selene-music-lyrics-state', 'lyrics'], ['selene-music-playback-options-state', 'options']]) {
            for (const root of this.roots) this.listen(root, eventName, event => {
                if (!this.enabled || this.disposed) return;
                this.connect(false);
                if (root !== this.apiRoot || event.detail?.protocolVersion !== 1) return;
                this.notify(type, event.detail);
            });
        }
        this.listen(phone.doc, 'visibilitychange', () => this.visibility());
        this.connect(true); // Initialization snapshot, including when phone starts after player.
    }

    listen(target, type, callback, options) {
        target.addEventListener(type, callback, options);
        this.cleanups.push(() => target.removeEventListener(type, callback, options));
    }

    find() {
        for (const root of this.roots) {
            try {
                const api = root.__SELENE_MUSIC_PLAYER__;
                if (api && METHODS.every(key => typeof api[key] === 'function')) return { api, root };
            } catch { /* Optional player may be unloading. */ }
        }
        return { api: null, root: null };
    }

    connect(read) {
        if (!this.enabled || this.disposed) return;
        const { api, root } = this.find();
        const changed = this.api !== api || this.apiRoot !== root;
        this.api = api; this.apiRoot = root;
        if (!api) { if (changed || this.state) this.accept(null); return; }
        if (changed || read) {
            try { this.accept(playbackState(api.getPlaybackState())); } catch { this.accept(null); }
        }
        if (changed) this.notify('connection');
    }

    subscribe(callback) { this.subscribers.add(callback); return () => this.subscribers.delete(callback); }
    notify(type, detail) { for (const callback of this.subscribers) { try { callback(type, detail); } catch {} } }
    has(method) { return typeof this.api?.[method] === 'function'; }
    async request(method, ...args) {
        this.connect(false);
        const api = this.api;
        if (this.disposed || !this.enabled || typeof api?.[method] !== 'function') throw new Error('当前播放器未提供此功能');
        const result = await api[method](...args);
        this.connect(false);
        if (this.disposed || api !== this.api) throw new Error('播放器已重新加载，请刷新列表');
        if (result?.ok === false || LIBRARY_METHODS.includes(method) && result?.ok !== true) { const error = new Error(result?.error?.message || '播放器未确认此操作'); error.code = result?.error?.code; throw error; }
        return result;
    }
    interactive() { return this.islandEnabled && this.available(); }
    readCurrent() {
        if (this.enabled) { this.connect(true); return this.state; }
        try { return playbackState(this.find().api?.getPlaybackState()); } catch { return null; }
    }
    estimatedTime() {
        const state = this.state;
        const elapsed = state?.playing && !state.loading ? (this.host.performance.now() - this.sampledAt) / 1000 * state.playbackRate : 0;
        return Math.min(state?.duration || 0, (state?.currentTime || 0) + elapsed);
    }

    available() {
        // Keepalive audio has no loaded music track. Audio elements themselves are never inspected.
        return this.enabled && this.state?.loaded && !!(this.state.trackId || this.state.title) && this.state.duration > 0;
    }

    accept(state) {
        if (this.disposed) return;
        const previous = this.state;
        this.state = state; this.sampledAt = this.host.performance.now();
        if (previous?.trackId !== state?.trackId || previous?.title !== state?.title) this.seeking = false;
        const available = this.interactive();
        const playing = available && state.playing;
        this.camera.classList.toggle('music-playing', !!playing);
        this.card.classList.toggle('music-playing', !!playing);
        this.host.clearTimeout(this.collapseTimer);
        if (playing) this.camera.classList.add('music-active');
        else if (available && this.camera.classList.contains('music-active') && this.isVisible()) {
            this.collapseTimer = this.host.setTimeout(() => { this.camera.classList.remove('music-active'); this.camera.tabIndex = this.card.hidden ? -1 : 0; }, 650);
        } else this.camera.classList.remove('music-active');
        this.camera.tabIndex = available && (playing || !this.card.hidden || this.camera.classList.contains('music-active')) ? 0 : -1;
        if (!available) this.closeCard();
        this.title.textContent = state?.title || '未知曲目'; this.artist.textContent = state?.artist || '未知歌手';
        this.play.setAttribute('aria-label', playing ? '暂停' : '播放'); this.play.title = playing ? '暂停' : '播放';
        this.play.querySelector('path').setAttribute('d', playing ? 'M5.5 3h3Q10 3 10 4.5v15Q10 21 8.5 21h-3Q4 21 4 19.5v-15Q4 3 5.5 3Zm10 0h3Q20 3 20 4.5v15Q20 21 18.5 21h-3Q14 21 14 19.5v-15Q14 3 15.5 3Z' : 'M7 4.8Q7 3 8.5 4l12 7q1.5 1 0 2l-12 7Q7 21 7 19.2Z');
        this.range.max = String(state?.duration || 0); this.range.disabled = !available;
        const artwork = available ? artworkUrl(state.artwork, this.phone.doc.baseURI) : '';
        if (this.artwork !== artwork) this.updateArtwork(artwork);
        this.paintProgress(); this.scheduleProgress();
        this.notify('playback');
    }

    updateArtwork(url) {
        this.artwork = url;
        this.camera.style.setProperty('--music-color', DEFAULT_COLOR);
        this.card.style.setProperty('--music-color', DEFAULT_COLOR);
        this.host.clearTimeout(this.artTimer);
        // Retain only the currently displayed cover during a quick series of track changes.
        for (const image of this.art.querySelectorAll('img:not(.current)')) { image.onload = image.onerror = null; image.remove(); }
        if (!url) { this.art.replaceChildren(); this.cardArt.replaceChildren(); return; }
        const image = this.phone.el('img'); image.alt = ''; image.referrerPolicy = 'no-referrer'; image.decoding = 'async';
        image.onload = () => {
            image.onload = image.onerror = null;
            if (this.disposed || this.artwork !== url || !image.isConnected) return;
            for (const old of this.art.querySelectorAll('img.current')) old.classList.remove('current');
            image.classList.add('current'); this.sampleColor(image, url);
            this.artTimer = this.host.setTimeout(() => { for (const old of this.art.querySelectorAll('img:not(.current)')) old.remove(); }, 320);
        };
        image.onerror = () => { image.onload = image.onerror = null; if (this.artwork === url) { this.art.replaceChildren(); this.cardArt.replaceChildren(); } };
        this.art.append(image); image.src = url;
        const cardImage = this.phone.el('img'); cardImage.alt = ''; cardImage.referrerPolicy = 'no-referrer'; cardImage.src = url;
        this.cardArt.replaceChildren(cardImage);
    }

    sampleColor(image, source) {
        try {
            const url = new URL(source, this.phone.doc.baseURI);
            // No CORS retry, proxy or second image request just to obtain a color.
            if (url.protocol !== 'data:' && url.origin !== this.host.location.origin) return;
            const canvas = this.phone.doc.createElement('canvas'); canvas.width = canvas.height = 8;
            const context = canvas.getContext('2d', { willReadFrequently: true });
            context.drawImage(image, 0, 0, 8, 8);
            const pixels = context.getImageData(0, 0, 8, 8).data;
            let total = 0, red = 0, green = 0, blue = 0;
            for (let i = 0; i < pixels.length; i += 4) {
                const max = Math.max(...pixels.slice(i, i + 3)), min = Math.min(...pixels.slice(i, i + 3));
                if (pixels[i + 3] < 180 || max < 30 || min > 235) continue;
                const weight = 1 + (max - min) / 40;
                total += weight; red += pixels[i] * weight; green += pixels[i + 1] * weight; blue += pixels[i + 2] * weight;
            }
            if (!total) return;
            const rgb = [red, green, blue].map(value => Math.round(45 + value / total * .72));
            this.camera.style.setProperty('--music-color', `rgb(${rgb.join(',')})`);
            this.card.style.setProperty('--music-color', `rgb(${rgb.join(',')})`);
            this.notify('appearance');
        } catch { /* Tainted/unsupported image: muted default color. */ }
    }

    isVisible() { return this.phone.visible && !this.phone.doc.hidden; }

    setEnabled(enabled) {
        if (this.islandEnabled === enabled) return;
        this.islandEnabled = enabled; this.enabled = enabled || this.appActive;
        if (this.enabled) { this.connect(true); this.accept(this.state); }
        else { this.api = this.apiRoot = null; this.accept(null); }
        this.visibility();
    }

    setAppActive(active) {
        if (this.appActive === active) return;
        this.appActive = active; this.enabled = this.islandEnabled || active;
        if (!this.enabled) { this.api = this.apiRoot = null; this.accept(null); }
        this.visibility();
    }

    visibility() {
        this.host.clearTimeout(this.watchTimer); this.watchTimer = null;
        this.host.clearTimeout(this.progressTimer); this.progressTimer = null;
        this.camera.classList.toggle('music-visible', this.islandEnabled && this.isVisible());
        this.card.classList.toggle('music-visible', this.islandEnabled && this.isVisible());
        this.notify('visibility');
        if (!this.enabled || !this.isVisible()) {
            this.closeCard(); this.cancelHold(); this.gesture = null;
            this.host.clearTimeout(this.collapseTimer); this.camera.classList.remove('music-active');
            return;
        }
        this.connect(true);
        const watch = () => {
            if (this.disposed || !this.enabled || !this.isVisible()) return;
            // Identity/capability check only: playback snapshots are event-driven.
            this.connect(false); this.watchTimer = this.host.setTimeout(watch, 4000);
        };
        this.watchTimer = this.host.setTimeout(watch, 4000);
        this.scheduleProgress();
    }

    pointerDown(event) {
        if (!this.interactive()) return;
        event.stopPropagation();
        if (event.button !== 0) return;
        this.cancelHold(); this.gesture = { id: event.pointerId, x: event.clientX, y: event.clientY };
        this.camera.setPointerCapture(event.pointerId);
        this.holdTimer = this.host.setTimeout(() => {
            this.holdTimer = null; this.suppressClickUntil = Date.now() + 900;
            if (this.gesture) this.gesture.longPressed = true;
            this.closeCard(); this.call('setVisible', true, { expand: true });
        }, 520);
    }

    cancelHold() { this.host.clearTimeout(this.holdTimer); this.holdTimer = null; }

    async call(method, ...args) {
        if (this.disposed || !this.enabled) return;
        this.connect(false);
        const api = this.api;
        if (!api || typeof api[method] !== 'function') return;
        try { await this.request(method, ...args); } catch { /* Player errors stay out of RP and notifications. */ }
        if (!this.disposed && this.enabled) this.connect(true);
    }

    toggleCard() {
        if (!this.card.hidden) { this.closeCard(); return; }
        this.connect(true);
        if (!this.available() || !this.isVisible()) return;
        this.card.hidden = false; this.camera.classList.add('music-card-open'); this.camera.setAttribute('aria-expanded', 'true');
        this.paintProgress(); this.scheduleProgress();
    }

    closeCard() {
        this.card.hidden = true; this.seeking = false;
        this.camera.classList.remove('music-card-open'); this.camera.setAttribute('aria-expanded', 'false');
        this.host.clearTimeout(this.progressTimer); this.progressTimer = null;
        if (this.appActive) this.scheduleProgress();
    }

    paintProgress() {
        if (this.card.hidden || this.seeking) return;
        const state = this.state;
        const current = this.estimatedTime();
        this.range.value = String(current); this.elapsed.textContent = timeLabel(current); this.total.textContent = timeLabel(state?.duration);
        this.range.style.setProperty('--music-progress', `${state?.duration ? current / state.duration * 100 : 0}%`);
    }

    scheduleProgress() {
        this.host.clearTimeout(this.progressTimer); this.progressTimer = null;
        if (this.disposed || (this.card.hidden && !this.appActive) || !this.isVisible() || !this.available() || !this.state?.playing || this.state.loading) return;
        this.progressTimer = this.host.setTimeout(() => {
            this.paintProgress();
            this.notify('progress');
            if (this.host.performance.now() - this.sampledAt > 15000) this.connect(true);
            else this.scheduleProgress();
        }, 500);
    }

    dispose() {
        this.disposed = true;
        for (const cleanup of this.cleanups.splice(0)) cleanup();
        for (const timer of ['watchTimer', 'progressTimer', 'collapseTimer', 'holdTimer', 'artTimer']) { this.host.clearTimeout(this[timer]); this[timer] = null; }
        for (const image of this.art.querySelectorAll('img')) image.onload = image.onerror = null;
        this.art.replaceChildren(); this.card.remove(); this.camera.replaceChildren();
        this.api = this.apiRoot = this.state = this.gesture = null; this.roots = []; this.artwork = '';
        this.subscribers.clear();
        this.camera.classList.remove('music-active', 'music-playing', 'music-visible', 'music-card-open');
    }
}

module.exports = { MusicIsland, musicRoots, playbackState, artworkUrl };
