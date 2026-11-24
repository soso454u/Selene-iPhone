const { postSyncEnabled } = require('./sync.cjs');
const { characterReferenceRows, IMAGE_PROMPT_FIELDS } = require('./image-service.cjs');
const { DEFAULT_IMAGE_RULES, IMAGE_RULES_LIMIT, isEnglishPrompt } = require('./image-rules.cjs');
const css = require('./style.cjs');
const { PLAYER, label, threadKey, digest, socialNickname } = require('./domain.cjs');
const { photoSource } = require('./photos.cjs');
const { PLATFORM_RULES, postCounts, SOCIAL_COMMON_PROMPT } = require('./phone-preset.cjs');
const { STICKERS, PLATFORMS, safeUrl, reactions, notificationRows, xHandle, xSideStory } = require('./media.cjs');
const { PAGES, WALLPAPERS, BACKGROUNDS, backgroundStyle } = require('./backgrounds.cjs');
const { MusicIsland } = require('./music-island.cjs');
const { MusicApp } = require('./music-app.cjs');
const { CharacterPhone } = require('./character-phone.cjs');
const { wallpaperSource } = require('./wallpapers.cjs');
const { chatTimeline } = require('./chat-time.cjs');
const { contactDeleted } = require('./conversations.cjs');

const ICONS = {
    characterPhone: '<rect x="6" y="2" width="12" height="20" rx="3"/><circle cx="12" cy="9" r="2"/><path d="M8 16a4 4 0 0 1 8 0m-6 3h4"/>',
    cart: '<path d="M2 3h3l3 12h11l3-8H6M9 19h.01M18 19h.01"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/>',
    music: '<path d="M9 17V6l12-3v12M9 10l12-3"/><ellipse cx="6" cy="18" rx="3" ry="2.5" fill="currentColor"/><ellipse cx="18" cy="16" rx="3" ry="2.5" fill="currentColor"/>',
    play: '<path d="M7 4.5Q7 3 8.5 4l12 7q1.5 1 0 2l-12 7Q7 21 7 19.5Z" fill="currentColor" stroke="none"/>',
    pause: '<rect x="5" y="3" width="5" height="18" rx="1.5" fill="currentColor" stroke="none"/><rect x="14" y="3" width="5" height="18" rx="1.5" fill="currentColor" stroke="none"/>',
    previous: '<path d="m12 5-10 7 10 7V5Zm10 0-10 7 10 7V5Z" fill="currentColor" stroke-linejoin="round"/>',
    next: '<path d="m2 5 10 7-10 7V5Zm10 0 10 7-10 7V5Z" fill="currentColor" stroke-linejoin="round"/>',
    queue: '<path d="M4 5h16M4 10h16M4 15h9M4 20h9m3-5 5 3-5 3Z"/>',
    repeat: '<path d="m16 3 4 4-4 4M4 11V9a2 2 0 0 1 2-2h14M8 21l-4-4 4-4m12 0v2a2 2 0 0 1-2 2H4"/>',
    'repeat-1': '<path d="m16 3 4 4-4 4M4 11V9a2 2 0 0 1 2-2h14M8 21l-4-4 4-4m12 0v2a2 2 0 0 1-2 2H4m7-7 2-1v6"/>',
    shuffle: '<path d="M3 6h3c5 0 7 12 12 12h3m-4-4 4 4-4 4M3 18h3c2 0 4-3 6-6s4-6 6-6h3m-4-4 4 4-4 4"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    launcher: '<rect x="5.5" y="1.5" width="13" height="21" rx="3.5"/><rect x="8" y="6" width="8" height="10" rx="1.5" fill="currentColor" fill-opacity=".1" stroke-width="1.2"/><path d="M10 4h4m-4 6h4m-4 3h2m-.3 6.8h.6"/>',
    x: '<path d="M5 3h4l11 18h-4L5 3Zm15 0L4 21"/>',
    album: '<rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8" cy="8" r="2"/><path d="m3 17 6-6 4 4 3-4 5 6"/>',
    imagegen: '<rect x="3" y="6" width="17" height="15" rx="3"/><path d="m4 17 5-5 4 4 4-5 3 4m-2-14 1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3Z"/>',
    phone: '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 18h4"/>',
    messages: '<path d="M20 11a8 8 0 0 1-8 8H5l1.9-3.2A8 8 0 1 1 20 11Z"/><path d="M9 11h.01M12 11h.01M15 11h.01"/>',
    contacts: '<rect x="5" y="3" width="15" height="18" rx="3"/><circle cx="12.5" cy="9" r="2.2"/><path d="M8.7 15.7a4.1 4.1 0 0 1 7.6 0M3 7h3M3 12h3M3 17h3"/>',
    moments: '<circle cx="12" cy="12" r="8.2"/><path d="m12 4 4.4 7.3M20 8.5h-9M20 15l-4.8-7.3M12 20l-4.4-7.3M4 15.5h9M4 9l4.8 7.3"/>',
    notifications: '<path d="M7 10a5 5 0 0 1 10 0v4l2 3H5l2-3Zm3 10a2.3 2.3 0 0 0 4 0"/>',
    settings: '<path d="M10 3h4l.6 2.3 1.7.9 2.4-.6 2 3.4-1.8 1.6v2.7l1.8 1.6-2 3.4-2.4-.6-1.7 1L14 21h-4l-.6-2.3-1.7-.9-2.4.6-2-3.4 1.8-1.6v-2.7L3.3 9l2-3.4 2.4.6 1.7-.9Z"/><circle cx="12" cy="12" r="2.7"/>',
    debug: '<path d="M4 5h16v14H4zM8 9l3 3-3 3m5 0h3"/>',
    home: '<path d="m3 10 9-7 9 7v11h-6v-7H9v7H3Z"/>',
    bookmark: '<path d="M6 3h12v19l-6-4-6 4V3Z"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 22v-2a8 8 0 0 1 16 0v2"/>',
    back: '<path d="m14 6-6 6 6 6"/>',
    right: '<path d="m9 6 6 6-6 6"/>',
    add: '<path d="M12 5v14M5 12h14"/>',
    close: '<path d="M5 12h14"/>',
    lock: '<rect x="6" y="10" width="12" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v2"/>',
    send: '<path d="M12 19V5m-5 5 5-5 5 5"/>',
    search: '<circle cx="10.5" cy="10.5" r="5.4"/><path d="m15 15 4 4"/>',
    spark: '<path d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2L12 2Z"/>',
    check: '<path d="m5 12 4 4 10-10"/>',
    wifi: '<path d="M3 9a14 14 0 0 1 18 0M6 12a9 9 0 0 1 12 0m-9 3a4.5 4.5 0 0 1 6 0m-3 3h.01"/>',
    battery: '<rect x="2" y="6" width="17" height="12" rx="3"/><path d="M22 10v4M5 12h11"/>',
    redbook: '<path d="M5 5h6v14H5zM14 5h5v14h-5M3 9h10M14 10h7M14 14h7"/>',
    douyin: '<path d="M14 3v12a4 4 0 1 1-4-4M14 3c0 4 3 6 6 6" stroke-width="3"/>',
    weibo: '<ellipse cx="11" cy="14" rx="8" ry="6"/><ellipse cx="10" cy="15" rx="3" ry="2"/><path d="M15 3a7 7 0 0 1 7 7M15 6a4 4 0 0 1 4 4M5 9l3-4 2 4"/>',
    forum: '<path d="M3 4h15v11H9l-5 4v-4H3zM18 8h3v12l-4-3h-4"/>',
    video: '<rect x="3" y="6" width="12" height="12" rx="3"/><path d="m15 10 6-3v10l-6-3"/>',
    camera: '<path d="M3 7h4l2-3h6l2 3h4v13H3Z"/><circle cx="12" cy="13" r="4"/>',
    gift: '<rect x="3" y="8" width="18" height="5" rx="1"/><path d="M5 13v8h14v-8M12 8v13M12 8C3 8 6 0 10 4l2 4Zm0 0c9 0 6-8 2-4l-2 4Z"/>',
    envelope: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M5 7c4 5 10 5 14 0"/><circle cx="12" cy="11" r="1.5"/>',
    transfer: '<path d="M3 8h17l-5-5M21 16H4l5 5"/>',
    link: '<path d="m10 14 4-4M8 16l-2 2a3 3 0 0 1-4-4l5-5a3 3 0 0 1 4 0m2 6a3 3 0 0 0 4 0l5-5a3 3 0 0 0-4-4l-2 2"/>',
    voice: '<path d="m9 8-4 4 4 4M12 6a9 9 0 0 1 0 12M16 3a13 13 0 0 1 0 18"/>',
    keyboard: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 9h1m3 0h1m3 0h1m3 0h1M6 12h1m3 0h1m3 0h1m3 0h1M7 16h10"/>',
    copy: '<rect x="8" y="8" width="12" height="13" rx="1"/><path d="M16 8V3H3v13h5"/>',
    edit: '<path d="M12 4H4v16h16v-8M10 14l1-5L19 1l4 4-8 8-5 1Z"/>',
    trash: '<path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/>',
    quote: '<path d="M4 5h7v7H7v6H3v-7l1-6Zm11 0h7v7h-4v6h-4v-7l1-6Z"/>',
    sync: '<path d="M4 8a9 9 0 0 1 15-3l2 3m-5 0h5V3M20 16a9 9 0 0 1-15 3l-2-3m5 0H3v5"/>',
    smile: '<circle cx="12" cy="12" r="9"/><path d="M8 14a4 4 0 0 0 8 0M8 9h.01M16 9h.01"/>',
    photo: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8" cy="9" r="1.5"/><path d="m3 17 5-5 4 4 4-6 5 6"/>',
    location: '<path d="M19 10c0 5-7 12-7 12S5 15 5 10a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',
    heart: '<path d="M20 5c-3-3-6-1-8 1-2-2-5-4-8-1-5 5 3 11 8 15 5-4 13-10 8-15Z"/>',
    star: '<path d="m12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z"/>',
    share: '<path d="m14 3 7 6-7 6V9C8 9 5 12 3 19 3 9 6 5 14 5Z"/>',
    mention: '<circle cx="12" cy="12" r="4"/><path d="M16 8v7c0 3 6 2 6-3a10 10 0 1 0-4 8"/>',
    more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    mic: '<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M6 11v2a6 6 0 0 0 12 0v-2M12 19v3m-3 0h6"/>',
    palette: '<path d="M12 3a9 9 0 1 0 0 18c2 0 3-1 2-3s0-3 2-3h2c5 0 3-12-6-12Z"/><circle cx="8" cy="8" r="1"/><circle cx="13" cy="6" r="1"/><circle cx="17" cy="9" r="1"/>',
};
const APP_ART = {
    music: '<path d="M10 5.5 20 3v12.5c0 2.4-5.5 3.9-5.5 1 0-1.7 2.3-2.6 3.7-2.7V7L12 8.5v10c0 2.4-5.5 3.9-5.5 1 0-1.7 2.3-2.6 3.5-2.7Z" fill="#fff" stroke="none"/>',
    notifications: '<path d="M6.5 10c0-7.8 11-7.8 11 0v4l2 3H4.5l2-3Zm3.2 9h4.6a2.4 2.4 0 0 1-4.6 0" fill="#fff" stroke="none"/>',
    imagegen: '<path d="m12 2 2.7 7.3L22 12l-7.3 2.7L12 22l-2.7-7.3L2 12l7.3-2.7Z" fill="#6e83d5" stroke="none"/><path d="m12 5 1.8 5.2L19 12l-5.2 1.8L12 19l-1.8-5.2L5 12l5.2-1.8Z" fill="#bea5e5" stroke="none"/><path d="M12 8v8m-4-4h8" stroke="#fff" stroke-width="1.5"/>',
    debug: '<rect x="3" y="3" width="18" height="18" rx="5" fill="#fff" fill-opacity=".92" stroke="none"/><path d="M6 12h3l2-5 3 10 2-5h2" stroke="#63748e" stroke-width="1.6" fill="none"/>',
    x: '<path d="M5 3h4l11 18h-4L5 3Zm15 0L4 21" fill="#fff" stroke="#fff" stroke-width=".7"/>',
    album: '<g fill-opacity=".82" stroke="none"><ellipse cx="12" cy="6" rx="3.4" ry="5" fill="#ff786a"/><ellipse cx="12" cy="18" rx="3.4" ry="5" fill="#8d91e9"/><ellipse cx="6" cy="12" rx="5" ry="3.4" fill="#ef95bd"/><ellipse cx="18" cy="12" rx="5" ry="3.4" fill="#8cce8a"/><ellipse cx="8" cy="8" rx="3.4" ry="5" transform="rotate(-45 8 8)" fill="#ffb76c"/><ellipse cx="16" cy="8" rx="3.4" ry="5" transform="rotate(45 16 8)" fill="#e5d96e"/><ellipse cx="8" cy="16" rx="3.4" ry="5" transform="rotate(45 8 16)" fill="#ada1e5"/><ellipse cx="16" cy="16" rx="3.4" ry="5" transform="rotate(-45 16 16)" fill="#79c9dc"/></g>',
    messages: '<path fill="white" stroke="none" d="M12 3c-6 0-10 3.5-10 8s4 8 10 8h2l5 3-1-5c3-2 4-4 4-6 0-4.5-4-8-10-8Z"/>',
    contacts: '<rect x="3" y="2" width="18" height="20" rx="4" fill="#f4efe7" stroke="none"/><path d="M18 3h3v4h-3z" fill="#d3ab80" stroke="none"/><circle cx="11" cy="9" r="3" fill="#a18b75" stroke="none"/><path d="M5 18a6 6 0 0 1 12 0" fill="#a18b75" stroke="none"/>',
    moments: '<path d="M14 9c0 4-3 6-6 6H6l-3 2 1-4C0 8 5 3 9 4c3 0 5 2 5 5Z" fill="#fff" stroke="none"/><path d="M22 15c0 3-3 5-6 5h-1l-3 2 1-3c-5-3-3-9 2-9 4 0 7 2 7 5Z" fill="#fff" stroke="#29bb63" stroke-width=".8"/><circle cx="6" cy="8" r=".8" fill="#29bb63"/><circle cx="10" cy="8" r=".8" fill="#29bb63"/><circle cx="14" cy="14" r=".8" fill="#29bb63"/><circle cx="18" cy="14" r=".8" fill="#29bb63"/>',
    redbook: '<text x="12" y="15.3" text-anchor="middle" fill="white" stroke="none" font-family="PingFang SC,Microsoft YaHei,sans-serif" font-size="7.5" font-weight="800">小红书</text>',
    douyin: '<path d="M14 3v12a4 4 0 1 1-4-4M14 3c0 4 3 6 6 6" stroke="white" stroke-width="3.6" fill="none"/>',
    weibo: '<path d="M4 12c2-5 6-7 8-4 5-3 10 0 9 5 0 5-6 8-12 7-6-1-8-5-5-8Z" fill="white" stroke="none"/><ellipse cx="11" cy="14" rx="5" ry="3.5" fill="#f47528" stroke="none"/><ellipse cx="10" cy="14" rx="2" ry="1.7" fill="white" stroke="none"/><path d="M15 3a7 7 0 0 1 7 7m-7-4a4 4 0 0 1 4 4" stroke="white" stroke-width="1.8" fill="none"/>',
    settings: '<path d="m9 2 1 3h4l1-3 3 2-1 3 2 2 3-1v5l-3 1-1 2 2 2-4 3-2-2h-3l-2 2-4-3 2-3-1-2-3-1V8l3 1 2-2-1-3Z" fill="#d8dbe2" stroke="#66707d" stroke-width=".7"/><circle cx="12" cy="12" r="5" fill="#737d8d" stroke="#f6f8fc" stroke-width="1.3"/><circle cx="12" cy="12" r="2.4" fill="#e6e9ef" stroke="none"/>',
    forum: '<rect x="3" y="3" width="18" height="16" rx="5" fill="white" stroke="none"/><path d="m7 18-2 4 7-4" fill="white" stroke="none"/><path d="M7 8h10M7 12h7" stroke="#2b76de" stroke-width="1.8"/>',
};
const APPS = {
    characterPhone: ['角色手机', 'violet', '查看角色的聊天、备忘录、浏览记录和购物车'],
    music: ['音乐', 'rose', 'Selene 音乐播放器'],
    messages: ['消息', 'green', '私聊与群聊'], contacts: ['通讯录', 'blue', '角色与联系人'], moments: ['朋友圈', 'sunset', '角色动态'],
    notifications: ['通知', 'rose', '近期互动'], settings: ['设置', 'steel', '预设与外观'], debug: ['调试', 'violet', '上下文与交接'],
    redbook: ['小红书', 'rose', '图文与生活'], douyin: ['抖音', 'steel', '竖屏与记录'], weibo: ['微博', 'sunset', '话题与转发'], forum: ['论坛', 'blue', '帖子与讨论'], x: ['X', 'steel', '短动态与转发'], album: ['相册', 'pearl', '保存的图片与角色相册'], imagegen: ['生图', 'violet', '根据画面描述生成图片'],
};

class Phone {
    constructor(host, settings, action, status, frame = host, resolveWallpaper = null) {
        Object.assign(this, { host, doc: host.document, action, status, resolveWallpaper, visible: false, view: 'home', search: '', draft: '', quote: '', actors: new Map(), rememberScroll: false });
        this.settingsSections = new Set();
        this.feedTabs = new Map();
        this.root = this.el('div');
        this.root.id = 'tavern-pocket-host';
        Object.assign(this.root.style, { position: 'fixed', inset: '0', zIndex: '2147483000', pointerEvents: 'none' });
        this.shadow = this.root.attachShadow({ mode: 'closed' });
        this.shadow.append(this.el('style', '', css));
        this.launch = this.button('', event => { if (Date.now() < (this.launchClickAfter || 0)) { event.preventDefault(); return; } this.open(); }, 'launcher', '打开Selene手机');
        this.launch.append(this.icon('launcher'));
        this.launch.title = 'Selene手机 · 点击打开，拖动调整位置';
        this.panel = this.el('section', 'phone');
        this.panel.setAttribute('aria-label', 'Selene手机');
        this.panel.hidden = true;
        this.statusBar = this.el('div', 'status');
        this.clock = this.el('span', 'clock');
        this.camera = this.el('div', 'camera');
        this.statusBar.append(this.clock, this.camera, this.el('span', 'signals', this.icon('wifi'), this.icon('battery')));
        this.statusBar.title = '拖动手机到你喜欢的位置';
        this.nav = this.el('header', 'nav');
        this.banner = this.el('div', 'banner');
        this.banner.setAttribute('role', 'status'); this.banner.hidden = true;
        this.busyMessage = this.el('span', 'notice-message');
        this.busySpinner = this.el('span', 'activity-spinner');
        this.busyCancel = this.button('取消', () => this.action('cancel'), 'activity-cancel', '取消当前任务');
        this.busyClear = this.button('清空队列', () => this.action('clearRequestQueue'), 'activity-cancel', '清空待执行请求');
        this.busyCancel.hidden = this.busyClear.hidden = true;
        this.busy = this.el('div', 'busy', this.busyMessage, this.busySpinner, this.busyCancel, this.busyClear); this.busy.hidden = true;
        this.busy.setAttribute('role', 'status');
        const notices = this.el('div', 'phone-notices', this.el('div', 'notice-stack', this.banner, this.busy));
        this.content = this.el('main', 'content');
        this.home = this.button('', () => this.view === 'characterPhone' && this.characterPhone.app !== 'home' ? this.characterPhone.home() : this.navigate('home'), 'home-indicator', '返回主屏幕');
        this.panel.append(this.statusBar, this.nav, notices, this.content, this.home);
        this.shadow.append(this.launch, this.panel);
        this.doc.body.append(this.root);
        this.shadow.addEventListener('focusin', event => {
            if (!this.visible || !this.textInput(event.target)) return;
            this.keyboardLayout ??= { viewport: this.restingViewport || this.viewport(), layoutHeight: this.doc.documentElement.clientHeight, scale: this.displayScale || 1, height: this.panel.offsetHeight, position: this.position?.slice() };
            this.bound();
        });
        this.shadow.addEventListener('focusout', () => {
            this.host.clearTimeout(this.keyboardTimer);
            this.keyboardTimer = this.host.setTimeout(() => this.bound(), 0);
        });
        this.resize = () => { this.bound(); this.boundLauncher(); };
        host.addEventListener('resize', this.resize);
        host.visualViewport?.addEventListener('resize', this.resize);
        host.visualViewport?.addEventListener('scroll', this.resize);
        this.installDrag();
        this.installLauncherDrag();
        this.installWandMenu();
        this.musicIsland = new MusicIsland(this, frame, settings.musicIsland !== false);
        this.musicApp = new MusicApp(this, this.musicIsland);
        this.characterPhone = new CharacterPhone(this);
        this.appearance(settings);
    }

    el(tag, classes = '', ...children) {
        const node = this.doc.createElement(tag);
        if (classes) node.className = classes;
        node.append(...children.filter(child => child !== null && child !== undefined));
        return node;
    }

    icon(name) {
        const node = this.doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
        node.setAttribute('viewBox', '0 0 24 24');
        node.setAttribute('fill', 'none');
        node.setAttribute('stroke', 'currentColor');
        node.setAttribute('stroke-width', '1.8');
        node.setAttribute('stroke-linecap', 'round');
        node.setAttribute('stroke-linejoin', 'round');
        node.setAttribute('aria-hidden', 'true');
        node.innerHTML = ICONS[name] || ICONS.moments;
        return node;
    }

    button(text, callback, classes = '', title = '') {
        const result = this.el('button', classes, text || null);
        result.type = 'button';
        if (title) { result.title = title; result.setAttribute('aria-label', title); }
        result.addEventListener('click', callback);
        return result;
    }

    iconButton(icon, title, callback, classes = '') {
        const button = this.button('', callback, `icon-button ${classes}`, title);
        button.append(this.icon(icon));
        return button;
    }

    appIcon(name) { const node = this.icon(name); if (APP_ART[name]) node.innerHTML = APP_ART[name]; return node; }

    avatar(person, size = '') {
        const node = this.el('span', `avatar ${size}`, (person?.name || '?').trim().slice(0, 1));
        if (person?.avatar) {
            const image = this.el('img'); image.alt = ''; image.loading = 'lazy';
            try {
                const url = new URL(person.avatar, this.doc.baseURI);
                if (safeUrl(url.href) || (person.id === PLAYER && /^data:image\/(png|jpeg|webp|gif);base64,[a-zA-Z0-9+/=]+$/.test(person.avatar))) { image.src = url.href; node.append(image); }
            } catch { return node; }
            image.addEventListener('error', () => image.remove(), { once: true });
        }
        return node;
    }

    open() {
        if (this.view === 'settings') this.settingsSections.clear();
        this.visible = true; this.panel.hidden = false; this.launch.hidden = true;
        this.musicIsland.visibility();
        this.bound(); this.render(this.state);
        this.action('open');
    }

    minimize() {
        this.musicApp.setActive(false);
        this.closeDialog();
        this.visible = false; this.panel.hidden = true; this.launch.hidden = this.settings.showLauncher === false;
        this.musicIsland.visibility();
        this.boundLauncher();
        this.content.replaceChildren(); this.state = null;
        if (!this.launch.hidden) this.launch.focus();
    }

    navigate(view, thread = null, notify = true) {
        this.flushAutosaves();
        if (view !== 'music') this.musicApp.setActive(false);
        this.musicIsland.closeCard();
        this.closeDialog();
        if (view === 'settings') this.settingsSections.clear();
        if (view !== this.view || thread !== this.thread) {
            this.draft = ''; this.quote = ''; this.search = ''; this.rememberScroll = false; this.chatExtras = false; this.chatStickers = false; this.voiceMode = false; this.voiceDraft = '';
        }
        this.view = view; this.thread = thread;
        if (view === 'music') { this.render(this.state); return; }
        this.content.replaceChildren(this.el('p', 'empty', view === 'lock' ? '' : '正在读取…'));
        if (view === 'lock') { this.render(this.state); return; }
        if (notify) this.action('refresh');
    }

    reset() {
        this.closeDialog();
        this.characterPhone.reset();
        this.state = null; this.thread = null; this.draft = ''; this.quote = ''; this.search = ''; this.view = 'home'; this.actors.clear(); this.chatExtras = false; this.chatStickers = false; this.voiceMode = false; this.voiceDraft = '';
        if (this.visible) this.render(null);
    }

    clearDraft() { this.draft = ''; this.quote = ''; this.voiceDraft = ''; }

    notice(text, error) {
        this.host.clearTimeout(this.noticeTimer);
        this.banner.hidden = !text;
        this.banner.classList.toggle('error', !!error);
        this.banner.replaceChildren(this.el('span', 'notice-message', text), this.el('span', 'notice-icon', error ? '!' : this.icon('check')), this.button('×', () => { this.banner.hidden = true; }, 'dismiss', '关闭提示'));
        if (text && !error) this.noticeTimer = this.host.setTimeout(() => { this.banner.hidden = true; }, 3500);
    }

    activity(message, queued = this.queuedRequests || 0) {
        this.queuedRequests = queued;
        const hidden = !message && !queued;
        if (this.busy.hidden !== hidden) this.busy.hidden = hidden;
        const label = hidden ? '' : message ? `${message}${queued ? ` · 排队 ${queued}` : ''}` : `等待执行 · ${queued}`;
        if (this.busyMessage.textContent !== label) this.busyMessage.textContent = label;
        if (this.busyCancel.hidden !== !message) this.busyCancel.hidden = !message;
        if (this.busyClear.hidden !== !queued) this.busyClear.hidden = !queued;
    }

    appearance(settings) {
        this.settings = settings;
        this.musicIsland?.setEnabled(settings.musicIsland !== false);
        this.launch.hidden = this.visible || !settings.showLauncher;
        this.launchPosition = settings.launcherPosition ? { ...settings.launcherPosition } : null;
        this.boundLauncher();
        this.panel.dataset.theme = settings.theme;
        this.panel.dataset.wallpaper = settings.wallpaper;
        const source = wallpaperSource(settings);
        if (this.wallpaperSourceKey !== source) {
            this.wallpaperSourceKey = source; this.wallpaperResolved = '';
            this.wallpaperStatus(source ? '正在检查壁纸图片…' : '使用内置壁纸');
            if (source && this.resolveWallpaper) this.resolveWallpaper(source).then(image => {
                if (!this.root.isConnected || this.wallpaperSourceKey !== source) return;
                this.wallpaperResolved = image; this.paintWallpaper(); this.wallpaperStatus('壁纸图片已加载');
            }).catch(error => {
                if (!this.root.isConnected || this.wallpaperSourceKey !== source) return;
                this.wallpaperStatus(error.message, true);
                if (this.visible) this.notice(error.message, true);
            });
            else if (source && !source.startsWith('asset:')) this.wallpaperResolved = source;
        }
        this.paintWallpaper();
        this.windowScale = Number(settings.scale) / 100 || 1;
        this.bound();
    }

    paintWallpaper() {
        const image = this.wallpaperResolved || '';
        const shade = Math.min(85, Math.max(0, Number(this.settings.wallpaperShade) || 0)) / 100;
        this.panel.style.setProperty('--custom-wall', image ? `linear-gradient(rgb(0 0 0 / ${shade}),rgb(0 0 0 / ${shade})),url(${JSON.stringify(image)}),var(--wall)` : 'var(--wall)');
    }

    wallpaperStatus(text, error = false) {
        this.wallpaperFeedback = { text, error };
        for (const node of this.content.querySelectorAll('[data-wallpaper-status]')) { node.textContent = text; node.classList.toggle('error', error); }
    }

    wallpaperPreview(source, classes = 'wallpaper-thumb') {
        const image = this.el('img', classes); image.alt = '壁纸预览'; image.loading = 'lazy';
        image.onerror = () => { image.classList.add('wallpaper-preview-failed'); image.alt = '图片加载失败'; };
        if (source && this.resolveWallpaper) this.resolveWallpaper(source).then(url => { if (image.isConnected) image.src = url; }).catch(() => { if (image.isConnected) { image.classList.add('wallpaper-preview-failed'); image.alt = '图片加载失败'; } });
        return image;
    }

    installWandMenu() {
        this.wandEntry = this.el('div', 'list-group-item flex-container flexGap5 interactable');
        this.wandEntry.id = 'tavern-pocket-menu';
        this.wandEntry.tabIndex = 0; this.wandEntry.setAttribute('role', 'button');
        const icon = this.el('div', 'fa-fw fa-solid fa-mobile-screen-button extensionsMenuExtensionButton');
        icon.setAttribute('aria-hidden', 'true');
        this.wandEntry.append(icon, this.el('span', '', 'Selene手机'));
        const reveal = event => {
            event.preventDefault();
            const input = this.doc.activeElement;
            if (input?.matches?.('input,textarea,[contenteditable=true]')) input.blur();
            this.open();
        };
        this.wandEntry.onclick = reveal;
        this.wandEntry.onkeydown = event => {
            if (event.repeat || !['Enter', ' '].includes(event.key)) return;
            event.stopPropagation(); reveal(event);
        };
        const mount = () => {
            if (this.wandEntry.isConnected) return;
            const menu = this.doc.querySelector('#extensionsMenu .list-group, #extensionsMenuList') || this.doc.getElementById('extensionsMenu');
            menu?.append(this.wandEntry);
        };
        this.wandObserver = new this.host.MutationObserver(mount);
        this.wandObserver.observe(this.doc.body, { childList: true, subtree: true });
        mount();
    }

    boundLauncher() {
        const viewport = this.viewport();
        const left = viewport.left + (this.launchPosition ? 8 + this.launchPosition.x * Math.max(0, viewport.width - 72) : Math.max(8, viewport.width - 74));
        const top = viewport.top + (this.launchPosition ? 8 + this.launchPosition.y * Math.max(0, viewport.height - 72) : Math.max(8, viewport.height - 79));
        Object.assign(this.launch.style, { left: `${left}px`, top: `${top}px`, right: 'auto', bottom: 'auto' });
    }

    installLauncherDrag() {
        let drag;
        this.launch.addEventListener('pointerdown', event => {
            if (event.button !== 0 || event.isPrimary === false) return;
            const rect = this.launch.getBoundingClientRect();
            drag = { id: event.pointerId, x: event.clientX, y: event.clientY, dx: event.clientX - rect.left, dy: event.clientY - rect.top, initial: this.launchPosition ? { ...this.launchPosition } : null, moved: false };
            this.launch.setPointerCapture(event.pointerId);
        });
        this.launch.addEventListener('pointermove', event => {
            if (drag?.id !== event.pointerId) return;
            if (!drag.moved && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 5) return;
            drag.moved = true; event.preventDefault(); this.launch.classList.add('dragging');
            const viewport = this.viewport();
            this.launchPosition = { x: Math.max(0, Math.min(1, (event.clientX - drag.dx - viewport.left - 8) / Math.max(1, viewport.width - 72))), y: Math.max(0, Math.min(1, (event.clientY - drag.dy - viewport.top - 8) / Math.max(1, viewport.height - 72))) };
            this.boundLauncher();
        });
        const end = event => {
            if (drag?.id !== event.pointerId) return;
            const finished = drag; drag = null;
            this.launch.classList.remove('dragging');
            if (this.launch.hasPointerCapture(event.pointerId)) this.launch.releasePointerCapture(event.pointerId);
            if (!finished.moved) return;
            this.launchClickAfter = Date.now() + 500;
            if (event.type !== 'pointerup') { this.launchPosition = finished.initial; this.boundLauncher(); return; }
            this.action('launcherPosition', { position: { ...this.launchPosition } });
        };
        for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) this.launch.addEventListener(event, end);
    }

    installDrag() {
        let drag;
        this.statusBar.addEventListener('pointerdown', event => {
            if (event.button !== 0) return;
            if (event.composedPath().includes(this.camera) && this.musicIsland?.interactive()) return;
            const rectangle = this.panel.getBoundingClientRect();
            drag = { id: event.pointerId, dx: event.clientX - rectangle.left, dy: event.clientY - rectangle.top };
            this.statusBar.setPointerCapture(event.pointerId);
        });
        this.statusBar.addEventListener('pointermove', event => {
            if (drag?.id === event.pointerId) {
                this.position = [event.clientX - drag.dx, event.clientY - drag.dy]; this.bound();
            }
        });
        const end = event => {
            if (drag?.id !== event.pointerId) return;
            drag = null;
            if (this.position) {
                const viewport = this.viewport();
                const edge = viewport.left + viewport.width - this.panel.getBoundingClientRect().width - 8;
                if (this.position[0] < viewport.left + 38) this.position[0] = viewport.left + 8;
                else if (edge - this.position[0] < 38) this.position[0] = edge;
                this.bound();
            }
        };
        this.statusBar.addEventListener('pointerup', end);
        this.statusBar.addEventListener('pointercancel', end);
    }

    viewport() {
        const viewport = this.host.visualViewport;
        return { left: viewport?.offsetLeft || 0, top: viewport?.offsetTop || 0, width: viewport?.width || this.host.innerWidth, height: viewport?.height || this.host.innerHeight };
    }

    textInput(node) {
        return node?.isContentEditable || node?.matches?.('textarea,input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]):not([type=color]):not([type=button]):not([type=submit])');
    }

    bound() {
        if (!this.visible) return;
        const messages = this.view === 'chat' && this.content.querySelector('.bubbles');
        const atEnd = messages && messages.scrollHeight - messages.scrollTop - messages.clientHeight < 2;
        const viewport = this.viewport();
        const layout = this.keyboardLayout;
        const sameWidth = layout && Math.abs(viewport.width - layout.viewport.width) < Math.max(24, layout.viewport.width * .1);
        const keyboard = sameWidth && layout.viewport.height - viewport.height > 100 && this.doc.documentElement.clientHeight >= layout.layoutHeight - 64;
        if (!keyboard && this.panel.classList.contains('keyboard-open') && layout?.position) this.position = layout.position.slice();
        this.panel.classList.toggle('keyboard-open', !!keyboard);
        if (keyboard) {
            // The keyboard reduces content space, never the typing scale or font size.
            this.displayScale = Math.max(.01, Math.min(layout.scale, (viewport.width - 16) / this.panel.offsetWidth));
            this.panel.style.height = `${Math.min(layout.height, Math.max(1, viewport.height - 16) / this.displayScale)}px`;
        } else {
            this.panel.style.removeProperty('height');
            this.displayScale = Math.max(.01, Math.min(this.windowScale || 1, (viewport.width - 16) / this.panel.offsetWidth, (viewport.height - 16) / this.panel.offsetHeight));
            if (!sameWidth || !this.textInput(this.shadow.activeElement)) this.keyboardLayout = null;
            this.restingViewport = viewport;
        }
        this.panel.style.setProperty('--scale', this.displayScale);
        const { width, height } = this.panel.getBoundingClientRect();
        const initial = [viewport.left + viewport.width - width - 20, viewport.top + viewport.height - height - 20];
        const position = this.position?.every(Number.isFinite) ? this.position : initial;
        const left = Math.max(viewport.left + 8, Math.min(position[0], viewport.left + viewport.width - width - 8));
        const top = Math.max(viewport.top + 8, Math.min(position[1], viewport.top + viewport.height - height - 8));
        this.position = [left, top];
        this.panel.style.left = `${left}px`;
        this.panel.style.top = `${top}px`;
        this.panel.style.right = 'auto'; this.panel.style.bottom = 'auto';
        if (atEnd) messages.scrollTop = messages.scrollHeight;
    }

    render(state) {
        this.flushAutosaves();
        if (!this.visible) return;
        this.state = state;
        const activeNode = this.shadow.activeElement;
        const oldInput = activeNode?.matches?.('[data-keep]') ? { key: activeNode.dataset.keep, start: activeNode.selectionStart, end: activeNode.selectionEnd } : null;
        const chatScroll = this.view === 'chat' && this.content.querySelector('.bubbles');
        const prevTop = (chatScroll || this.content).scrollTop;
        const prevXTop = this.content.querySelector('.x-timeline, .douyin-reels')?.scrollTop || 0;
        const prevHeight = (chatScroll || this.content).scrollHeight;
        const sameView = this.content.dataset.view === `${this.view}:${this.thread || ''}`;
        const reuseHome = this.view === 'home' && sameView && this.content.firstElementChild?.classList.contains('springboard');
        this.content.dataset.view = `${this.view}:${this.thread || ''}`;
        this.panel.classList.toggle('wall', ['home', 'lock'].includes(this.view));
        this.panel.dataset.page = this.view;
        const background = state?.background;
        this.panel.classList.toggle('custom-surface', !!background);
        this.panel.dataset.backgroundTone = background?.tone || '';
        if (background?.css) this.panel.style.setProperty('--page-background', background.css);
        else this.panel.style.removeProperty('--page-background');
        this.clock.textContent = this.settings.clockMode === 'device' ? new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : this.rpTime.match(/\d{1,2}:\d{2}/)?.[0] || 'RP';
        const inApp = !['home', 'lock'].includes(this.view);
        const header = this.view === 'characterPhone' ? this.characterPhone.title : this.view === 'chat' ? (state?.thread ? `${state.thread.name}${state.thread.id.startsWith('group:') ? `（${state.thread.members.length}）` : ''}` : '会话') : APPS[this.view]?.[0] || '';
        const back = inApp ? this.iconButton('back', '返回', () => this.view === 'characterPhone' ? this.characterPhone.back() : this.navigate(this.view === 'chat' ? 'messages' : 'home')) : this.iconButton('lock', this.view === 'lock' ? '解锁' : '锁屏', () => this.navigate(this.view === 'lock' ? 'home' : 'lock'));

        if (!reuseHome) this.nav.replaceChildren(back, this.el('span', 'nav-title', inApp ? header : ''), this.view === 'chat'
            ? this.el('div', 'nav-actions', this.iconButton('spark', '请求角色回复', () => this.action('reply', { actor: this.actors.get(this.thread) || '' })), this.iconButton('more', '更多会话操作', () => this.chatMenu?.()))
            : this.el('div', 'nav-actions', inApp ? this.iconButton('palette', '更换本页背景', () => this.backgroundEditor(state, { type: 'page', page: this.view })) : null, this.iconButton('close', '最小化手机', () => this.minimize())));
        let node;
        if (this.view === 'home') node = reuseHome ? this.updateHomeView(this.content.firstElementChild, state) : this.homeView(state);
        else if (this.view === 'music') { node = this.musicApp.root; this.musicApp.setActive(true); }
        else if (this.view === 'lock') node = this.lockView();
        else if (this.view === 'settings') node = this.settingsView(state);
        else if (!state) node = this.el('div', 'empty', '先在酒馆选择角色和聊天。');
        else if (this.view === 'characterPhone') node = this.characterPhone.render(state);
        else if (this.view === 'messages') node = this.inbox(state);
        else if (this.view === 'chat') node = this.chatView(state);
        else if (this.view === 'contacts') node = this.contacts(state);
        else if (this.view === 'album') node = this.albumView(state);
        else if (this.view === 'imagegen') node = this.imageView(state);
        else if (PLATFORMS[this.view]) node = this.moments(state);
        else if (this.view === 'notifications') node = this.notifications(state);
        else node = this.debug(state);
        if (this.content.firstElementChild !== node || this.content.childElementCount !== 1) this.content.replaceChildren(node);
        if (this.view !== 'music') this.musicApp.setActive(false);
        if (this.view === 'home') { if (!reuseHome) this.restoreHomePage?.(); }
        else this.restoreHomePage = null;
        if (this.view === 'chat') {
            const scroll = this.content.querySelector('.bubbles') || this.content;
            scroll.scrollTop = this.rememberScroll && sameView ? prevTop + scroll.scrollHeight - prevHeight : scroll.scrollHeight;
            this.rememberScroll = false;
        } else if (this.view === 'characterPhone' && this.characterPhone.thread) {
            const scroll = this.content.querySelector('.character-phone-bubbles');
            if (scroll) scroll.scrollTop = scroll.scrollHeight;
            this.content.scrollTop = 0;
        }
        else this.content.scrollTop = sameView ? prevTop : 0;
        if (['x', 'douyin'].includes(this.view) && sameView) { const timeline = this.content.querySelector('.x-timeline, .douyin-reels'); if (timeline) timeline.scrollTop = prevXTop; }
        if (sameView && oldInput) {
            const input = [...this.content.querySelectorAll('[data-keep]')].find(item => item.dataset.keep === oldInput.key);
            input?.focus({ preventScroll: true });
            if (oldInput.start != null) input?.setSelectionRange?.(oldInput.start, oldInput.end);
        }
    }

    updateHomeView(root, state) {
        const card = state?.context.characters?.[state.context.characterId];
        const group = state?.context.groups?.find(item => String(item.id) === String(state.context.groupId));
        const scope = state ? group?.name || card?.name || JSON.parse(state.scope).at(-1) : '尚未选择聊天';
        const unread = state?.threads.reduce((total, thread) => total + (thread.unread || 0), 0) || 0;
        const deviceClock = this.settings.clockMode === 'device';
        const date = deviceClock ? new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }) : this.rpTime.replace(/\d{1,2}:\d{2}/, '').trim() || 'SELENE';
        for (const [selector, value] of [['.home-widget-date', date], ['.home-widget-clock > strong', this.clock.textContent === 'RP' ? 'Selene' : this.clock.textContent], ['.home-widget-context > strong', scope]]) {
            const node = root.querySelector(selector); if (node && node.textContent !== value) node.textContent = value;
        }
        for (const icon of root.querySelectorAll('[data-app="messages"] .app-icon')) {
            let badge = icon.querySelector('.badge');
            if (!unread) { badge?.remove(); continue; }
            if (!badge) { badge = this.el('span', 'badge'); icon.append(badge); }
            const label = unread > 99 ? '99+' : String(unread);
            if (badge.textContent !== label) badge.textContent = label;
        }
        return root;
    }

    homeView(state) {
        const appButton = (key, inDock = false) => {
            const unread = this.state?.threads.reduce((total, thread) => total + (thread.unread || 0), 0) || 0;
            const [name, color] = APPS[key];
            const badge = key === 'messages' && unread ? this.el('span', 'badge', unread > 99 ? '99+' : String(unread)) : null;
            const app = this.button('', event => {
                if (Date.now() < (this.homeSwipeClickAfter || 0)) { event.preventDefault(); return; }
                this.navigate(key);
            }, `app${inDock ? ' dock-app' : ''}`, `打开${name}`);
            app.dataset.app = key;
            app.append(this.el('span', `app-icon ${color} app-${key}`, this.appIcon(key), badge));
            if (!inDock) app.append(this.el('span', 'app-label', name));
            return app;
        };
        const pages = this.el('div', 'home-pages');
        pages.tabIndex = 0; pages.setAttribute('aria-label', '主屏幕，左右滑动切换页面');
        const groups = [ ['album', 'music', 'redbook', 'douyin', 'weibo', 'x', 'forum', 'notifications'], ['imagegen', 'debug', 'characterPhone'] ];
        for (const [index, keys] of groups.entries()) {
            const page = this.el('section', 'home-page', this.el('div', 'app-grid', ...keys.map(key => appButton(key))));
            page.setAttribute('aria-label', index ? '工具，第 2 页，共 2 页' : '社交，第 1 页，共 2 页');
            pages.append(page);
        }
        const dots = groups.map((_, index) => this.button('', () => setPage(index), 'home-page-dot', `转到第 ${index + 1} 页`));
        const pager = this.el('div', 'home-pager', ...dots); pager.setAttribute('aria-label', '主屏幕分页');
        const updateDots = index => dots.forEach((dot, position) => {
            if (position === index) dot.setAttribute('aria-current', 'page'); else dot.removeAttribute('aria-current');
        });
        const setPage = (index, behavior = 'smooth') => {
            this.homePage = Math.max(0, Math.min(groups.length - 1, index)); updateDots(this.homePage);
            if (this.host.matchMedia?.('(prefers-reduced-motion: reduce)').matches) behavior = 'auto';
            pages.scrollTo({ left: this.homePage * pages.clientWidth, behavior });
        };
        pages.addEventListener('scroll', () => {
            if (!pages.clientWidth) return;
            this.homePage = Math.max(0, Math.min(groups.length - 1, Math.round(pages.scrollLeft / pages.clientWidth))); updateDots(this.homePage);
        }, { passive: true });
        pages.addEventListener('keydown', event => {
            if (event.target !== pages || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
            event.preventDefault(); setPage((this.homePage || 0) + (event.key === 'ArrowRight' ? 1 : -1));
        });
        // Touch/trackpad scrolling stays native. Mouse dragging gains the same page gesture.
        let drag;
        pages.addEventListener('pointerdown', event => {
            if (event.pointerType === 'touch' || event.button !== 0) return;
            drag = { id: event.pointerId, x: event.clientX, y: event.clientY, left: pages.scrollLeft, page: this.homePage || 0, moved: false };
        });
        pages.addEventListener('pointermove', event => {
            if (drag?.id !== event.pointerId) return;
            if (!event.buttons) { drag = null; pages.classList.remove('is-swiping'); return; }
            const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
            if (!drag.moved) {
                if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { drag = null; return; }
                if (Math.abs(dx) < 12 || Math.abs(dx) < Math.abs(dy)) return;
                drag.moved = true; pages.classList.add('is-swiping'); pages.setPointerCapture(event.pointerId);
            }
            event.preventDefault(); this.homeSwipeClickAfter = Date.now() + 400; pages.scrollLeft = drag.left - dx / (this.displayScale || 1);
        });
        const end = event => {
            if (drag?.id !== event.pointerId) return;
            const finished = drag; drag = null; pages.classList.remove('is-swiping');
            if (!finished.moved) return;
            this.homeSwipeClickAfter = Date.now() + 400;
            const dx = event.clientX - finished.x;
            setPage(event.type === 'pointerup' && Math.abs(dx) / (this.displayScale || 1) > Math.min(55, pages.clientWidth * .18) ? finished.page + (dx < 0 ? 1 : -1) : finished.page);
            if (pages.hasPointerCapture(event.pointerId)) pages.releasePointerCapture(event.pointerId);
        };
        for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) pages.addEventListener(type, end);
        pages.addEventListener('dragstart', event => event.preventDefault());
        const results = this.el('div', 'home-results app-grid'); results.hidden = true;
        const empty = this.el('p', 'home-search-empty', '未找到应用'); empty.hidden = true;
        const search = this.input('search', this.homeSearch || '', '搜索'); search.setAttribute('aria-label', '搜索应用'); search.dataset.keep = 'home-search';
        const filter = () => {
            this.homeSearch = search.value;
            const query = search.value.trim().toLocaleLowerCase();
            pages.hidden = pager.hidden = !!query; results.hidden = !query;
            const matches = query ? Object.keys(APPS).filter(key => `${APPS[key][0]} ${key}`.toLocaleLowerCase().includes(query)) : [];
            results.replaceChildren(...matches.map(key => appButton(key))); empty.hidden = !query || !!matches.length;
            if (!query && pages.isConnected) setPage(this.homePage || 0, 'auto');
        };
        search.oninput = filter; filter();
        this.restoreHomePage = () => { if (!search.value.trim()) setPage(this.homePage || 0, 'auto'); };
        const dock = this.el('div', 'dock', ...['messages', 'contacts', 'moments', 'settings'].map(key => appButton(key, true)));
        dock.setAttribute('aria-label', '常用应用');
        const widget = this.button('', () => this.navigate('lock'), 'home-widget', '查看时钟与通知');
        widget.append(this.el('span', 'home-widget-clock', this.el('span', 'home-widget-date'), this.el('strong')),
            this.el('span', 'home-widget-context', this.el('span', '', '当前聊天'), this.el('strong')));
        return this.updateHomeView(this.el('div', 'springboard', widget, pages, results, empty, this.el('div', 'home-bottom', pager, this.el('label', 'home-search', this.icon('search'), search), dock)), state);
    }

    get rpTime() { return this.state?.rpTime ?? this.settings.rpTime ?? ''; }

    lockView() {
        const device = this.settings.clockMode === 'device';
        const now = new Date();
        const time = device ? now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : this.rpTime.match(/\d{1,2}:\d{2}/)?.[0] || '—:—';
        const date = device ? now.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }) : this.rpTime.replace(/\d{1,2}:\d{2}/, '').trim() || 'RP 时间尚未设定';
        const notifications = notificationRows(this.state?.rows || [], this.state?.prefs, PLAYER);
        const rows = notifications.slice(0, 3);
        return this.el('div', 'lock-screen', this.el('div', 'lock-clock', this.el('p', '', date), this.el('h1', '', time), this.el('small', '', device ? '设备时钟' : '剧情时间')),
            this.el('div', 'lock-notifications', this.el('div', 'lock-notifications-heading', this.el('h2', '', '通知中心'), this.clearNotificationsButton(notifications)), ...rows.map(row => {
                const button = this.button('', () => this.navigate(['message', 'call'].includes(row.kind) ? 'chat' : row.thread, ['message', 'call'].includes(row.kind) ? row.thread : null), 'lock-notification');
                button.append(this.el('span', 'notification-icon', this.icon(row.kind === 'message' ? 'messages' : 'notifications')), this.el('span', 'list-info', this.el('strong', '', row.speaker), this.el('small', '', row.text)));
                return button;
            }), rows.length ? null : this.el('p', 'lock-empty', '暂无新通知')),
            this.button('轻触解锁', () => this.navigate('home'), 'unlock'));
    }

    heading(title, caption, controls = null) {
        return this.el('div', 'page-heading', this.el('div', '', this.el('span', 'eyebrow', caption), this.el('h1', '', title)), controls);
    }

    section(title, ...children) { return this.el('section', 'card', title ? this.el('h3', '', title) : null, ...children); }
    small(text) { return this.el('p', 'small', text); }

    backgroundPages(state) {
        const pages = this.el('div', 'background-page-list');
        const colors = { home: 'blush', lock: 'dusk', messages: 'sage', chat: 'sage', contacts: 'mist', moments: 'sage', redbook: 'blush', douyin: 'dusk', weibo: 'blush', forum: 'mist', x: 'dusk', album: 'pearl', imagegen: 'mist', notifications: 'blush', settings: 'pearl', debug: 'mist' };
        const icons = { home: 'launcher', lock: 'lock', chat: 'messages' };
        let customized = 0;
        for (const [page, name] of Object.entries(PAGES)) {
            const config = this.settings.pageBackgrounds?.[page] || { preset: 'default' };
            const custom = config.preset !== 'default'; if (custom) customized++;
            const preview = this.el('span', 'background-page-preview', this.icon(config.preset === 'image' ? 'photo' : icons[page] || page));
            const style = backgroundStyle(config.preset === 'default' || config.preset === 'image' ? { preset: colors[page] } : config);
            preview.style.background = style?.css || 'var(--surface)';
            if (style?.tone === 'dark') preview.classList.add('dark');
            const row = this.button('', () => this.backgroundEditor(state, { type: 'page', page }), `background-page-row ${custom ? 'is-custom' : ''}`, `更换${name}背景`);
            row.dataset.search = name;
            row.append(preview, this.el('span', 'background-page-info', this.el('strong', '', name), this.el('small', '', BACKGROUNDS[config.preset] || '应用默认')));
            pages.append(row);
        }
        const search = this.input('search', '', '查找页面'); search.setAttribute('aria-label', '查找背景页面');
        search.oninput = () => { for (const row of pages.children) row.hidden = !row.dataset.search.includes(search.value.trim()); };
        const details = this.el('details', 'background-pages', this.el('summary', '', this.el('span', 'background-pages-title', this.icon('palette'), '页面背景'),
            this.el('small', '', customized ? `${customized} 个已自定义` : '分别设置'), this.icon('right')),
            this.el('div', 'background-pages-body', this.el('label', 'background-pages-search', this.icon('search'), search), pages));
        return details;
    }

    backgroundEditor(state, target) {
        const current = target.type === 'chat' ? state?.cardScoped ? this.settings.pageBackgrounds?.chat : state?.prefs?.chatBackgrounds?.[target.thread] : this.settings.pageBackgrounds?.[target.page];
        const config = current || { preset: 'default', image: '', shade: 60, tone: 'light' };
        const preset = this.select(Object.entries(BACKGROUNDS), config.preset);
        const image = this.input('url', config.image?.startsWith('asset:') ? '' : config.image || '', config.image?.startsWith('asset:') ? '已保存本地图片，可上传替换' : 'https://… 图片地址');
        const file = this.input('file', ''); file.accept = 'image/png,image/jpeg,image/webp,image/gif';
        const shade = this.input('range', config.shade ?? 60); shade.min = '0'; shade.max = '90';
        const tone = this.select([['light', '浅色文字区'], ['dark', '深色文字区']], config.tone || 'light');
        const preview = this.el('div', 'background-preview', this.el('span', '', '背景预览'), this.el('strong', '', target.type === 'chat' ? state.thread.name : PAGES[target.page]));
        let temporary;
        const values = () => ({ preset: preset.value, image: image.value || config.image || '', shade: Number(shade.value), tone: tone.value });
        const update = () => {
            try { preview.style.background = temporary && preset.value === 'image' ? `linear-gradient(rgb(255 255 255 / ${Number(shade.value) / 100}),rgb(255 255 255 / ${Number(shade.value) / 100})),url(${JSON.stringify(temporary)}) center/cover` : backgroundStyle(values())?.css || (config.image?.startsWith('asset:') ? state?.background?.css : '') || 'var(--surface)'; } catch { preview.style.background = 'var(--surface)'; }
            preview.style.backgroundSize = 'cover'; preview.style.color = tone.value === 'dark' ? '#fff' : '#182139';
        };
        preset.onchange = update; shade.oninput = update; tone.onchange = update;
        image.oninput = () => { preset.value = 'image'; update(); };
        file.onchange = () => { if (temporary) this.host.URL.revokeObjectURL(temporary); temporary = file.files[0] ? this.host.URL.createObjectURL(file.files[0]) : ''; preset.value = 'image'; update(); };
        this.dialog(target.type === 'chat' ? '此会话的聊天背景' : `${PAGES[target.page]}背景`, this.el('div', 'form', preview,
            this.el('label', 'field', '背景样式', preset), this.el('label', 'field', '图片地址', image), this.el('label', 'field', '上传本地图片（最大 2 MiB）', file),
            this.el('label', 'field', '文字区配色', tone), this.el('label', 'field', '遮罩浓度', shade),
            this.button('恢复默认', () => { this.closeDialog(); this.action('background', { target, config: { preset: 'default' } }); }, 'outline')),
        () => this.action('background', { target, config: values(), file: preset.value === 'image' ? file.files[0] : undefined }));
        this.dialogCleanup = () => { if (temporary) this.host.URL.revokeObjectURL(temporary); };
        update();
    }

    recordCall() {
        const text = this.el('textarea'); text.rows = 3; text.placeholder = '记录已经发生的通话内容';
        this.dialog('记录实际通话', this.el('div', 'form', this.small('仅记录剧情中实际发生的通话，不拨打真实电话。'), text), () => this.action('call', { text: text.value, payload: { components: [{ type: 'call', fields: {}, text: text.value }] } }));
    }

    socialCover(post, platform, index = 0) {
        const media = post.payload?.media?.[0];
        const generated = this.state?.albumRows?.find(row => row.sourceId === post.id && row.generated && row.index === index);
        const source = photoSource(media?.displayUrl || generated?.url || media?.fields?.src || media?.fields?.url);
        const cover = this.el('div', `social-cover cover-${platform}`);
        if (source && media?.type === 's-image') { const image = this.el('img'); image.src = source; image.alt = media.text || post.payload?.title || '图片'; image.loading = 'lazy'; cover.append(image); }
        else cover.append(this.appIcon(platform), this.el('span', '', media?.text || post.payload?.title || post.text), this.el('small', '', media?.type === 's-video' ? '视频画面描述' : '图文记录'));
        return cover;
    }

    resourcePanel(target, manager) {
        const book = this.select([['', '请选择已有世界书'], ...target.allBooks.map(name => [name, name])], target.book);
        const report = this.el('div', 'form', this.small('选择目标后检查状态。世界书可能被其他角色共享；修改也会影响使用同一本书的角色。'));
        const run = async (kind, mode, confirmed = false) => {
            try {
                const selected = { ...target, book: book.value };
                const result = await manager.run(selected, kind, mode, confirmed);
            report.replaceChildren(...result.statuses.map(item => this.small(`${item.name}：${item.status}`)));
                if (result.confirm) {
                    report.append(this.small(`以下资源原先由用户安装或已修改：${result.protectedNames.join('、')}。`),
                        this.button(`确认${mode === 'delete' ? '删除' : '更新'}上述资源`, () => run(kind, mode, true), 'outline danger'));
                    return false;
                }
                if (result.saved) report.append(this.small('已保存并通过服务器回读验证。'));
                return true;
            } catch (error) { report.replaceChildren(this.small(error.message)); return false; }
        };
        const controls = (kind, caption) => this.section(caption, this.el('div', 'actions', ...[['install', '一键导入'], ['delete', '一键删除']].map(([mode, title]) => this.button(title, () => run(kind, mode), mode === 'delete' ? 'outline danger' : 'outline'))),
            this.el('div', 'actions', this.button('检查安装状态', () => run(kind, 'check'), 'link'), this.button('更新资源', () => run(kind, 'update'), 'link')));
        return this.el('div', 'form linkage', this.small(`当前角色：${target.cardName}`),
            this.el('label', 'field', '目标世界书（优先角色主世界书）', book), target.books.length ? null : this.small('当前角色没有绑定世界书；可选择已有书导入，再手动绑定。不会新建或全局启用。'),
            this.el('div', 'resource-inventory', ...[['线上丨社交美化', 327], ['IM丨线上规则', 326], ['IM丨表情包', 325]].map(([name, order]) => this.el('div', '', this.el('span', 'green-dot'), this.el('span', '', name), this.el('small', '', String(order))))),
            controls('world', '当前角色世界书'), controls('regex', '角色局部正则 · iMessage'), controls('social', '角色局部正则 · 社交动态'), controls('hide', '交接隐藏正则 · 仅显示'),
            this.el('div', 'actions', this.button('一键安装全部联动资源', async () => { for (const kind of ['world', 'regex', 'social']) if (!await run(kind, 'install')) break; }, 'primary'),
                this.button('一键删除全部联动资源', async () => {
                    try {
                        const selected = { ...target, book: book.value };
                        const plans = [];
                        for (const kind of ['world', 'regex', 'social']) plans.push(await manager.run(selected, kind, 'delete', false, true));
                        report.replaceChildren(this.small('将删除以下联动资源，其他条目保留：'), ...plans.flatMap(plan => plan.statuses).filter(item => item.status !== '未安装').map(item => this.small(`${item.name} · ${item.status}`)),
                            ...plans.flatMap(plan => plan.protectedNames).map(name => this.small(`需确认的手动安装或修改：${name}`)),
                            this.button('确认删除以上全部资源', async () => { for (const kind of ['world', 'regex', 'social']) if (!await run(kind, 'delete', true)) break; }, 'outline danger'));
                    } catch (error) { report.replaceChildren(this.small(error.message)); }
                }, 'outline')), report);
    }

    settingsGroup(title, caption, icon, ...children) {
        const details = this.el('details', 'card settings-group', this.el('summary', '', this.el('span', 'settings-icon', this.icon(icon)),
            this.el('span', 'settings-label', this.el('strong', '', title), this.el('small', '', caption)), this.icon('right')), this.el('div', 'settings-body', ...children));
        details.dataset.icon = icon;
        details.open = this.settingsSections.has(title);
        details.addEventListener('toggle', () => {
            if (!details.isConnected) return;
            if (details.open) this.settingsSections.add(title); else this.settingsSections.delete(title);
        });
        return details;
    }

    updateCloudStatus(status) {
        if (this.state) this.state.cloudStatus = status;
        const group = [...this.content.querySelectorAll('.settings-group')].find(node => node.querySelector('summary strong')?.textContent === '数据同步');
        const caption = group?.querySelector('summary small');
        if (caption) caption.textContent = status;
    }

    flushAutosaves() {
        return Promise.all([...(this.autosaves || [])].map(save => save()));
    }

    autoSettings(root, entries, action) {
        const status = this.el('small', 'settings-save-status', '更改自动保存');
        status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
        const pending = new Map(); let timer; let revision = 0;
        const flush = () => {
            this.host.clearTimeout(timer);
            if (!pending.size) return this.settingsWrites || Promise.resolve(true);
            const patch = Object.assign({}, ...pending.values()); pending.clear();
            const savedRevision = revision;
            status.textContent = '正在保存…';
            this.settingsWrites = (this.settingsWrites || Promise.resolve()).then(() => action(patch)).then(ok => {
                if (revision === savedRevision) status.textContent = ok ? '已自动保存' : '保存失败，请修改后重试';
                return ok;
            }).catch(() => { status.textContent = '保存失败，请修改后重试'; return false; });
            return this.settingsWrites;
        };
        this.autosaves ??= new Set();
        // Flush before a control or page is removed; discard stale form closures.
        for (const save of this.autosaves) if (!save.root.isConnected) { save(); this.autosaves.delete(save); }
        flush.root = root; this.autosaves.add(flush);
        for (const [node, values] of entries) {
            const changed = immediate => {
                pending.set(node, values()); revision++; status.textContent = '等待保存…';
                this.host.clearTimeout(timer);
                if (immediate) flush(); else timer = this.host.setTimeout(flush, 500);
            };
            node.addEventListener('input', event => { if (!event.isComposing) changed(node.matches('select, [type=checkbox]')); });
            node.addEventListener('change', () => changed(true));
        }
        return { status, flush };
    }

    inbox(state) {
        const search = this.el('input', 'search'); search.placeholder = '搜索会话或消息'; search.value = this.search; search.dataset.keep = 'search'; search.setAttribute('aria-label', '搜索会话或消息');
        search.oninput = () => { this.search = search.value; this.action('refresh'); };
        const matchedRows = new Set(state.rows.map(row => row.thread));
        const threads = state.threads.filter(thread => !this.search || matchedRows.has(thread.id) || thread.name.toLowerCase().includes(this.search.toLowerCase()));
        const list = this.el('div', 'list');
        for (const thread of threads) {
            const pinned = state.prefs.pins?.includes(thread.id);
            const button = this.button('', () => this.navigate('chat', thread.id), 'list-row');
            button.append(this.avatar(thread), this.el('span', 'list-info', this.el('strong', '', `${pinned ? '⌖ ' : ''}${thread.name}`), this.el('small', '', `${thread.muted ? '免打扰 · ' : ''}${thread.latest?.text || thread.source || '群聊'}`)), thread.unread ? this.el('span', 'unread', String(thread.unread)) : this.icon('right'));
            list.append(button);
        }
        if (!threads.length) list.append(this.el('p', 'empty', this.search ? '没有匹配的会话。' : '暂无联系人。'));
        return this.el('div', 'screen', this.heading('消息', 'INBOX', this.iconButton('add', '添加联系人或发起聊天', () => this.inboxMenu(state))), this.el('label', 'search-box', this.icon('search'), search), list);
    }

    inboxMenu(state) {
        this.dialog('发起聊天', this.el('div', 'form',
            this.button('添加联系人', () => this.contactEditor(), 'outline'),
            this.button('发起群聊', () => this.groupEditor(state), 'outline'),
            this.button('角色与 NPC 聊天', () => this.characterPhone.chatPicker(state), 'outline')));
    }

    contactEditor(owner = '', initial = {}) {
        const scope = this.state?.scope;
        const name = this.input('text', initial.name || '', '姓名'); name.maxLength = 60; name.setAttribute('aria-label', '联系人姓名');
        const notes = this.el('textarea'); notes.placeholder = '设定或备注（可选）'; notes.rows = 4; notes.maxLength = 2000; notes.setAttribute('aria-label', '联系人设定或备注');
        const submit = this.button('添加联系人', async () => {
            if (submit.disabled || this.state?.scope !== scope) return;
            submit.disabled = true;
            const contact = name.value.trim();
            if (await this.action('addContact', { name: contact, notes: notes.value })) {
                this.closeDialog();
                if (owner && this.state?.scope === scope) {
                    const peer = this.state.people.find(person => person.name === contact);
                    if (peer) this.characterPhone.openChat(owner, peer.id);
                }
            } else submit.disabled = !name.value.trim();
        }, 'primary');
        submit.disabled = !name.value.trim(); name.oninput = () => { submit.disabled = !name.value.trim(); };
        this.dialog('新增联系人', this.el('div', 'form', name, notes, submit));
        name.focus();
    }

    groupEditor(state, selected = [], group = null) {
        const fixed = new Set(selected);
        const chosen = new Set(selected);
        const search = this.input('search', '', '搜索联系人'); search.setAttribute('aria-label', '搜索联系人');
        const list = this.el('div', 'group-contact-list');
        const error = this.el('p', 'editor-error'); error.setAttribute('role', 'alert');
        const done = this.button('完成', async () => {
            if (done.disabled) return;
            done.disabled = true;
            const ok = await this.action(group ? 'addGroupMembers' : 'addGroup', { id: group?.id, members: [...chosen] });
            if (ok) this.closeDialog();
            else { error.textContent = '未能保存，请重试'; update(); }
        }, 'wechat-primary group-picker-done');
        const update = () => {
            const added = [...chosen].filter(id => !fixed.has(id));
            done.textContent = `完成${chosen.size ? `（${chosen.size}）` : ''}`;
            done.disabled = group ? !added.length : chosen.size < 2;
            for (const row of list.children) { row.hidden = !row.dataset.name.includes(search.value.trim().toLocaleLowerCase()); }
        };
        const contacts = state.people.filter(person => person.id !== PLAYER && (!contactDeleted(person, state.prefs) || fixed.has(person.id))).sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
        for (const person of contacts) {
            const control = this.input('checkbox', chosen.has(person.id)); control.disabled = fixed.has(person.id);
            control.setAttribute('aria-label', person.name);
            control.onchange = () => { if (control.checked) chosen.add(person.id); else chosen.delete(person.id); update(); };
            const row = this.el('label', 'group-contact-row', control, this.avatar(person), this.el('span', '', person.name));
            row.dataset.name = person.name.toLocaleLowerCase(); list.append(row);
        }
        search.oninput = update;
        const body = this.el('div', 'wechat-page-body group-picker', this.el('label', 'group-contact-search', this.icon('search'), search),
            list, !contacts.length ? this.el('p', 'empty', '暂无可选联系人') : null,
            this.el('div', 'group-picker-footer', error, done));
        this.fullPage('选择联系人', body);
        const back = this.pop.querySelector('.wechat-page-head .icon-button');
        back.replaceChildren(this.el('span', 'group-picker-close', '×')); back.setAttribute('aria-label', '取消选择');
        update();
    }

    socialNicknameEditor(state, personId = PLAYER, nickname = '') {
        const person = state.people.find(item => item.id === personId) || state.people.find(item => item.id === PLAYER);
        const target = this.select(state.people.map(item => [item.id, item.name]), person.id);
        target.setAttribute('aria-label', '网名对应人物');
        const name = this.input('text', nickname || socialNickname(person, this.settings), '网名'); name.maxLength = 80;
        name.setAttribute('aria-label', '社交网名');
        const error = this.el('p', 'editor-error'); error.setAttribute('role', 'alert');
        const save = this.button('保存', async () => {
            if (!name.value.trim()) { error.textContent = '请填写网名'; return; }
            save.disabled = true;
            if (await this.action('setSocialNickname', { person: target.value, nickname: name.value })) this.closeDialog();
            else { save.disabled = false; error.textContent = '网名未保存，请检查填写内容'; }
        }, 'wechat-primary');
        target.onchange = () => { name.value = socialNickname(state.people.find(item => item.id === target.value), this.settings); };
        this.dialog('社交网名', this.el('div', 'form', this.el('label', 'field', '对应人物', target), this.el('label', 'field', '网名', name),
            this.small('用于社交动态与评论；正文中的这个网名会对应到所选人物。以前保存的网名仍可识别。'), error, save));
    }

    groupNameEditor(state, controls, speaker) {
        const name = this.input('text', state.thread.name === '群聊' ? '' : state.thread.name, '群聊名称'); name.maxLength = 60;
        name.setAttribute('aria-label', '群聊名称');
        const save = this.button('完成', async () => {
            save.disabled = true;
            if (await this.action('renameGroup', { id: state.thread.id, name: name.value })) this.chatDetails(this.state, controls, speaker);
            else save.disabled = !name.value.trim();
        }, 'wechat-primary group-name-save');
        save.disabled = !name.value.trim(); name.oninput = () => { save.disabled = !name.value.trim(); };
        this.fullPage('群聊名称', this.el('div', 'wechat-page-body group-name-editor', name), save);
        this.pop.querySelector('.wechat-page-head .icon-button').onclick = () => this.chatDetails(this.state, controls, speaker);
        name.focus();
    }

    peopleChecks(state, selected = []) {
        const items = state.people.filter(person => person.id !== PLAYER && !contactDeleted(person, state.prefs)).map(person => [person, this.input('checkbox', selected.includes(person.id))]);
        return { node: this.el('div', 'checks', ...items.map(([person, control]) => this.el('label', '', control, person.name))), selected: () => items.filter(([, input]) => input.checked).map(([person]) => person.id) };
    }

    chatView(state) {
        const thread = state.thread;
        if (!thread) return this.el('div', 'empty', this.el('p', '', '此会话在当前分支不可用。'), this.button('返回消息', () => this.navigate('messages'), 'outline'), this.button('添加联系人', () => this.contactEditor(), 'outline'));
        const actors = state.people.filter(person => thread.members.includes(person.id) && person.id !== PLAYER);
        const speaker = this.select([['', '依次选人 / @点名'], ...actors.map(person => [person.id, person.name])], this.actors.get(thread.id) || '');
        speaker.setAttribute('aria-label', '选择回复人物'); speaker.onchange = () => this.actors.set(thread.id, speaker.value);
        const input = this.el('textarea', 'composer-input');
        input.placeholder = '发消息'; input.setAttribute('aria-label', '手机消息'); input.rows = 1; input.maxLength = 2000; input.value = this.draft; input.dataset.keep = 'composer'; input.oninput = () => { this.draft = input.value; };
        const send = (name, options = {}) => this.action(name, { actor: speaker.value, text: input.value, quote: this.quote, ...options });
        input.onkeydown = event => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); send('send'); } };
        const messages = this.el('div', 'bubbles');
        if (state.next) messages.append(this.button('载入更早的消息', () => { this.rememberScroll = true; this.action('more'); }, 'link load'));
        const ordered = [...state.rows].reverse();
        const timeline = chatTimeline(ordered, state.rpTime, state.chat);
        for (const [index, row] of ordered.entries()) {
            const own = row.speakerId === PLAYER;
            const bubble = this.button('', () => { if (Date.now() < (bubble.suppressClickUntil || 0)) return; this.openMessage(state, row); }, `bubble ${own ? 'own' : ''} ${ordered[index + 1]?.speakerId === row.speakerId ? 'continues' : ''}`);
            bubble.dataset.messageId = row.id;
            this.bindMessagePress(bubble, state, row);
            const payload = row.payload;
            if (row.quote || payload?.components?.some(part => part.type === 'reply')) bubble.append(this.el('span', 'bubble-quote', row.quote || payload.components.find(part => part.type === 'reply')?.fields?.quote || '引用消息'));
            const hasComponent = payload?.components?.length;
            if (hasComponent === 1 && ['voice', 'red', 'pay', 'loc', 'sticker'].includes(payload.components[0].type)) bubble.classList.add(`wechat-${payload.components[0].type}-bubble`);
            if (hasComponent && payload.caption) bubble.append(this.el('span', '', payload.caption));
            if (!hasComponent) bubble.append(this.el('span', '', row.kind === 'call' ? `☎ ${row.text}` : row.text));
            else for (const [index, part] of payload.components.entries()) bubble.append(this.messageComponent(part, { sourceId: row.id, index, ownerId: row.speakerId }));
            if (hasComponent === 1 && payload.components[0].type === 'photo' && !payload.caption) bubble.classList.add(bubble.querySelector('.im-photo') ? 'wechat-photo-bubble' : 'wechat-photo-description-bubble');
            bubble.setAttribute('aria-label', `${row.speaker}：${row.text}`);
            if (timeline[index].text) {
                const time = this.el('small', 'im-timestamp', timeline[index].text);
                time.title = timeline[index].raw; messages.append(time);
            }
            const content = this.el('div', 'bubble-content', !own && thread.members.length > 2 ? this.el('small', '', row.speaker) : null, bubble);
            const line = this.el('div', `bubble-row ${own ? 'own' : ''}`, this.avatar(state.people.find(person => person.id === row.speakerId) || { name: row.speaker }), content);
            messages.append(line);
        }
        if (thread.createdNotice && !state.next && !state.prefs.hiddenBefore?.[thread.id]) messages.prepend(this.el('p', 'group-system-notice', thread.createdNotice));
        if (!ordered.length && !thread.createdNotice) messages.append(this.el('div', 'chat-empty', this.icon('messages'), this.el('strong', '', '还没有消息'), this.el('p', '', '发一句话，开始这段对话')));
        const controls = this.el('div', 'chat-tools', thread.members.length > 2 ? speaker : null,
            this.button('表情', () => { this.closeDialog(); this.chatStickers = true; this.chatExtras = false; this.render(state); }, 'link'),
            this.button('待回复', () => send('reply'), 'link'), this.button('角色主动', () => send('initiative'), 'link'), this.button('···', () => this.dialog('会话操作', this.el('div', 'form',
                this.button('记录实际通话', () => { this.closeDialog(); send('call'); }, 'outline'),
                this.button('预览上下文（不请求）', () => { this.closeDialog(); send('preview').then(ok => { if (ok) this.navigate('debug'); }); }, 'outline'),
                this.button('检索旧原文并回复', () => { this.closeDialog(); send('reply', { recall: true }); }, 'outline'),
                this.button('更换此会话背景', () => this.backgroundEditor(state, { type: 'chat', thread: thread.id, scope: state.scope }), 'outline'),
                this.button('最小化手机', () => this.minimize(), 'outline'),
                this.button(state.prefs.pins?.includes(thread.id) ? '取消置顶' : '置顶会话', () => { this.closeDialog(); this.action('pin'); }, 'outline')
            )), 'link', '更多会话操作'));
        const quote = this.quote ? this.el('div', 'quote-draft', this.el('span', '', this.quote), this.button('×', () => { this.quote = ''; this.render(state); }, 'link')) : null;
        this.chatMenu = () => this.chatDetails(this.state, controls, speaker);
        const sticker = () => { this.chatStickers = !this.chatStickers; this.chatExtras = false; this.render(this.state); };
        const extras = this.el('div', 'wechat-extras'); extras.hidden = !this.chatExtras;
        const features = [
            ['music', '分享音乐', () => this.shareCurrentMusic(speaker.value)],
            ['photo', '照片', () => this.attachmentEditor('photo', speaker.value)],
            ['camera', '拍摄', () => this.attachmentEditor('photo', speaker.value, '拍摄画面')],
            ['video', '视频通话', () => this.recordCall()],
            ['location', '位置', () => this.locationEditor(speaker.value)],
            ['envelope', '红包', () => this.moneyEditor('red', speaker.value)],
            ['gift', '礼物', () => this.attachmentEditor('file', speaker.value, '礼物')],
            ['transfer', '转账', () => this.moneyEditor('pay', speaker.value)],
            ['star', '收藏', () => {
                const saved = state.rows.filter(row => row.memory);
                this.dialog('会话收藏', this.el('div', 'form', saved.length ? null : this.small('在消息详情中选择“保留为长期记忆”，即可在这里查看。'), ...saved.map(row => this.small(`${row.speaker}：${row.memory}`))));
            }],
            ['voice', '语音', () => this.voiceEditor(speaker.value)],
            ['link', '链接', () => this.attachmentEditor('link', speaker.value)],
            ['more', '更多', () => this.chatMenu()],
        ];
        extras.append(...features.map(([icon, caption, run]) => this.button('', run, 'wechat-feature', caption)));
        [...extras.children].forEach((button, index) => button.append(this.el('span', 'feature-icon', this.icon(features[index][0])), this.el('span', '', features[index][1])));
        const toggle = this.iconButton('add', '展开消息功能区', () => { this.chatExtras = !this.chatExtras; this.chatStickers = false; this.render(this.state); }, 'compose-add');
        toggle.setAttribute('aria-expanded', String(!!this.chatExtras));
        const sendButton = this.button('发送', () => send('send'), 'send'); sendButton.hidden = this.voiceMode || !input.value.trim();
        const voiceToggle = this.iconButton(this.voiceMode ? 'keyboard' : 'voice', this.voiceMode ? '切换文字输入' : '切换语音输入', () => { this.voiceMode = !this.voiceMode; this.chatStickers = false; this.chatExtras = false; this.render(this.state); }, 'compose-voice');
        voiceToggle.setAttribute('aria-pressed', String(!!this.voiceMode));
        const voiceInput = this.button('点击输入语音消息', () => this.voiceEditor(speaker.value), 'voice-input'); voiceInput.hidden = !this.voiceMode;
        input.hidden = !!this.voiceMode;
        const composer = this.el('div', 'compose', quote, this.el('div', 'input-row', voiceToggle, input, voiceInput,
            this.iconButton(this.chatStickers ? 'keyboard' : 'smile', '表情', sticker, 'compose-emoji'), toggle, sendButton), extras,
            this.chatStickers ? this.stickerTray(speaker.value) : null);
        input.addEventListener('input', () => { sendButton.hidden = this.voiceMode || !input.value.trim(); });
        return this.el('div', 'chat-screen wechat-chat', messages, composer);
    }

    chatDetails(state, controls, speaker) {
        if (!state?.thread) return;
        const thread = state.thread;
        const members = state.people.filter(person => thread.members.includes(person.id) && (thread.members.length > 2 || person.id !== PLAYER));
        const tiles = this.el('div', 'chat-detail-members', ...members.map(person => {
            const button = this.button('', () => this.dialog(person.name, this.el('div', 'avatar-editor-preview', this.avatar(person, 'large'), this.el('strong', '', person.name))), 'chat-member');
            button.append(this.avatar(person, 'large'), this.el('span', '', person.name)); return button;
        }));
        const group = state.groups?.find(item => item.id === thread.id);
        const add = this.button('', () => this.groupEditor(state, thread.members.filter(id => id !== PLAYER), group), 'chat-member add-member', group ? '添加群成员' : '发起群聊');
        add.append(this.el('span', 'member-add-tile', this.icon('add')), this.el('span', 'member-add-caption', '添加')); tiles.append(add);
        const row = (title, callback, extra = null) => {
            const button = this.button('', callback, 'chat-detail-row'); button.append(this.el('span', '', title), extra || this.icon('right')); return button;
        };
        const pin = this.input('checkbox', state.prefs.pins?.includes(thread.id)); pin.setAttribute('aria-label', '置顶聊天');
        const mute = this.input('checkbox', state.prefs.muted?.includes(thread.id)); mute.setAttribute('aria-label', '消息免打扰');
        const update = async (name, data) => { const opened = this.pop; if (await this.action(name, data) && this.pop === opened) this.chatDetails(this.state, controls, speaker); };
        pin.onchange = () => update('pin'); mute.onchange = () => update('muteChat', { enabled: mute.checked });
        const clear = () => this.dialog('清空聊天记录？', this.el('div', 'form', this.small('清空此会话在小手机中的显示。原始记录和酒馆正文保留，可在聊天详情中恢复显示。')),
            async () => { await this.action('clearChatDisplay'); this.chatDetails(this.state, controls, speaker); });
        const body = this.el('div', 'wechat-page-body chat-detail-body', tiles,
            !group ? this.el('div', 'chat-detail-section', row('社交网名', () => this.socialNicknameEditor(this.state, thread.members.find(id => id !== PLAYER)))) : null,
            group ? this.el('div', 'chat-detail-section', row('群聊名称', () => this.groupNameEditor(this.state, controls, speaker), this.el('span', 'chat-detail-value', group.name === '群聊' ? '未命名' : group.name, this.icon('right')))) : null,
            this.el('div', 'chat-detail-section', row('查找聊天内容', () => this.chatSearch())),
            this.el('div', 'chat-detail-section', this.el('label', 'chat-detail-row', this.el('span', '', '消息免打扰'), mute), this.el('label', 'chat-detail-row', this.el('span', '', '置顶聊天'), pin)),
            this.el('div', 'chat-detail-section', row('设置当前聊天背景', () => this.backgroundEditor(state, { type: 'chat', thread: thread.id, scope: state.scope }))),
            this.el('div', 'chat-detail-section', row('清空聊天记录', clear), state.prefs.hiddenBefore?.[thread.id] ? row('恢复聊天显示', () => update('restoreChatDisplay')) : null),
            this.el('div', 'chat-detail-section', group
                ? row('删除群聊', () => this.removeConversation(state, group, true))
                : row('删除联系人', () => this.removeConversation(state, state.people.find(person => person.id === thread.members.find(id => id !== PLAYER)), false))),
            this.el('div', 'chat-detail-section', row('角色与回复设置', () => this.dialog('角色与回复', this.el('div', 'form', thread.members.length > 2 ? speaker : null,
                this.button('请求回复', () => { this.closeDialog(); this.action('reply', { actor: speaker.value }); }, 'outline'),
                this.button('角色主动发消息', () => { this.closeDialog(); this.action('initiative', { actor: speaker.value }); }, 'outline'),
                this.button('预览上下文', () => { this.closeDialog(); this.action('preview', { actor: speaker.value }).then(ok => { if (ok) this.navigate('debug'); }); }, 'outline'),
                this.button('更多操作', () => this.dialog('会话操作', controls), 'link'))))));
        this.fullPage(group ? `聊天信息（${thread.members.length}）` : '聊天信息', body);
    }

    chatSearch() {
        const input = this.input('search', '', '搜索聊天内容'); input.setAttribute('aria-label', '查找聊天内容');
        const results = this.el('div', 'chat-search-results');
        let timer;
        input.oninput = () => { this.host.clearTimeout(timer); timer = this.host.setTimeout(() => this.action('searchChat', { text: input.value }), 150); };
        this.fullPage('查找聊天内容', this.el('div', 'wechat-page-body chat-search', input, results));
        this.pop.dataset.chatSearch = 'true';
        this.dialogCleanup = () => this.host.clearTimeout(timer);
        this.action('searchChat', { text: '' }); input.focus();
    }

    chatSearchResults(query, rows) {
        if (this.pop?.dataset.chatSearch !== 'true' || this.pop.querySelector('input')?.value !== query) return;
        const results = this.pop.querySelector('.chat-search-results');
        results.replaceChildren(this.small(`找到 ${rows.length}${rows.length === 100 ? '+' : ''} 条消息`), ...rows.map(row => this.button(`${row.speaker}：${row.text}`, () => this.openMessage(this.state, row), 'chat-search-result')));
    }

    fullPage(title, body, right = null) {
        const header = this.el('div', 'wechat-page-head', this.iconButton('back', '返回聊天', () => this.closeDialog()), this.el('strong', '', title), right || this.el('span'));
        this.dialog(title, this.el('div', 'wechat-page', header, body));
        this.pop.classList.add('wechat-full-dialog');
    }

    voiceEditor(actor) {
        const text = this.el('textarea', 'voice-text'); text.rows = 5; text.maxLength = 1800; text.placeholder = '点击输入语音消息'; text.value = this.voiceDraft || '';
        text.setAttribute('aria-label', '语音消息文字');
        text.oninput = () => { this.voiceDraft = text.value; };
        const error = this.el('p', 'editor-error'); error.setAttribute('role', 'alert');
        const send = this.button('发送语音', () => {
            const content = text.value.trim();
            if (!content) { error.textContent = '请输入语音消息内容'; text.focus(); return; }
            const sec = Math.min(60, Math.max(1, Math.ceil([...content].length / 4)));
            this.closeDialog();
            this.action('send', { actor, text: `语音：${content}`, quote: this.quote, payload: { components: [{ type: 'voice', text: content, fields: { sec: String(sec), estimated: 'true' } }] } });
        }, 'wechat-primary');
        this.dialog('输入语音消息', this.el('div', 'form voice-editor', text, this.small('文字将显示为语音气泡，点击气泡可查看原文；秒数按字数估算。'), error, send));
        text.focus();
    }

    moneyEditor(type, actor) {
        const red = type === 'red';
        const state = this.state;
        const peers = state.people.filter(person => person.id !== PLAYER && state.thread.members.includes(person.id));
        const target = this.select(peers.map(person => [person.id, person.name]), peers.find(person => person.id === actor)?.id || peers[0]?.id);
        target.setAttribute('aria-label', '收款人');
        const recipient = this.el('div', 'money-recipient', this.avatar(peers.find(person => person.id === target.value), 'large'), this.el('span', '', red ? '发红包给' : '转账给', target));
        const amount = this.input('text', '', '0.00'); amount.inputMode = 'decimal'; amount.maxLength = 11; amount.setAttribute('aria-label', red ? '红包金额' : '转账金额');
        const note = this.input('text', red ? '恭喜发财，大吉大利' : '', red ? '恭喜发财，大吉大利' : '添加转账说明'); note.maxLength = 80;
        note.setAttribute('aria-label', red ? '红包祝福语' : '转账说明');
        const total = this.el('strong', 'money-total', '¥0.00');
        amount.oninput = () => { total.textContent = /^\d+(?:\.\d{0,2})?$/.test(amount.value) ? `¥${Number(amount.value).toFixed(2)}` : '¥0.00'; };
        target.onchange = () => recipient.firstElementChild.replaceWith(this.avatar(peers.find(person => person.id === target.value), 'large'));
        const error = this.el('p', 'editor-error'); error.setAttribute('role', 'alert');
        const submit = this.button(red ? '塞钱进红包' : '转账', () => {
            const raw = amount.value.trim();
            if (!/^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/.test(raw) || Number(raw) <= 0) { error.textContent = '请输入大于 0 的金额，最多两位小数'; amount.focus(); return; }
            const value = Number(raw).toFixed(2);
            const person = peers.find(person => person.id === target.value);
            if (!person) { error.textContent = '请选择收款人'; return; }
            const content = note.value.trim() || (red ? '恭喜发财，大吉大利' : '转账');
            this.closeDialog();
            this.action('send', { actor: target.value, text: `${red ? '红包' : '转账'}：给${person.name} ¥${value}，${content}`, payload: { components: [{ type, text: content, fields: { amount: value, state: red ? '待领取' : '待收款', to: person.name } }] } });
        }, 'wechat-primary money-submit');
        const body = this.el('div', `wechat-page-body money-editor ${red ? 'red-editor' : 'transfer-editor'}`, recipient,
            this.el('div', 'money-form', this.el('label', 'money-amount-field', this.el('span', '', red ? '单个金额' : '转账金额'), this.el('div', '', this.el('span', 'currency', '¥'), amount)),
                this.el('label', 'money-note-field', note)), total, error, submit, this.el('small', 'money-context', '小手机聊天内的剧情记录'));
        this.fullPage(red ? '发红包' : '转账', body);
        this.pop.classList.add(red ? 'red-editor-page' : 'transfer-editor-page');
    }

    locationMap() {
        return this.el('span', 'wechat-map', this.el('span', 'map-water'), this.el('span', 'map-park'), this.el('span', 'map-road one'), this.el('span', 'map-road two'), this.el('span', 'map-pin', this.icon('location')), this.el('small', 'map-caption', '位置示意'));
    }

    locationEditor(actor) {
        const place = this.input('text', '', '搜索地点或输入位置名称'); place.maxLength = 80; place.setAttribute('aria-label', '位置名称');
        const address = this.input('text', '', '详细地址或位置说明'); address.maxLength = 300; address.setAttribute('aria-label', '详细地址');
        const title = this.el('strong', '', '选择要发送的位置');
        const detail = this.el('small', '', '填写地点名称和地址');
        const error = this.el('p', 'editor-error'); error.setAttribute('role', 'alert');
        place.oninput = () => { title.textContent = place.value || '选择要发送的位置'; };
        address.oninput = () => { detail.textContent = address.value || '填写地点名称和地址'; };
        const submit = this.button('发送', () => {
            if (!place.value.trim()) { error.textContent = '请填写位置名称'; place.focus(); return; }
            this.closeDialog();
            this.action('send', { actor, text: `位置：${place.value.trim()}${address.value.trim() ? `，${address.value.trim()}` : ''}`, payload: { components: [{ type: 'loc', text: address.value.trim(), fields: { place: place.value.trim() } }] } });
        }, 'wechat-primary location-send');
        this.fullPage('发送位置', this.el('div', 'wechat-page-body location-editor', this.el('label', 'location-search', this.icon('search'), place), this.locationMap(),
            this.el('div', 'location-selection', this.icon('location'), this.el('span', '', title, detail), this.icon('check')), this.el('label', 'location-address', address), error,
            this.small('按填写的地点分享位置')), submit);
    }

    openMessage(state, row) {
        const parts = row.payload?.components;
        if (parts?.length === 1 && parts[0].type === 'photo') { const part = parts[0]; const generated = state.albumRows?.find(item => item.sourceId === row.id && item.index === 0 && item.generated); return this.photoViewer({ sourceId: row.id, index: 0, ownerId: row.speakerId, description: part.displayText || part.text, prompt: part.fields?.prompt, url: generated?.url || state.albumRows?.find(item => item.id === part.fields?.photoId)?.url || photoSource(part.fields?.src || part.fields?.url), title: '聊天图片' }); }
        if (parts?.length === 1 && parts[0].type === 'link' && parts[0].fields?.postId) return this.action('openSharedPost', { id: parts[0].fields.postId });
        if (parts?.length === 1 && parts[0].fields?.kind === 'selene-music') return this.dialog('分享的歌曲', this.el('div', 'form', this.messageComponent(parts[0]), this.button('打开音乐', () => this.navigate('music'), 'outline')));
        if (parts?.length !== 1 || !['voice', 'red', 'pay', 'loc'].includes(parts[0].type)) return this.messageMenu(state, row);
        const part = parts[0]; const fields = part.fields || {};
        const more = this.button('消息操作', () => this.messageMenu(state, row), 'link');
        if (part.type === 'voice') {
            this.dialog('语音转文字', this.el('div', 'form', this.el('p', 'voice-transcript', part.text || row.text), fields.estimated === 'true' ? this.small('文字模拟语音 · 时长按字数估算') : null, more));
        } else if (part.type === 'loc') {
            this.fullPage('位置信息', this.el('div', 'wechat-page-body location-editor', this.locationMap(), this.el('div', 'location-info', this.el('h2', '', fields.place || '位置'), this.el('p', '', part.text)), more));
        } else {
            const red = part.type === 'red';
            this.fullPage(red ? '红包详情' : '转账详情', this.el('div', `wechat-page-body money-detail ${red ? 'red-detail' : ''}`, this.icon(red ? 'envelope' : 'transfer'),
                this.el('h2', '', fields.state || '状态未知'), this.el('p', '', fields.to ? `${row.speaker} → ${fields.to}` : row.speaker),
                fields.amount ? this.el('strong', 'money-total', `¥${fields.amount}`) : null, this.el('p', '', part.text), more));
        }
    }

    stickerTray(actor) {
        const search = this.input('search', this.stickerSearch || '', '搜索表情'); search.setAttribute('aria-label', '搜索表情'); search.dataset.keep = 'sticker-search';
        const grid = this.el('div', 'wechat-sticker-grid');
        const caption = this.el('small', 'sticker-category-name');
        const tabs = this.el('div', 'wechat-sticker-tabs');
        const draw = () => {
            const tab = this.stickerCategory || 'stickers';
            caption.textContent = tab === 'custom' ? '添加的单个表情' : tab === 'emoji' ? '常用表情' : '表情包';
            const query = search.value.trim().toLowerCase();
            const add = this.button('', () => this.addSticker(), 'sticker-add', '添加表情'); add.append(this.icon('add'));
            const rows = tab === 'custom' ? this.settings.customStickers || [] : [...Object.entries(STICKERS).map(([name, url]) => ({ name, url })), ...(this.settings.customStickers || [])];
            const entries = tab === 'emoji' ? ['😀', '😁', '😂', '🥹', '🥰', '😍', '😘', '😋', '😎', '🥳', '😭', '😤', '😴', '🤔', '🙈', '👀', '👍', '👏', '🙏', '🤝', '❤️', '💔', '🌹', '🎉'].map(emoji => this.button(emoji, () => { this.draft += emoji; this.render(this.state); }, 'emoji-item', emoji)) : rows.filter(item => !query || item.name.toLowerCase().includes(query)).map(({ name, url }) => {
                const button = this.button('', () => this.action('send', { actor, text: name, payload: { components: [{ type: 'sticker', text: name, fields: { name, src: url } }] } }), 'sticker-item', name);
                const image = this.el('img'); image.src = url; image.alt = name; image.loading = 'lazy'; button.append(image); return button;
            });
            grid.replaceChildren(...(tab === 'emoji' ? [] : [add]), ...entries);
            for (const button of tabs.children) button.classList.toggle('active', button.dataset.tab === tab);
        };
        tabs.append(...[['emoji', 'smile', '表情'], ['custom', 'heart', '我添加的'], ['stickers', 'gift', '表情包']].map(([key, icon, title]) => {
            const button = this.iconButton(icon, title, () => { this.stickerCategory = key; draw(); }); button.dataset.tab = key; return button;
        }));
        search.oninput = () => { this.stickerSearch = search.value; draw(); };
        draw();
        return this.el('div', 'wechat-sticker-tray', tabs, this.el('label', 'sticker-search', this.icon('search'), search), caption, grid);
    }

    addSticker() {
        const name = this.input('text', '', '表情名称'); name.maxLength = 40;
        const url = this.input('url', '', 'https://… 表情图片地址');
        const error = this.el('p', 'editor-error');
        this.dialog('添加表情', this.el('div', 'form', name, url, error, this.button('添加', async () => {
            if (!name.value.trim() || !safeUrl(url.value)) { error.textContent = '请填写名称和有效的图片地址'; return; }
            if (this.settings.customStickers.length >= 100 && !this.settings.customStickers.some(item => item.name === name.value.trim())) { error.textContent = '最多添加 100 个表情'; return; }
            const customStickers = [...this.settings.customStickers.filter(item => item.name !== name.value.trim()), { name: name.value.trim(), url: safeUrl(url.value) }];
            this.stickerCategory = 'custom'; this.stickerSearch = '';
            if (await this.action('settings', { customStickers })) this.closeDialog();
        }, 'wechat-primary')));
    }

    shareCurrentMusic(actor) {
        const state = this.musicIsland.readCurrent();
        if (!state?.loaded || !(state.title || state.trackId)) { this.dialog('分享音乐', this.small('Selene 还没有加载歌曲，播放一首后再来分享。')); return; }
        const title = state.title || '未知曲目', artist = state.artist || '未知歌手';
        const text = `分享音乐：《${title}》— ${artist}`;
        // Deliberate user message only. No runtime refs, audio URLs, keys or library data.
        const part = { type: 'link', text, fields: { kind: 'selene-music', title, artist, src: safeUrl(state.artwork) } };
        const scope = this.state?.scope, thread = this.state?.thread?.id;
        const send = this.button('发送音乐卡片', async () => {
            if (this.view !== 'chat' || scope !== this.state?.scope || thread !== this.state?.thread?.id) return;
            send.disabled = true;
            if (await this.action('send', { actor, text, payload: { components: [part] } })) this.closeDialog();
            else send.disabled = false;
        }, 'wechat-primary');
        this.dialog('分享音乐', this.el('div', 'form', this.messageComponent(part), this.small('只分享这首歌的名称、歌手和封面，不重新搜索。'), send));
    }

    photoAlbumPicker(selectPhoto) {
        const panel = this.el('section', 'attachment-album-picker');
        const rows = (this.state?.albumRows || []).filter(photo => photo.inAlbum !== false && photo.url);
        panel.append(this.el('div', 'attachment-item-head', this.el('strong', '', '从相册选择'), this.button('收起', () => panel.remove(), 'link')),
            rows.length ? this.el('div', 'attachment-album-grid', ...rows.map(photo => {
                const button = this.button('', () => { selectPhoto(photo); panel.remove(); }, 'attachment-album-photo', photo.description || photo.title || '相册照片');
                const image = this.el('img'); image.src = photo.url; image.alt = photo.description || photo.title || '相册照片'; image.loading = 'lazy';
                button.append(image, this.el('small', '', photo.title || photo.description || '照片')); return button;
            })) : this.small('当前相册还没有图片，可先在相册添加或生成图片。'));
        return panel;
    }

    attachmentEditor(type, actor, caption) {
        const names = { photo: '照片', loc: '位置', red: '红包', pay: '转账', voice: '语音', link: '链接', file: '文件' };
        const name = caption || names[type];
        const items = this.el('div', 'attachment-items');
        const entries = [];
        const add = () => {
            const text = this.el('textarea'); text.rows = 2; text.maxLength = 1800; text.placeholder = type === 'photo' ? '描述这张照片，也可让 AI 根据当前剧情拟定' : '名称与说明';
            const url = ['photo', 'link'].includes(type) ? this.input('url', '', '已有图片或网页地址（可选）') : null;
            const prompt = type === 'photo' ? this.el('textarea', 'attachment-photo-prompt') : null;
            if (prompt) { prompt.rows = 3; prompt.maxLength = 6000; prompt.placeholder = '英文生图提示词（可选，可只发送画面说明）'; prompt.setAttribute('aria-label', '照片英文提示词'); }
            const preview = this.el('div', 'attachment-photo-preview'); preview.hidden = true;
            const entry = { text, url, prompt, photo: null, busy: false };
            const node = this.el('div', 'attachment-item', text, url);
            const choose = photo => {
                entry.photo = photo; text.value = photo.description || text.value; prompt.value = photo.prompt || ''; url.value = '';
                const image = this.el('img'); image.src = photo.url; image.alt = photo.description || photo.title || '所选图片';
                preview.replaceChildren(image, this.el('small', '', photo.title || '已选择相册图片'), this.button('取消图片，仅发描述', () => { entry.photo = null; preview.hidden = true; }, 'link'));
                preview.hidden = false;
            };
            if (type === 'photo') {
                const busy = value => { entry.busy = value; for (const control of node.querySelectorAll('button,input,textarea,select')) control.disabled = value; update(); };
                const ai = this.button('AI 生成说明与提示词', async () => {
                    busy(true);
                    try {
                        const result = await this.action('draftImagePrompt', { actor, description: text.value, prompt: prompt.value });
                        if (result && node.isConnected) { text.value = result.description; prompt.value = result.prompt; error.textContent = ''; }
                    } finally { busy(false); }
                }, 'outline');
                const generate = this.button('生成图片（可选）', async () => {
                    if (!text.value.trim() && !prompt.value.trim()) { error.textContent = '请先填写画面说明，或让 AI 生成文字草稿。'; return; }
                    busy(true);
                    try {
                        const result = await this.action('generateAttachmentImage', { description: text.value, prompt: prompt.value });
                        if (result && node.isConnected) { choose(result); error.textContent = ''; }
                    } finally { busy(false); }
                }, 'outline');
                node.prepend(this.el('div', 'attachment-item-head', this.el('strong', '', `照片 ${entries.length + 1}`), this.button('移除', () => {
                    entries.splice(entries.indexOf(entry), 1); node.remove(); update();
                }, 'link')));
                node.append(prompt, preview, this.el('div', 'attachment-photo-tools', ai, generate, this.button('从相册选择', () => {
                    node.querySelector('.attachment-album-picker')?.remove(); node.append(this.photoAlbumPicker(choose));
                }, 'outline')));
                url.addEventListener('input', () => { entry.photo = null; preview.hidden = true; });
            }
            entries.push(entry); items.append(node); update();
        };
        const more = this.button('＋ 再加一张照片', add, 'outline'); more.hidden = type !== 'photo';
        const error = this.el('p', 'editor-error'); error.setAttribute('role', 'alert');
        const send = this.button('发送', async () => {
            const parts = entries.map(({ text, url, prompt, photo }) => ({ type, text: text.value.trim() || (photo ? photo.description : '') || prompt?.value.trim() || '', fields: { ...(photo ? { photoId: photo.id } : safeUrl(url?.value) ? { src: safeUrl(url.value) } : {}), ...(prompt?.value.trim() ? { prompt: prompt.value.trim() } : {}) } }));
            if (!parts.length || entries.some(({ text, url, prompt, photo }) => !text.value.trim() && !url?.value.trim() && !photo && !prompt?.value.trim() || !photo && url?.value.trim() && !safeUrl(url.value))) {
                error.textContent = '每张照片请填写画面说明、英文提示词或有效的图片地址，也可从相册选择。'; return;
            }
            send.disabled = true;
            if (await this.action('send', { actor, text: parts.map(part => `${name}：${part.text || '图片'}`).join('\n'), payload: { components: parts } })) this.closeDialog();
            else send.disabled = false;
        }, 'wechat-primary');
        const update = () => { more.disabled = entries.length >= 9; send.disabled = !entries.length || entries.some(entry => entry.busy); send.textContent = type === 'photo' ? `发送 ${entries.length} 张照片` : '发送'; };
        add();
        this.dialog(name, this.el('div', 'form attachment-editor', items, more, type === 'photo' ? this.small('AI 先准备可编辑的文字草稿；是否生成图片由你选择。') : null, error, send));
    }

    messageComponent(part, photoContext = {}) {
        const fields = part.fields || {};
        if (part.type === 'link' && fields.kind === 'selene-music') return this.el('span', 'shared-music-card', this.musicApp.art(fields.src, 'shared-music-art'), this.el('span', 'shared-music-info', this.el('strong', '', fields.title || '分享的歌曲'), this.el('span', '', fields.artist || '未知歌手'), this.el('small', '', '♫ Selene 音乐')));
        if (part.type === 'link' && fields.postId) return this.el('span', 'shared-social-card', this.el('strong', '', fields.title || '分享的动态'), this.el('span', '', part.text), this.el('small', '', `${PLATFORMS[fields.platform] || '动态'} · ${fields.author || ''}`));
        if (part.type === 'voice') {
            const seconds = Number(fields.sec);
            const known = Number.isInteger(seconds) && seconds >= 1 && seconds <= 60;
            const node = this.el('span', 'wechat-voice', this.icon('voice'), this.el('span', '', known ? `${seconds}″` : '语音'));
            node.style.width = `${known ? Math.min(220, 65 + seconds * 3) : 100}px`;
            return node;
        }
        if (['red', 'pay'].includes(part.type)) {
            const red = part.type === 'red';
            return this.el('span', `wechat-money-card ${red ? 'red' : 'pay'}`, this.el('span', 'money-card-main', this.icon(red ? 'envelope' : 'transfer'),
                this.el('span', 'money-card-copy', this.el('strong', '', red ? part.text || '恭喜发财，大吉大利' : fields.amount ? `¥${fields.amount}` : '转账'),
                    this.el('small', '', fields.state || (red ? '红包' : part.text || '转账')))),
                this.el('span', 'money-card-footer', red ? '微信红包' : '微信转账'));
        }
        if (part.type === 'loc') return this.el('span', 'wechat-location-card', this.el('strong', '', fields.place || '位置分享'), this.el('small', '', part.text || ''), this.locationMap());
        if (part.type === 'sticker') {
            const name = fields.name || part.text;
            const url = STICKERS[name] || safeUrl(fields.src || part.text);
            if (url) { const image = this.el('img', 'im-sticker'); image.src = url; image.alt = name || '表情'; image.loading = 'lazy'; return image; }
        }
        if (['photo', 's-image'].includes(part.type)) {
            const description = part.displayText || part.text;
            const generated = this.state?.albumRows?.find(row => row.sourceId === photoContext.sourceId && row.index === (photoContext.index || 0) && row.generated);
            const url = photoSource(generated?.url || this.state?.albumRows?.find(row => row.id === fields.photoId)?.url || fields.src || fields.url);
            if (url) {
                const image = this.el('img', 'im-photo'); image.src = url; image.alt = description || '图片'; image.loading = 'lazy';
                image.onclick = event => { event.stopPropagation(); this.photoViewer({ ...photoContext, url, description, prompt: fields.prompt, title: '聊天图片' }); };
                return image;
            }
            const copy = this.el('span', 'im-photo-description', this.el('span', 'im-photo-description-heading', this.icon('photo')), this.el('span', 'im-photo-description-copy', description || '暂无画面说明'));
            copy.onclick = event => { event.stopPropagation(); this.photoViewer({ ...photoContext, description, prompt: fields.prompt, title: '图片说明' }); };
            return copy;
        }
        const names = { trans: '翻译', reply: '回复', photo: '图片', video: '视频画面', voice: '语音', loc: '位置', red: '红包', pay: '转账', call: '通话', file: '文件', link: '链接', sys: '系统提示', 's-image': '图片说明', 's-video': '视频画面' };
        return this.el('span', `im-component im-${part.type}`, this.el('strong', '', names[part.type] || part.type), this.el('span', '', part.text || fields.name || fields.title || ''),
            this.el('small', '', Object.entries(fields).filter(([key]) => !['src', 'url', 'name', 'title'].includes(key)).map(([key, value]) => `${key}：${value}`).join(' · ')));
    }

    bindMessagePress(bubble, state, row) {
        let timer; let origin;
        const cancel = () => { this.host.clearTimeout(timer); timer = null; };
        bubble.addEventListener('pointerdown', event => {
            if (event.button !== 0) return;
            origin = [event.clientX, event.clientY]; cancel();
            timer = this.host.setTimeout(() => { if (!bubble.isConnected) return; bubble.suppressClickUntil = Date.now() + 800; this.messageMenu(this.state, row, bubble); }, 450);
        });
        bubble.addEventListener('pointermove', event => { if (origin && Math.hypot(event.clientX - origin[0], event.clientY - origin[1]) > 9) cancel(); });
        for (const event of ['pointerup', 'pointercancel', 'pointerleave']) bubble.addEventListener(event, cancel);
        bubble.addEventListener('contextmenu', event => { event.preventDefault(); cancel(); bubble.suppressClickUntil = Date.now() + 800; this.messageMenu(this.state, row, bubble); });
    }

    messageMenu(state, row, anchor) {
        anchor ||= [...this.content.querySelectorAll('.bubble')].find(bubble => bubble.dataset.messageId === row.id);
        const editable = row.origin === 'phone' && !state.trail.byEvent.has(row.id);
        const retry = editable && row.speakerId !== PLAYER && row.kind === 'message' && row.id === state.rows[0]?.id;
        const run = callback => () => { this.closeDialog(); callback(); };
        const buttons = [
            ['copy', '复制', async () => {
                try { await this.host.navigator.clipboard.writeText(row.text); this.notice('已复制', false); }
                catch { const text = this.el('textarea'); text.value = row.text; text.readOnly = true; this.dialog('复制消息', text); text.select(); }
            }],
            ['share', '转发', () => this.forwardEditor(state, row)],
            ['star', '收藏', () => this.action('remember', { id: row.id, text: row.memory || row.text.slice(0, 300) })],
            ['edit', '编辑', () => this.editDialog(row, 'edit'), !editable || !!row.payload?.components?.length],
            ['trash', row.speakerId === PLAYER ? '撤回' : '删除', () => this.dialog('移除这条手机消息？', this.small('只移除未交接的手机消息。'), () => this.action('delete', { id: row.id })), !editable],
            ['quote', '引用', () => { this.quote = row.text; this.render(this.state); }],
            ['sync', row.sync === false ? '同步正文' : '仅留手机', () => this.action('toggleSync', { id: row.id }), !editable],
            ['spark', '重新生成', () => this.action('retry', { id: row.id }), !retry],
            ['messages', '详情', () => this.dialog('消息详情', this.el('div', 'form', this.el('p', 'voice-transcript', row.text), this.small(`${this.status(row, state.trail)} · 来源 #${row.floor} · 仅 ${row.audienceNames.join('、')} 可见`), this.button('长期记忆 / 当前状态', () => this.editDialog(row, 'remember'), 'outline')))],
            ['close', '关闭', () => {}],
        ];
        const grid = this.el('div', 'message-context-grid', ...buttons.map(([icon, caption, callback, disabled]) => {
            const button = this.button('', run(callback), '', caption); button.disabled = !!disabled; button.append(this.icon(icon), this.el('span', '', caption)); return button;
        }));
        this.dialog('消息操作', grid);
        const pop = this.pop; pop.classList.add('message-context');
        const overlay = this.el('div', 'message-context-dismiss'); overlay.onclick = () => this.closeDialog(); pop.before(overlay);
        const panel = this.panel.getBoundingClientRect();
        const rect = anchor?.getBoundingClientRect();
        const scale = this.displayScale || 1;
        const panelWidth = panel.width / scale, panelHeight = panel.height / scale;
        const width = Math.min(300, panelWidth - 24);
        pop.style.width = `${width}px`;
        const height = pop.offsetHeight;
        const center = rect ? ((rect.left + rect.right) / 2 - panel.left) / scale : panelWidth / 2;
        const left = Math.min(panelWidth - width - 12, Math.max(12, center - width / 2));
        const minTop = (this.nav.getBoundingClientRect().bottom - panel.top) / scale + 8;
        const above = rect && (rect.top - panel.top) / scale - height - 10 >= minTop;
        const top = rect ? (above ? (rect.top - panel.top) / scale - height - 10 : (rect.bottom - panel.top) / scale + 10) : minTop;
        Object.assign(pop.style, { left: `${left}px`, top: `${Math.max(minTop, Math.min(panelHeight - height - 30, top))}px` });
        pop.classList.toggle('below', !!rect && !above);
        pop.style.setProperty('--context-tip', `${Math.max(20, Math.min(width - 20, center - left))}px`);
        anchor?.classList.add('message-selected');
        this.dialogCleanup = () => { overlay.remove(); anchor?.classList.remove('message-selected'); };
    }

    forwardEditor(state, row) {
        const targets = state.threads.filter(thread => thread.members.includes(PLAYER));
        let target = state.thread?.id || targets[0]?.id;
        const choices = this.el('div', 'forward-targets');
        choices.setAttribute('role', 'group'); choices.setAttribute('aria-label', '转发给角色或群聊，可左右滑动');
        const send = this.button('发送给所选角色 / 群聊', async () => {
            send.disabled = true;
            if (await this.action('forward', { id: row.id, thread: target })) {
                if (layer) layer.remove(); else this.closeDialog();
            } else send.disabled = false;
        }, 'wechat-primary');
        for (const thread of targets) {
            const person = thread.members.length === 2 ? state.people.find(person => person.id === thread.members.find(id => id !== PLAYER)) : null;
            const choice = this.button('', () => {
                target = thread.id;
                for (const button of choices.children) button.setAttribute('aria-pressed', String(button === choice));
                send.textContent = `发送给${thread.name}`;
            }, 'forward-target', thread.name);
            choice.setAttribute('aria-pressed', String(thread.id === target));
            if (thread.members.length > 2) {
                choice.append(this.el('span', 'forward-group-avatar', ...thread.members.slice(0, 4).map(id => this.avatar(state.people.find(person => person.id === id)))));
            } else choice.append(this.avatar(person || thread));
            choice.append(this.el('span', 'forward-target-name', thread.name)); choices.append(choice);
        }
        send.disabled = !targets.length;
        const body = this.el('div', 'form forward-editor', targets.length ? choices : this.small('暂无可转发的角色或群聊'), this.el('p', 'forward-preview', `${row.payload?.title || ''} ${row.text}`.trim()), send);
        let layer;
        if (this.pop?.querySelector('.note-detail, .social-detail')) layer = this.noteSheet('分享至', body);
        else this.dialog('分享至', body);
    }

    noteSheet(title, body) {
        this.dismissComment?.();
        const note = this.pop?.querySelector('.note-detail, .social-detail');
        if (!note) return null;
        note.querySelector('.note-inline-layer')?.remove();
        const layer = this.el('div', 'note-inline-layer');
        const panel = this.el('div', 'note-inline-sheet', this.el('div', 'dialog-head', this.el('h3', '', title), this.button('×', () => layer.remove(), 'dismiss', '关闭输入面板')), body);
        layer.append(panel); layer.onclick = event => { if (event.target === layer) layer.remove(); };
        layer.addEventListener('keydown', event => { if (event.key === 'Escape') { event.stopPropagation(); layer.remove(); } });
        note.append(layer); panel.querySelector('textarea,input,select,button')?.focus({ preventScroll: true }); return layer;
    }

    bindCommentDismiss(panel, close) {
        this.commentCleanup?.();
        const cleanup = () => {
            this.shadow.removeEventListener('pointerdown', outside, true);
            this.doc.removeEventListener('pointerdown', outsidePhone, true);
            this.shadow.removeEventListener('keydown', escape, true);
            if (this.commentCleanup === cleanup) { this.commentCleanup = null; this.dismissComment = null; }
        };
        const dismiss = () => { cleanup(); close(); };
        const outside = event => { if (!event.composedPath().includes(panel)) dismiss(); };
        const outsidePhone = event => { if (!event.composedPath().includes(this.root)) dismiss(); };
        const escape = event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); dismiss(); } };
        this.commentCleanup = cleanup; this.dismissComment = dismiss;
        this.shadow.addEventListener('pointerdown', outside, true);
        this.doc.addEventListener('pointerdown', outsidePhone, true);
        this.shadow.addEventListener('keydown', escape, true);
    }

    commentEditor(post, quote = '') {
        this.dismissComment?.();
        const opened = this.pop;
        const input = this.el('textarea', 'social-comment-input'); input.rows = 2; input.maxLength = 2000;
        input.placeholder = quote ? '回复这条评论…' : '留下你的想法吧'; input.setAttribute('aria-label', '评论内容');
        const error = this.el('p', 'editor-error');
        const extras = this.el('div', 'comment-extras'); extras.hidden = true;
        const insert = text => {
            input.setRangeText(text, input.selectionStart, input.selectionEnd, 'end');
            input.dispatchEvent(new Event('input')); input.focus({ preventScroll: true });
        };
        const send = this.button('发送', async () => {
            if (!input.value.trim()) return;
            send.disabled = true;
            const ok = await this.action('comment', { id: post.id, text: input.value, quote });
            if (ok && this.pop === opened && opened?.querySelector('.note-detail, .social-detail')) {
                this.socialDetail(this.state, this.state.rows.find(row => row.id === post.id) || post, true);
            }
            else if (ok && this.pop === dialog) this.closeDialog();
            else { error.textContent = this.banner.firstElementChild?.textContent || '评论未保存，请重试。'; send.disabled = false; }
        }, 'comment-send'); send.disabled = true;
        input.oninput = () => { send.disabled = !input.value.trim(); error.textContent = ''; };
        const tools = this.el('div', 'comment-compose-tools',
            this.iconButton('mention', '提及联系人', () => {
                extras.hidden = false; extras.replaceChildren(...this.state.people.filter(person => person.id !== PLAYER).map(person => this.button(`@${person.name}`, () => insert(`@${person.name} `), 'comment-extra')));
            }),
            this.iconButton('smile', '选择表情', () => {
                extras.hidden = false; extras.replaceChildren(...['😊', '🥰', '😂', '👍', '❤️', '🙏', '😭', '✨'].map(emoji => this.button(emoji, () => insert(emoji), 'comment-extra')));
            }), this.el('span', 'comment-compose-spacer'), this.button('取消', () => this.dismissComment?.(), 'comment-cancel'), send);
        const body = this.el('div', 'social-comment-compose', quote ? this.el('div', 'comment-quote', quote) : null, input, extras, tools, error);
        body.dataset.platform = post.thread;
        let dialog;
        if (opened?.querySelector('.note-detail, .social-detail')) {
            const layer = this.noteSheet('', body); const panel = layer.querySelector('.note-inline-sheet'); panel.classList.add('comment-compose-sheet');
            this.bindCommentDismiss(panel, () => layer.remove());
        } else {
            this.dialog('', body); dialog = this.pop; dialog.classList.add('comment-compose-dialog');
            this.bindCommentDismiss(dialog, () => { if (this.pop === dialog) this.closeDialog(); });
        }
        input.focus({ preventScroll: true });
    }

    deleteSocial(row, post) {
        const opened = this.pop;
        const body = this.el('div', 'form', this.small('从小手机移除这条内容。已交接或来自正文的内容只隐藏手机显示，酒馆正文保留。'), this.button('确认删除', async () => {
            if (!(await this.action('deleteSocial', { id: row.id }))) return;
            if (row.kind === 'post') this.closeDialog();
            else if (post && this.pop === opened) this.socialDetail(this.state, this.state.rows.find(item => item.id === post.id) || post, true);
            else this.closeDialog();
        }, 'outline danger'));
        if (opened?.querySelector('.note-detail, .social-detail')) this.noteSheet(row.kind === 'post' ? '删除动态？' : '删除评论？', body);
        else this.dialog(row.kind === 'post' ? '删除动态？' : '删除评论？', body);
    }

    socialPreview(post) {
        if (post.thread === 'redbook') return this.noteDetail(this.state, post);
        if (['forum', 'weibo', 'douyin'].includes(post.thread)) return this.socialDetail(this.state, post);
        const header = this.el('div', 'social-detail-head', this.iconButton('back', `返回${PLATFORMS[post.thread] || '动态'}`, () => this.closeDialog()), this.el('strong', '', post.speaker), this.el('span'));
        const body = this.el('div', 'social-detail-scroll', post.payload?.title ? this.el('h2', '', post.payload.title) : null,
            this.el('p', 'post-text', post.text), this.socialMedia(this.state, post), this.socialReplies(this.state, post));
        this.dialog(post.payload?.title || `${post.speaker}的动态`, this.el('div', 'social-detail social-preview', header, body));
        this.pop.classList.add('social-detail-dialog'); this.pop.dataset.postId = post.id;
    }

    editDialog(row, action) {
        const input = this.el('textarea'); input.rows = 5; input.maxLength = action === 'edit' ? 2000 : 300; input.value = action === 'edit' ? row.text : (row.memory || row.suggestedMemory || row.text.slice(0, 300));
        this.dialog(action === 'edit' ? '编辑消息' : '确认长期记忆', this.el('div', 'form', input, action === 'remember' ? this.small('仅用于同一分支和可见范围。清空可移除。') : null), () => this.action(action, { id: row.id, text: input.value }));
    }

    contacts(state) {
        const list = this.el('div', 'list');
        for (const person of state.people.filter(person => person.id !== PLAYER && !contactDeleted(person, state.prefs))) {
            const row = this.button('', () => this.navigate('chat', threadKey([PLAYER, person.id])), 'list-row');
            row.append(this.avatar(person), this.el('span', 'list-info', this.el('strong', '', person.name), this.el('small', '', person.source || '手动联系人')), this.icon('right'));
            list.append(this.el('div', 'contact-manage-row', row, this.iconButton('trash', `删除${person.name}`, () => this.removeConversation(state, person, false))));
        }
        return this.el('div', 'screen', this.heading('通讯录', 'PEOPLE', this.iconButton('add', '新增联系人', () => this.contactEditor())), this.el('div', 'actions', this.button('重新扫描', () => this.action('scan'), 'outline'), this.button('已删除', () => this.deletedConversations(this.state), 'outline')), state.scanFailed ? this.small('世界书扫描不可用，目前仅列出角色卡与手动联系人。') : null, list);
    }

    removeConversation(state, target, group) {
        if (!target) return;
        this.dialog(group ? '删除群聊？' : '删除联系人？', this.el('div', 'form',
            this.el('strong', '', target.name), this.small(group
                ? '从当前聊天的小手机移除这个群聊，并停止交接其中尚未同步的消息。历史记录保留，可在通讯录 → 已删除恢复。'
                : '从当前聊天的小手机通讯录和私聊列表移除，并停止交接尚未同步的私聊。群内身份和历史记录保留；不会删除酒馆角色卡或世界书。可在通讯录 → 已删除恢复。'),
            this.button('确认删除', async () => { await this.action(group ? 'deleteGroup' : 'deleteContact', { id: target.id }); }, 'outline danger')));
    }

    deletedConversations(state) {
        const contacts = Object.entries(state.prefs.deletedContacts || {}).filter(([, name]) => name).map(([id, name]) => ({ id, name, kind: 'Contact' }));
        const groups = state.groups.filter(group => state.prefs.deletedThreads?.[group.id]).map(group => ({ ...group, kind: 'Group' }));
        this.dialog('已删除的联系人与群聊', this.el('div', 'form', this.small('恢复后显示原有记录；不会重新发送已交接的消息。'),
            ...[...contacts, ...groups].map(item => this.el('div', 'deleted-conversation-row', this.el('span', '', item.name), this.button('恢复', async () => { await this.action(`restore${item.kind}`, { id: item.id, ...(item.kind === 'Group' && !item.members.includes(PLAYER) ? { owner: item.members.find(id => state.people.some(person => person.id === id)) } : {}) }); }, 'outline'))),
            !contacts.length && !groups.length ? this.small('暂无已删除的联系人或群聊。') : null));
    }

    socialCount(state, post, kind) {
        const label = { like: '点赞', comment: '评论', collect: '收藏', share: '分享', repost: '转发' }[kind];
        const known = post.payload?.counts?.find(item => item.kind === label)?.text;
        if (known != null) return known;
        if (kind === 'comment' && /^\d+$/.test(post.payload?.commentCount ?? '')) return post.payload.commentCount;
        if (post.origin === 'tavern' && post.payload?.raw != null) return undefined;
        return kind === 'comment' ? this.socialInfo(state, post).replies.length : reactions(state.rows, post, kind).length;
    }

    socialScreenDetails(post) {
        const payload = post.payload;
        if (!payload?.raw) return null;
        const counts = [...(payload.counts || [])];
        if (post.thread === 'weibo') counts.sort((a, b) => ['转发', '评论', '点赞'].indexOf(a.kind) - ['转发', '评论', '点赞'].indexOf(b.kind));
        return this.el('div', 'social-known-details',
            payload.repost ? this.el('div', 'social-known-repost', payload.repostName ? this.el('strong', '', payload.repostName) : null, this.el('p', 'post-text', payload.repost)) : null,
            payload.location ? this.small(payload.location) : null,
            counts.length ? this.small(counts.map(item => `${item.kind} ${item.text}`).join(' · ')) : null,
            payload.likes ? this.el('p', 'social-known-likes', `赞：${payload.likes}`) : null);
    }

    socialInfo(state, post) {
        const replies = state.rows.filter(row => row.kind === 'comment' && (row.target === post.id || post.reference && row.target === post.reference)).reverse();
        return { replies, person: { ...(state.people.find(person => person.id === post.speakerId) || { name: post.speaker }), ...(post.payload?.avatar ? { avatar: post.payload.avatar } : {}) },
            title: post.payload?.title || post.text.split('\n')[0].slice(0, 60), time: post.rpTime || post.payload?.postedAt || '时间未注明',
            topic: String(post.payload?.community || post.payload?.tags || '综合讨论').split(/[,，#\s]+/).find(Boolean) || '综合讨论',
            likes: this.socialCount(state, post, 'like'), has: kind => reactions(state.rows, post, kind).some(row => row.speakerId === PLAYER) };
    }

    socialMedia(state, post) {
        const media = post.payload?.media || [];
        if (!media.length) return null;
        const grid = this.el('div', 'post-media-grid'); grid.dataset.count = String(media.length);
        for (const [index, part] of media.entries()) {
            const saved = state.albumRows?.find(row => row.sourceId === post.id && row.index === index && row.generated);
            const photo = { sourceId: post.id, index, ownerId: post.speakerId, title: post.payload?.title, description: part.text || post.text, prompt: part.fields?.prompt, url: photoSource(saved?.url || part.fields?.src || part.fields?.url) };
            const tile = this.bindPhotoGesture(this.button('', () => {}, 'post-media-tile', '单击查看，双击生图'), photo);
            if (photo.url) { const image = this.el('img'); image.src = photo.url; image.alt = part.text || '帖子配图'; image.loading = 'lazy'; tile.append(image); }
            else tile.append(this.icon(part.type === 's-video' ? 'video' : 'photo'), this.el('span', '', part.text || '暂无画面描述'), this.el('small', '', part.type === 's-video' ? '视频画面 · 点按查看' : '画面描述 · 单击查看'));
            grid.append(tile);
        }
        return grid;
    }

    async updateSocial(post, kind, enabled) {
        const opened = this.pop;
        const top = opened?.querySelector('.social-detail-scroll')?.scrollTop || 0;
        const ok = await this.action(kind, { id: post.id, ...(typeof enabled === 'boolean' ? { enabled } : {}) });
        if (ok && this.pop === opened && opened?.querySelector('.social-detail')) {
            this.socialDetail(this.state, this.state.rows.find(row => row.id === post.id) || post);
            this.pop.querySelector('.social-detail-scroll').scrollTop = top;
        }
        return ok;
    }

    postSyncPanel(state, post, update) {
        if (xSideStory(post)) return this.small('X 番外 · 仅在 X 内展示');
        const enabledFor = current => postSyncEnabled(post, this.settings, current?.prefs);
        const enabled = enabledFor(state);
        const toggle = this.input('checkbox', enabled); toggle.setAttribute('aria-label', '正文同步'); toggle.setAttribute('role', 'switch');
        const status = this.el('small', 'post-sync-status', enabled ? '已开启' : '已关闭');
        const hint = this.el('small', 'post-sync-hint', enabled ? '本帖及评论允许注入正文' : '本帖及评论不注入后续正文');
        const historical = (state.rows || []).some(row => (row.id === post.id || row.target === post.id || post.reference && row.target === post.reference) && state.trail?.byEvent.has(row.id));
        toggle.onchange = async () => {
            toggle.disabled = true;
            try { await update(toggle.checked); }
            finally { toggle.checked = enabledFor(this.state || state); toggle.disabled = false; status.textContent = toggle.checked ? '已开启' : '已关闭'; hint.textContent = toggle.checked ? '本帖及评论允许注入正文' : '本帖及评论不注入后续正文'; }
        };
        return this.el('section', 'post-sync-panel',
            this.el('label', 'field switch post-sync-toggle', this.el('span', 'post-sync-title', this.icon('sync'), '正文同步'), this.el('span', 'post-sync-control', status, toggle)),
            hint, historical ? this.el('small', 'post-sync-hint', '本帖或互动已写入历史正文，关闭不会删除历史。') : null,
            this.el('div', 'post-sync-meta', this.el('small', 'post-sync-audience', `可见：${post.audienceNames.join('、')}`),
                this.el('details', 'post-sync-help', this.el('summary', '', '说明'), this.el('div', 'post-sync-content',
                    this.small('开启：将本帖及评论纳入后续正文。关闭：停止后续注入。已写入正文的历史不会删除；收藏仅自己可见。'),
                    post.origin === 'tavern' ? this.small('正文已有的帖子不会重复注入，仅同步手机中的新互动。') : null,
                    this.settings.sync !== 'auto' ? this.small('实际交接遵循手机→正文的同步设置。') : null))));
    }

    socialPostMenu(state, post) {
        const info = this.socialInfo(state, post);
        const apply = async (kind, enabled) => {
            const opened = this.pop;
            if (!(await this.updateSocial(post, kind, enabled))) return;
            if (this.pop === opened) {
                if (opened?.querySelector('.social-detail')) opened.querySelector('.note-inline-layer')?.remove(); else this.closeDialog();
            }
        };
        const body = this.el('div', 'form',
            this.regeneratePostImages(post), this.button(info.has('follow') ? '取消关注作者' : '关注作者', () => apply('follow'), 'outline'),
            this.button(info.has('collect') ? '取消收藏' : '收藏这篇帖子', () => apply('collect'), 'outline'),
            this.postSyncPanel(state, post, enabled => apply('toggleSync', enabled)), this.button('转发给角色 / 群聊', () => this.forwardEditor(this.state, post), 'outline'), this.button('删除帖子', () => this.deleteSocial(post), 'outline danger'));
        if (this.pop?.querySelector('.social-detail')) this.noteSheet('帖子操作', body); else this.dialog('帖子操作', body);
    }

    socialMetric(icon, title, text, run, active = false) {
        const button = this.button('', run, `post-metric ${active ? 'active' : ''}`, title);
        button.append(this.icon(icon)); if (text !== undefined) button.append(this.el('span', '', String(text)));
        if (icon === 'heart' || icon === 'bookmark') button.setAttribute('aria-pressed', String(active)); return button;
    }

    discussionFeed(state, platform) {
        const forum = platform === 'forum';
        const tab = this.feedTabs.get(platform) || 'all';
        const all = state.rows.filter(row => row.kind === 'post');
        const posts = all.filter(post => { const info = this.socialInfo(state, post); return tab === 'mine' ? post.speakerId === PLAYER : tab === 'saved' ? info.has('collect') : tab === 'following' ? info.has('follow') : true; });
        const list = this.el('div', forum ? 'forum-post-list' : 'weibo-post-list');
        for (const post of posts) {
            const info = this.socialInfo(state, post);
            const card = this.el('article', forum ? 'forum-post-card' : 'weibo-post-card'); card.dataset.search = `${info.title} ${post.text} ${post.speaker} ${post.payload?.tags || ''}`;
            const header = this.el('div', 'discussion-author', this.avatar(info.person), this.el('div', 'discussion-author-info', this.el('strong', '', post.speaker), this.el('small', '', info.time)),
                forum ? this.el('span', 'forum-topic', info.topic) : null, this.iconButton('more', '帖子更多操作', () => this.socialPostMenu(this.state, post)));
            const open = this.button('', () => this.socialDetail(this.state, post), 'discussion-open', `打开帖子：${info.title}`);
            if (forum || post.payload?.title) open.append(this.el('h2', '', info.title));
            open.append(this.el('p', forum ? 'forum-excerpt' : 'weibo-text', post.text));
            card.append(header, open);
            if (!forum) { if (post.payload?.tags) card.append(this.el('p', 'weibo-tags', post.payload.tags)); const media = this.socialMedia(state, post); if (media) card.append(media); }
            const actions = this.el('div', 'discussion-actions',
                this.socialMetric('share', '分享帖子', '转发', () => this.forwardEditor(this.state, post)),
                this.socialMetric('messages', forum ? '查看帖子回复' : '查看微博评论', info.replies.length ? `${info.replies.length} ${forum ? '回复' : '评论'}` : forum ? '回复' : '评论', () => this.socialDetail(this.state, post, true)),
                this.socialMetric('heart', '点赞帖子', info.likes || '赞', () => this.updateSocial(post, 'like'), info.has('like')));
            if (forum) actions.prepend(this.el('small', 'forum-attachment-count', post.payload?.media?.length ? `${post.payload.media.length} 张配图` : '文字帖'));
            const details = this.socialScreenDetails(post); if (details) card.append(details);
            card.append(actions);
            if (!forum && info.replies.length) card.append(this.button(`${info.replies[0].speaker}：${info.replies[0].text}`, () => this.socialDetail(this.state, post, true), 'weibo-comment-preview'));
            list.append(card);
        }
        if (!posts.length) list.append(this.el('div', 'discussion-empty', this.icon(platform), this.el('strong', '', tab === 'saved' ? '还没有收藏的帖子' : tab === 'following' ? '关注感兴趣的作者' : tab === 'mine' ? '这里是你发布的帖子' : '还没有帖子，来聊个话题吧')));
        if (state.next) list.append(this.button('载入更早的帖子', () => this.action('more'), 'outline discussion-load'));
        const tabs = this.el('div', 'discussion-tabs', ...[['all', forum ? '最新' : '广场'], ...(!forum ? [['following', '关注']] : []), ['mine', '我的'], ['saved', '收藏']].map(([value, title]) => this.button(title, () => { this.feedTabs.set(platform, value); this.render(this.state); }, value === tab ? 'active' : '')));
        const search = this.input('search', '', forum ? '搜索话题、帖子或作者' : '搜索博文或作者'); search.className = 'search'; search.setAttribute('aria-label', '搜索当前应用内容');
        search.oninput = () => { const query = search.value.trim().toLowerCase(); for (const card of list.children) if (card.dataset.search) card.hidden = !card.dataset.search.toLowerCase().includes(query); };
        return this.el('div', `screen discussion-screen ${platform}-screen`,
            forum ? this.el('div', 'forum-banner', this.el('span', 'forum-banner-icon', this.icon('forum')), this.el('div', '', this.el('strong', '', '话题广场'), this.el('small', '', '有话题，就有回响'))) : null,
            this.el('div', 'discussion-toolbar', tabs, this.iconButton('spark', '生成角色动态', () => this.postEditor(state, true)), this.iconButton('edit', '发布动态', () => this.postEditor(state))),
            this.el('label', 'discussion-search', this.icon('search'), search), list);
    }

    generateCommentsButton(post) {
        const button = this.button('AI 生成评论', async () => {
            const opened = this.pop;
            button.disabled = true;
            try {
                if (await this.action('generateComments', { id: post.id }) && this.pop === opened) this.socialDetail(this.state, this.state.rows.find(row => row.id === post.id) || post, true);
            } finally { button.disabled = false; }
        }, 'link generate-comments', '为原帖补充模拟评论（调用当前平台 API）');
        button.prepend(this.icon('spark')); return button;
    }

    socialReplies(state, post, onlyAuthor = false) {
        const info = this.socialInfo(state, post);
        const list = this.el('div', 'social-replies-list');
        for (const [index, row] of info.replies.entries()) {
            const author = row.speakerId === post.speakerId || row.speaker === post.speaker;
            if (onlyAuthor && !author) continue;
            const person = state.people.find(person => person.id === row.speakerId) || { name: row.speaker };
            const head = this.el('div', 'social-reply-head', this.el('strong', '', row.speaker), author ? this.el('span', 'author-badge', post.thread === 'forum' ? '楼主' : '作者') : null,
                this.el('small', '', post.thread === 'forum' ? `#${index + 1}` : row.rpTime || ''));
            list.append(this.el('article', 'social-reply', this.avatar(person), this.el('div', 'social-reply-content', head,
                row.quote && row.quote !== post.text ? this.el('div', 'comment-quote', row.quote) : null, this.el('p', '', row.text),
                this.el('div', 'social-reply-bottom', this.el('small', '', post.thread === 'forum' ? row.rpTime || '' : ''), this.button('回复', () => this.commentEditor(post, row.text), 'link'),
                    row.origin === 'phone' ? this.iconButton('more', '楼层回复操作', () => this.deleteSocial(row, post)) : null))));
        }
        if (!list.children.length) list.append(this.el('p', 'discussion-empty-replies', onlyAuthor ? '楼主还没有追加回复' : '还没有回复，来说两句'));
        return list;
    }

    socialDetail(state, post, focusReplies = false) {
        if (post.thread === 'redbook') {
            this.noteDetail(state, post);
            if (focusReplies) { const scroll = this.pop.querySelector('.note-detail-scroll'); scroll.scrollTop += (this.pop.querySelector('.note-comments').getBoundingClientRect().top - scroll.getBoundingClientRect().top) / (this.displayScale || 1); }
            return;
        }
        if (!['forum', 'weibo', 'douyin'].includes(post.thread)) return this.socialPreview(post);
        const info = this.socialInfo(state, post); const forum = post.thread === 'forum'; const douyin = post.thread === 'douyin';
        const title = forum ? '帖子详情' : douyin ? (this.socialCount(state, post, 'comment') != null ? `${this.socialCount(state, post, 'comment')} 条评论` : '评论') : '微博正文';
        const header = this.el('div', 'social-detail-head', this.iconButton('back', `返回${PLATFORMS[post.thread]}`, () => this.closeDialog()), this.el('strong', '', title), this.iconButton('more', '帖子更多操作', () => this.socialPostMenu(this.state, post)));
        const body = this.el('div', 'social-detail-scroll');
        if (douyin) body.append(this.el('div', 'douyin-thread-preview', this.el('strong', '', `@${post.speaker}`), this.el('p', '', post.text)));
        else {
            const main = this.el('article', 'discussion-main-post', forum ? this.el('span', 'forum-topic', info.topic) : null,
                forum || post.payload?.title ? this.el('h1', 'discussion-title', info.title) : null,
                this.el('div', 'discussion-author', this.avatar(info.person), this.el('div', 'discussion-author-info', this.el('strong', '', post.speaker), this.el('small', '', info.time)), forum ? this.el('span', 'author-badge', '楼主 · 主楼') : null),
                this.el('p', 'discussion-body-text', post.text), this.socialMedia(state, post), post.payload?.tags ? this.el('p', 'discussion-tags', post.payload.tags) : null);
            body.append(main);
        }
        const details = this.socialScreenDetails(post); if (details) body.append(details);
        body.append(this.postSyncPanel(state, post, enabled => this.updateSocial(post, 'toggleSync', enabled)));
        this.forumAuthorOnly ||= new Set(); const onlyAuthor = forum && this.forumAuthorOnly.has(post.id);
        const replyHead = this.el('div', 'social-replies-heading', this.el('strong', '', this.socialCount(state, post, 'comment') != null ? `${this.socialCount(state, post, 'comment')} 条${forum ? '回复' : '评论'}` : `已展示 ${info.replies.length} 条评论`), forum ? this.button(onlyAuthor ? '查看全部' : '只看楼主', () => {
            if (onlyAuthor) this.forumAuthorOnly.delete(post.id); else this.forumAuthorOnly.add(post.id); this.socialDetail(this.state, post, true);
        }, 'link') : null, this.generateCommentsButton(post));
        const replies = this.el('section', 'social-detail-replies', replyHead, this.socialReplies(state, post, onlyAuthor)); body.append(replies);
        const footer = this.el('div', 'social-detail-footer', this.button(forum ? '回帖，参与讨论…' : '说点什么…', () => this.commentEditor(post), 'social-reply-prompt'),
            this.socialMetric('heart', '点赞帖子', info.likes || undefined, () => this.updateSocial(post, 'like'), info.has('like')),
            this.socialMetric('bookmark', '收藏帖子', undefined, () => this.updateSocial(post, 'collect'), info.has('collect')),
            this.socialMetric('share', '分享帖子', undefined, () => this.forwardEditor(this.state, post)));
        this.dialog(title, this.el('div', `social-detail ${post.thread}-detail`, header, body, footer));
        this.pop.classList.add('social-detail-dialog'); if (douyin) this.pop.classList.add('douyin-comments-dialog');
        this.pop.dataset.postId = post.id;
        if (focusReplies) body.scrollTop += (replies.getBoundingClientRect().top - body.getBoundingClientRect().top) / (this.displayScale || 1);
    }

    douyinFeed(state) {
        const tab = this.feedTabs.get('douyin') || 'all';
        const reels = this.el('div', 'douyin-reels');
        const posts = state.rows.filter(row => row.kind === 'post' && (tab === 'mine' ? row.speakerId === PLAYER : tab === 'saved' ? this.socialInfo(state, row).has('collect') : tab === 'following' ? this.socialInfo(state, row).has('follow') : true));
        for (const post of posts) {
            const info = this.socialInfo(state, post); const media = post.payload?.media?.length ? post.payload.media : post.payload?.raw ? [] : [{ type: 's-video', text: post.payload?.title || post.text }];
            const track = this.el('div', 'douyin-visual-track');
            for (const [index, part] of media.entries()) {
                const saved = state.albumRows?.find(row => row.sourceId === post.id && row.index === index && row.generated);
                const photo = { sourceId: post.id, index, ownerId: post.speakerId, title: post.payload?.title, description: part.text || post.text, prompt: part.fields?.prompt, url: photoSource(saved?.url || part.fields?.src || part.fields?.url) };
                const visual = this.bindPhotoGesture(this.button('', () => {}, 'douyin-visual', '单击查看，双击生图'), photo);
                if (photo.url) { const image = this.el('img'); image.src = photo.url; image.alt = part.text || '画面'; image.loading = 'lazy'; visual.append(image); }
                else visual.append(this.icon(part.type === 's-video' ? 'video' : 'photo'), this.el('span', '', part.text || '暂无画面描述'), this.el('small', '', '画面描述 · 点按查看'));
                track.append(visual);
            }
            const count = this.el('span', 'douyin-media-count', `1 / ${media.length}`); count.hidden = media.length < 2;
            track.onscroll = () => { count.textContent = `${Math.max(1, Math.min(media.length, Math.round(track.scrollLeft / (track.clientWidth || 1)) + 1))} / ${media.length}`; };
            const rail = this.el('div', 'douyin-action-rail', this.avatar(info.person),
                this.socialMetric('heart', '点赞抖音动态', info.likes, () => this.updateSocial(post, 'like'), info.has('like')),
                this.socialMetric('messages', '查看抖音评论', this.socialCount(state, post, 'comment'), () => this.socialDetail(this.state, post, true)),
                this.socialMetric('bookmark', '收藏抖音动态', '收藏', () => this.updateSocial(post, 'collect'), info.has('collect')),
                this.socialMetric('share', '分享抖音动态', '分享', () => this.forwardEditor(this.state, post)),
                this.iconButton('more', '抖音动态更多操作', () => this.socialPostMenu(this.state, post)));
            const caption = this.button('', () => this.socialDetail(this.state, post), 'douyin-caption', '展开发布文案与评论');
            caption.append(this.el('strong', '', `@${post.speaker}`), this.el('small', '', info.time), this.el('p', '', post.text));
            const details = this.socialScreenDetails(post); if (details) caption.append(details);
            if (post.payload?.tags) caption.append(this.el('span', '', post.payload.tags));
            reels.append(this.el('article', 'douyin-reel', track, count, rail, caption));
        }
        if (!posts.length) reels.append(this.el('div', 'douyin-empty', this.icon('douyin'), this.el('strong', '', tab === 'saved' ? '收藏你喜欢的内容' : tab === 'following' ? '关注感兴趣的作者' : tab === 'mine' ? '记录你的生活' : '看看故事的另一种画面'), this.button('生成角色动态', () => this.postEditor(state, true), 'outline')));
        if (state.next) reels.append(this.button('载入更早的内容', () => this.action('more'), 'douyin-load'));
        const tabs = this.el('div', 'douyin-feed-tabs', ...[['all', '推荐'], ['following', '关注'], ['mine', '我的'], ['saved', '收藏']].map(([value, title]) => this.button(title, () => { this.feedTabs.set('douyin', value); this.render(this.state); this.content.querySelector('.douyin-reels').scrollTop = 0; }, tab === value ? 'active' : '')));
        return this.el('div', 'douyin-screen', this.el('div', 'douyin-feed-toolbar', tabs, this.iconButton('spark', '生成角色动态', () => this.postEditor(state, true)), this.iconButton('edit', '发布动态', () => this.postEditor(state))), reels);
    }

    xFeed(state) {
        const tab = this.feedTabs.get('x') || 'all';
        const people = new Map(state.people.map(person => [person.id, person]));
        const has = (post, kind) => reactions(state.rows, post, kind).some(row => row.speakerId === PLAYER);
        const handle = post => xHandle(post.payload?.handle) || `@user_${digest(post.speakerId).replace(/[^A-Za-z0-9_]/g, '').slice(0, 8)}`;
        const changeTab = value => {
            this.feedTabs.set('x', value); this.render(this.state);
            const timeline = this.content.querySelector('.x-timeline'); if (timeline) timeline.scrollTop = 0;
        };
        const timeline = this.el('div', 'x-timeline');
        const posts = state.rows.filter(row => row.kind === 'post' && (tab === 'mine' ? row.speakerId === PLAYER : tab === 'saved' ? has(row, 'collect') : tab === 'following' ? has(row, 'follow') : true));
        this.xExpanded ||= new Set();
        const authorProfile = post => this.dialog(post.speaker, this.el('div', 'form x-author-profile', this.avatar(people.get(post.speakerId) || { name: post.speaker }, 'large'),
            this.el('strong', '', post.speaker), this.small(handle(post)),
            this.button(has(post, 'follow') ? '取消关注' : '关注', async () => { if (await this.action('follow', { id: post.id })) this.closeDialog(); }, 'outline'),
            ...state.rows.filter(row => row.kind === 'post' && row.speakerId === post.speakerId).map(row => this.el('p', 'post-text', row.text))));
        for (const post of posts) {
            const sideStory = xSideStory(post);
            const counts = sideStory && Array.isArray(post.payload.counts) ? post.payload.counts : [];
            const simulatedCount = kind => {
                const value = counts.find(entry => entry?.kind === kind)?.text;
                return typeof value === 'string' && /^\d{1,7}$/.test(value) ? Number(value) : 0;
            };
            const replies = state.rows.filter(row => row.kind === 'comment' && (row.target === post.id || post.reference && row.target === post.reference)).reverse();
            const card = this.el('article', 'x-post'); card.dataset.search = `${post.speaker} ${handle(post)} ${post.text} ${post.payload?.title || ''}`;
            const avatar = this.button('', () => authorProfile(post), 'x-avatar', `${post.speaker}的主页`); avatar.append(this.avatar(people.get(post.speakerId) || { name: post.speaker }));
            const time = post.rpTime || post.payload?.postedAt || (post.origin === 'tavern' ? `正文 #${post.floor}` : '时间未注明');
            const menu = () => this.dialog('帖子操作', this.el('div', 'form',
                this.button(has(post, 'follow') ? '取消关注作者' : '关注作者', async () => { if (await this.action('follow', { id: post.id })) this.closeDialog(); }, 'outline'),
                this.postSyncPanel(state, post, async enabled => { if (await this.action('toggleSync', { id: post.id, enabled })) this.closeDialog(); }),
                sideStory ? null : this.button('转发给角色 / 群聊', () => this.forwardEditor(this.state, post), 'outline'), this.button('删除帖子', () => this.deleteSocial(post), 'outline danger')));
            const header = this.el('div', 'x-post-head', this.button(post.speaker, () => authorProfile(post), 'x-author-name'), this.el('span', 'x-handle', handle(post)), this.el('span', 'x-time', `· ${time}`), this.iconButton('more', 'X 帖子更多操作', menu));
            header.querySelector('.x-time').title = time;
            const content = this.el('div', 'x-post-content', header, this.el('p', 'x-post-text', post.text));
            if (post.payload?.tags) content.append(this.el('p', 'x-tags', post.payload.tags));
            const media = post.payload?.media || [];
            if (media.length) {
                const grid = this.el('div', 'x-media-grid'); grid.dataset.count = String(media.length);
                for (const [index, part] of media.entries()) {
                    const generated = state.albumRows?.find(row => row.sourceId === post.id && row.index === index && row.generated);
                    const photo = { sourceId: post.id, index, ownerId: post.speakerId, title: post.payload?.title, description: part.text || post.text, prompt: part.fields?.prompt, url: photoSource(generated?.url || part.fields?.src || part.fields?.url) };
                    const tile = this.bindPhotoGesture(this.button('', () => {}, 'x-media-tile', '单击查看，双击生图'), photo);
                    if (photo.url) { const image = this.el('img'); image.src = photo.url; image.alt = part.text || '帖子配图'; image.loading = 'lazy'; tile.append(image); }
                    else tile.append(this.icon(part.type === 's-video' ? 'video' : 'photo'), this.el('span', 'x-media-description', part.text || '暂无画面描述'), this.el('small', '', part.type === 's-video' ? '视频画面描述' : '画面描述 · 单击查看'));
                    grid.append(tile);
                }
                content.append(grid);
            }
            const metric = (icon, title, run, value, active = false, kind = '') => {
                const button = this.button('', run, `x-action ${kind} ${active ? 'active' : ''}`, title);
                button.append(this.icon(icon)); if (value !== undefined) button.append(this.el('span', '', String(value)));
                if (kind === 'x-like' || kind === 'x-bookmark') button.setAttribute('aria-pressed', String(active));
                return button;
            };
            content.append(this.el('div', 'x-post-actions',
                metric('messages', '评论 X 帖子', () => this.commentEditor(post), replies.length),
                sideStory ? metric('sync', '在 X 内转发', () => this.action('repost', { id: post.id }), simulatedCount('转发') + reactions(state.rows, post, 'repost').length)
                    : metric('sync', '转发给联系人', () => this.forwardEditor(this.state, post)),
                metric('heart', '点赞 X 帖子', () => this.action('like', { id: post.id }), simulatedCount('点赞') + reactions(state.rows, post, 'like').length, has(post, 'like'), 'x-like'),
                metric('bookmark', '收藏 X 帖子', () => this.action('collect', { id: post.id }), undefined, has(post, 'collect'), 'x-bookmark'),
                sideStory ? null : metric('share', '分享 X 动态', () => this.forwardEditor(this.state, post))));
            if (replies.length) {
                const expanded = this.xExpanded.has(post.id);
                const toggle = this.button(expanded ? '收起回复' : `查看 ${replies.length} 条回复`, () => {
                    if (expanded) this.xExpanded.delete(post.id); else this.xExpanded.add(post.id);
                    this.render(this.state);
                }, 'x-replies-toggle'); toggle.setAttribute('aria-expanded', String(expanded)); content.append(toggle);
                if (expanded) content.append(this.el('div', 'x-replies', ...replies.map(row => this.el('div', 'x-reply',
                    this.avatar(people.get(row.speakerId) || { name: row.speaker }),
                    this.el('div', 'x-reply-content', this.el('div', 'x-reply-head', this.el('strong', '', row.speaker), row.rpTime ? this.el('small', '', row.rpTime) : null),
                        row.quote && row.quote !== post.text ? this.el('span', 'comment-quote', row.quote) : null,
                        this.button(row.text, () => this.commentEditor(post, row.text), 'x-reply-text'),
                        this.button('回复', () => this.commentEditor(post, row.text), 'x-reply-link')),
                    row.speakerId === PLAYER || row.origin === 'phone' ? this.iconButton('more', '回复操作', () => this.deleteSocial(row, post), 'x-reply-more') : null))));
            }
            card.append(avatar, content); timeline.append(card);
        }
        if (!posts.length) timeline.append(this.el('div', 'x-empty', this.el('strong', '', tab === 'saved' ? '保存喜欢的帖子' : tab === 'following' ? '关注你感兴趣的人' : tab === 'mine' ? '这里是你的帖子' : '看看此刻有哪些新想法'),
            this.el('p', '', tab === 'following' ? '在帖子右上角的菜单里关注作者' : '可以发布内容，或按需生成角色动态')));
        if (state.next) timeline.append(this.button('载入更早的帖子', () => this.action('more'), 'x-load'));
        const search = this.input('search', this.xSearch || '', '搜索帖子或账号'); search.className = 'search'; search.setAttribute('aria-label', '搜索 X 帖子');
        const filter = () => { const query = (this.xSearch || '').trim().toLowerCase(); for (const card of timeline.children) if (card.dataset.search) card.hidden = !card.dataset.search.toLowerCase().includes(query); };
        search.oninput = () => { this.xSearch = search.value; filter(); }; filter();
        const searchBox = this.el('label', 'x-search', this.icon('search'), search); searchBox.hidden = !this.xSearchOpen;
        const tabs = this.el('div', 'x-tabs', ...[['all', '为你推荐'], ['following', '正在关注']].map(([value, title]) => this.button(title, () => changeTab(value), tab === value ? 'active' : '')));
        const navButton = (icon, title, run, active) => { const button = this.iconButton(icon, title, run, active ? 'active' : ''); button.setAttribute('aria-pressed', String(!!active)); return button; };
        const bottom = this.el('nav', 'x-bottom-nav',
            navButton('home', 'X 主页', () => changeTab('all'), tab === 'all' || tab === 'following'),
            navButton('search', '搜索 X', () => { this.xSearchOpen = !this.xSearchOpen; if (!this.xSearchOpen) this.xSearch = ''; this.render(this.state); if (this.xSearchOpen) this.content.querySelector('[aria-label="搜索 X 帖子"]')?.focus(); }, this.xSearchOpen),
            navButton('bookmark', 'X 书签', () => changeTab('saved'), tab === 'saved'), navButton('user', '我的 X 帖子', () => changeTab('mine'), tab === 'mine'));
        bottom.setAttribute('aria-label', 'X 导航');
        return this.el('div', 'x-screen', this.el('div', 'x-toolbar', tabs, this.iconButton('spark', '生成 X 角色动态', () => this.postEditor(state, true))), searchBox,
            tab === 'mine' || tab === 'saved' ? this.el('div', 'x-filter-title', tab === 'mine' ? '我的帖子' : '书签') : null, timeline,
            this.iconButton('edit', '发布 X 动态', () => this.postEditor(state), 'x-compose'), bottom);
    }

    momentsMedia(state, post) {
        const parts = post.payload?.media || [];
        if (!parts.length) return null;
        const gallery = this.el('div', 'moments-gallery'); gallery.dataset.count = String(parts.length);
        for (const [index, part] of parts.entries()) {
            const saved = state.albumRows?.find(row => row.sourceId === post.id && row.index === index && row.generated);
            const photo = { sourceId: post.id, index, ownerId: post.speakerId, description: part.text, prompt: part.fields?.prompt, url: photoSource(saved?.url || part.fields?.src || part.fields?.url) };
            const tile = this.bindPhotoGesture(this.button('', () => {}, 'moments-media-tile', '单击查看，双击生图'), photo);
            if (photo.url) { const image = this.el('img'); image.src = photo.url; image.alt = part.text || ''; image.loading = 'lazy'; tile.append(image); }
            else tile.append(this.icon(part.type === 's-video' ? 'video' : 'photo'), this.el('span', 'moments-media-description', part.text));
            if (part.type === 's-video') tile.append(this.el('span', 'moments-video-mark', this.icon('play')));
            gallery.append(tile);
        }
        return gallery;
    }

    momentsFeed(state) {
        const tab = this.feedTabs.get('moments') || 'all';
        const people = new Map(state.people.map(person => [person.id, person]));
        const player = people.get(PLAYER) || { name: state.context.name1 || '玩家' };
        const profileAvatar = this.button('', () => this.socialNicknameEditor(this.state, PLAYER), 'moments-profile-avatar', '设置我的网名'); profileAvatar.append(this.avatar(player, 'large'));
        const cover = this.el('div', 'moments-hero', this.el('div', 'moments-profile', this.el('div', '', this.el('strong', '', player.name), this.el('small', '', '朋友圈')), profileAvatar));
        const image = wallpaperSource(this.settings);
        if (image) { const photo = this.wallpaperPreview(image, 'moments-hero-image'); photo.alt = ''; photo.onerror = () => photo.remove(); cover.prepend(photo); }
        const list = this.el('div', 'moments-timeline');
        const posts = state.rows.filter(row => row.kind === 'post' && (tab === 'all' || (tab === 'mine' ? row.speakerId === PLAYER : reactions(state.rows, row, 'collect').some(item => item.speakerId === PLAYER))));
        for (const post of posts) {
            const info = this.socialInfo(state, post);
            const replies = info.replies;
            const item = this.el('article', 'moments-entry'); item.dataset.search = `${post.speaker} ${post.text} ${post.payload?.title || ''}`;
            const author = this.button(post.speaker, () => this.dialog(post.speaker, this.el('div', 'form', this.avatar(info.person, 'large'), this.button('设置网名 / 绑定身份', () => this.socialNicknameEditor(this.state, post.speakerId, post.speaker), 'outline'), ...state.rows.filter(row => row.kind === 'post' && row.speakerId === post.speakerId).map(row => this.small(row.text)))), 'moments-author');
            const body = this.el('div', 'moments-entry-body', author, post.payload?.title ? this.el('strong', 'moments-post-title', post.payload.title) : null, this.el('p', 'post-text', post.text));
            if (post.payload?.media?.length) body.append(this.momentsMedia(state, post));
            if (post.payload?.tags) body.append(this.el('p', 'moments-tags', post.payload.tags));
            const footer = this.el('div', 'moments-post-footer', this.el('small', '', post.rpTime || post.payload?.postedAt || ''), this.el('span', 'moments-post-actions',
                this.iconButton('heart', info.has('like') ? '取消点赞' : '点赞', () => this.action('like', { id: post.id }), info.has('like') ? 'liked' : ''),
                this.iconButton('messages', '评论动态', () => this.commentEditor(post)), this.iconButton('more', '动态更多操作', () => this.socialPostMenu(this.state, post))));
            if (post.payload?.location) body.append(this.el('p', 'moments-location', this.icon('location'), post.payload.location));
            if (post.payload?.counts?.length) body.append(this.el('p', 'moments-known-counts', post.payload.counts.map(item => `${item.kind} ${item.text}`).join(' · ')));
            body.append(footer);
            const reactionsBox = this.el('div', 'moments-reactions');
            const likes = [...new Set([...(post.payload?.likes ? [post.payload.likes] : []), ...reactions(state.rows, post, 'like').map(row => row.speaker)])];
            if (likes.length) reactionsBox.append(this.el('div', 'moments-likes', this.icon('heart'), this.el('span', '', likes.join('、'))));
            for (const row of replies) {
                const reply = this.button('', () => this.commentEditor(post, row.text), 'moments-reply');
                reply.append(this.el('strong', '', row.quote ? `${row.speaker} 回复 ${row.quote}` : row.speaker), this.el('span', '', `：${row.text}`)); reactionsBox.append(reply);
            }
            if (reactionsBox.childElementCount) body.append(reactionsBox);
            item.append(this.avatar(info.person), body); list.append(item);
        }
        if (!posts.length) list.append(this.el('div', 'moments-empty', this.el('span', '', this.icon('moments')), this.el('h2', '', tab === 'saved' ? '收藏值得回看的瞬间' : tab === 'mine' ? '写下你的第一条近况' : '生活的片刻，慢慢收集'), this.el('p', '', '发布近况，或看看角色的新动态'),
            this.el('div', '', this.button('发布动态', () => this.postEditor(state), 'moments-primary'), this.button('生成角色动态', () => this.postEditor(state, true), 'moments-secondary'))));
        if (state.next) list.append(this.button('更早的动态', () => this.action('more'), 'moments-load'));
        const tabs = this.el('div', 'moments-segments', ...[['all', '动态'], ['mine', '我的'], ['saved', '收藏']].map(([key, name]) => this.button(name, () => { this.feedTabs.set('moments', key); this.render(this.state); }, tab === key ? 'selected' : '')));
        const search = this.input('search', '', '搜索朋友圈'); search.setAttribute('aria-label', '搜索朋友圈');
        search.oninput = () => { const query = search.value.trim().toLowerCase(); for (const item of list.children) if (item.dataset.search) item.hidden = !item.dataset.search.toLowerCase().includes(query); };
        return this.el('div', 'moments-screen', cover, this.el('div', 'moments-toolbar', tabs, this.iconButton('spark', '生成角色动态', () => this.postEditor(state, true)), this.iconButton('camera', '发布动态', () => this.postEditor(state))), this.el('label', 'moments-search', this.icon('search'), search), list);
    }

    moments(state) {
        const platform = PLATFORMS[this.view] ? this.view : 'moments';
        if (platform === 'moments') return this.momentsFeed(state);
        if (platform === 'x') return this.xFeed(state);
        if (platform === 'forum' || platform === 'weibo') return this.discussionFeed(state, platform);
        if (platform === 'douyin') return this.douyinFeed(state);
        const items = this.el('div', `moments-list feed-${platform}`);
        const people = new Map(state.people.map(person => [person.id, person]));
        const tab = this.feedTabs.get(platform) || 'all';
        const posts = state.rows.filter(row => row.kind === 'post');
        const selected = posts.filter(post => tab === 'all' || (tab === 'mine' ? post.speakerId === PLAYER : reactions(state.rows, post, 'collect').some(row => row.speakerId === PLAYER)));
        for (const post of selected) {
            const interactions = state.rows.filter(row => row.target === post.id || (post.reference && row.target === post.reference));
            const replies = interactions.filter(row => row.kind === 'comment').reverse();
            const likes = reactions(state.rows, post, 'like').map(row => row.speaker);
            const reply = quote => this.commentEditor(post, quote);
            const author = this.button(post.speaker, () => this.dialog(`${post.speaker} · ${PLATFORMS[platform]}`, this.el('div', 'form', this.avatar(people.get(post.speakerId), 'large'),
                ...state.rows.filter(row => row.kind === 'post' && row.speakerId === post.speakerId).map(row => this.small(row.text)), this.button('关注作者', () => this.action('follow', { id: post.id }), 'outline'))), 'link');
            items.append(this.section('', this.el('div', 'post-head', this.avatar(people.get(post.speakerId)), this.el('div', '', author, platform === 'x' && /^@[A-Za-z0-9_]{1,15}$/.test(post.payload?.handle || '') ? this.el('small', 'x-handle', post.payload.handle) : null, this.el('small', '', post.rpTime || post.payload?.postedAt || (post.origin === 'tavern' ? `正文 #${post.floor}` : '发布时间未注明')))),
                post.payload?.title ? this.el('h3', '', post.payload.title) : null,
                ...((post.payload?.media || []).map((part, index) => this.messageComponent(part, { sourceId: post.id, index, ownerId: post.speakerId }))),
                this.el('p', 'post-text', post.text), post.payload?.tags ? this.small(post.payload.tags) : null, this.postSyncPanel(state, post, enabled => this.action('toggleSync', { id: post.id, enabled })),
                this.el('div', 'chat-tools', this.button(`${reactions(state.rows, post, 'like').some(row => row.speakerId === PLAYER) ? '♥ 已赞' : '♡ 赞'}`, () => this.action('like', { id: post.id }), 'link'), this.button('评论', () => reply(''), 'link'),
                    this.button(reactions(state.rows, post, 'collect').some(row => row.speakerId === PLAYER) ? '取消收藏' : '收藏', () => this.action('collect', { id: post.id }), 'link'), this.iconButton('share', `分享${PLATFORMS[platform]}动态`, () => this.forwardEditor(this.state, post), 'social-share'), this.button('删除', () => this.deleteSocial(post), 'link')),
                likes.length ? this.el('div', 'moment-response', `♡ ${likes.join('、')}`) : null,
                ...replies.map(row => this.button(`${row.speaker}：${row.text}`, () => reply(row.text), 'moment-response'))));
            const card = items.lastElementChild;
            const media = post.payload?.media?.[0];
            if (media && platform !== 'redbook') card.append(this.photoActions({ sourceId: post.id, index: 0, ownerId: post.speakerId, title: post.payload?.title, description: media.text, url: photoSource(media.fields?.src || media.fields?.url) }));
            card.classList.add('social-post'); card.dataset.search = `${post.payload?.title || ''} ${post.text} ${post.speaker}`;
            if (platform === 'redbook') {
                const compact = this.el('article', 'note-tile'); compact.dataset.search = card.dataset.search;
                const open = this.button('', () => this.noteDetail(state, post), 'note-open');
                open.append(this.socialCover(post, platform), this.el('strong', 'note-title', post.payload?.title || post.text));
                compact.append(open, this.el('div', 'note-author', this.avatar(people.get(post.speakerId)), this.el('span', '', post.speaker), this.button(reactions(state.rows, post, 'like').some(row => row.speakerId === PLAYER) ? '♥' : '♡', () => this.action('like', { id: post.id }), 'link', '点赞或取消点赞')));
                card.replaceWith(compact);
            } else if (platform === 'douyin') card.prepend(this.socialCover(post, platform));
        }
        if (!items.children.length) items.append(this.el('div', 'social-empty', this.el('span', 'empty-symbol', this.appIcon(platform)), this.el('h2', '', tab === 'saved' ? '收藏你喜欢的内容' : tab === 'mine' ? '记录属于你的日常' : ({ redbook: '发现生活里的小美好', douyin: '故事也有另一种视角', weibo: '此刻，有话想说', forum: '每个话题，都从这里开始', x: '分享此刻的想法', moments: '留下一点生活的片段' })[platform]), this.el('p', '', '已有正文内容会自动出现在这里'), this.button('发布第一条', () => this.postEditor(state), 'primary')));
        if (state.next) items.append(this.button('载入更早的动态', () => this.action('more'), 'outline'));
        const tabs = this.el('div', 'feed-tabs', ...[['all', platform === 'redbook' ? '发现' : platform === 'forum' ? '最新' : '动态'], ['mine', '我的'], ['saved', '收藏']].map(([key, caption]) => this.button(caption, () => { this.feedTabs.set(platform, key); this.render(state); }, tab === key ? 'selected' : '')));
        const search = this.input('search', '', platform === 'forum' ? '搜索帖子与讨论' : '搜索内容或作者'); search.setAttribute('aria-label', '搜索当前应用内容');
        search.oninput = () => { for (const card of items.children) if (card.dataset.search) card.hidden = !card.dataset.search.toLowerCase().includes(search.value.toLowerCase()); };
        return this.el('div', `screen social-screen social-${platform}`, this.el('div', 'social-toolbar', tabs, this.iconButton('add', '发布动态', () => this.postEditor(state))),
            this.el('label', 'search-box', this.icon('search'), search), this.el('div', 'social-compose', this.el('span', '', '记录生活，也看看他们的世界'), this.button('生成角色动态', () => this.postEditor(state, true), 'link')),
            platform === 'moments' ? this.el('div', 'moment-cover', this.el('strong', '', state.context.name1 || '玩家'), this.avatar(people.get(PLAYER), 'large')) : null, items);
    }

    noteDetail(state, post, mediaIndex = 0) {
        const interactions = state.rows.filter(row => row.target === post.id || (post.reference && row.target === post.reference));
        const count = kind => this.socialCount(state, post, kind);
        const own = kind => kind !== 'comment' && reactions(state.rows, post, kind).some(row => row.speakerId === PLAYER);
        const update = async (kind, enabled) => {
            const opened = this.pop;
            if (await this.action(kind, { id: post.id, ...(typeof enabled === 'boolean' ? { enabled } : {}) }) && this.pop === opened && this.view === 'redbook') this.noteDetail(this.state, this.state.rows.find(row => row.id === post.id) || post, mediaIndex);
        };
        const comment = quote => this.commentEditor(post, quote);
        const author = this.socialInfo(state, post).person;
        const header = this.el('div', 'note-detail-head', this.iconButton('back', '返回小红书', () => this.closeDialog()), this.avatar(author), this.el('strong', '', post.speaker),
            this.button(own('follow') ? '已关注' : '关注', () => update('follow'), 'note-follow'), this.iconButton('share', '转发给角色', () => this.forwardEditor(this.state, post)), this.iconButton('more', '笔记更多操作', () => this.noteSheet('笔记操作', this.el('div', 'form', this.regeneratePostImages(post), this.button('转发给角色 / 群聊', () => this.forwardEditor(this.state, post), 'outline'), this.button('删除这条动态', () => this.deleteSocial(post), 'outline danger')))));
        const originals = post.payload?.media?.length ? post.payload.media : post.payload?.raw ? [] : [{ type: 's-image', text: post.payload?.title || post.text }];
        const media = originals.flatMap((part, index) => {
            const generated = state.albumRows?.filter(row => row.sourceId === post.id && row.index === index && row.generated) || [];
            return generated.length ? generated.map(photo => ({ ...part, displayUrl: photo.url, storedId: photo.id, sourceIndex: index })) : [{ ...part, sourceIndex: index }];
        });
        mediaIndex = Math.max(0, Math.min(media.length - 1, mediaIndex));
        const gallery = this.el('div', 'note-gallery', ...media.map((part, index) => this.socialCover({ ...post, payload: { ...post.payload, media: [part] } }, 'redbook', part.sourceIndex)));
        [...gallery.children].forEach((cover, index) => {
            const part = media[index];
            const photo = { id: part.storedId, sourceId: post.id, index: part.sourceIndex, ownerId: post.speakerId, title: post.payload?.title, description: part.text || post.text, prompt: part.fields?.prompt, url: photoSource(part.displayUrl || part.fields?.src || part.fields?.url) };
            cover.append(this.bindPhotoGesture(this.button('', () => {}, 'note-image-open', '单击查看，双击生图'), photo));
        });
        const dots = this.el('div', 'note-dots', ...media.map((_, index) => this.button('●', () => { gallery.scrollTo({ left: gallery.clientWidth * index, behavior: 'smooth' }); }, index === mediaIndex ? 'active' : '', `第 ${index + 1} 张`)));
        gallery.onscroll = () => { mediaIndex = Math.max(0, Math.min(media.length - 1, Math.round(gallery.scrollLeft / (gallery.clientWidth || 1)))); [...dots.children].forEach((dot, index) => dot.classList.toggle('active', index === mediaIndex)); };
        const replies = interactions.filter(row => row.kind === 'comment').reverse();
        const body = this.el('div', 'note-detail-scroll', gallery, media.length > 1 ? dots : null, this.el('div', 'note-detail-copy',
            this.el('h2', 'note-detail-title', post.payload?.title || post.text.split('\n')[0].slice(0, 60)), this.el('p', 'post-text', post.text), post.payload?.tags ? this.el('p', 'note-tags', post.payload.tags) : null,
            this.small([post.rpTime || post.payload?.postedAt, post.payload?.location].filter(Boolean).join(' · ')),
            this.socialScreenDetails(post), this.postSyncPanel(state, post, enabled => update('toggleSync', enabled)),
            this.el('div', 'note-comments', this.el('div', 'social-replies-heading', this.small(count('comment') != null ? `共 ${count('comment')} 条评论` : `已展示 ${replies.length} 条评论`), this.generateCommentsButton(post)),
                this.button('', () => comment(''), 'note-inline-comment', '留下你的想法吧'),
                ...replies.map(row => this.el('div', 'note-comment-line', this.avatar(state.people.find(person => person.id === row.speakerId) || { name: row.speaker }),
                    this.el('div', 'note-comment-content', this.el('small', '', [row.speaker, row.rpTime].filter(Boolean).join(' · ')), row.quote && row.quote !== post.text ? this.el('span', 'comment-quote', row.quote) : null, this.button(row.text, () => comment(row.text), 'note-comment'), this.button('回复', () => comment(row.text), 'note-comment-reply')),
                    row.speakerId === PLAYER || row.origin === 'phone' ? this.iconButton('trash', '删除评论', () => this.deleteSocial(row, post)) : null)))));
        const metric = (icon, kind, title) => {
            const button = this.button('', () => kind === 'comment' ? comment('') : update(kind), `note-metric ${own(kind) ? 'active' : ''}`, title);
            button.append(this.icon(icon), this.el('span', '', String(count(kind) ?? ({ like: '点赞', collect: '收藏', comment: '评论' }[kind] || '')))); return button;
        };
        const footer = this.el('div', 'note-detail-footer', this.button('说点什么…', () => comment(''), 'note-comment-prompt'), metric('heart', 'like', '点赞'), metric('star', 'collect', '收藏'), metric('messages', 'comment', '评论'));
        this.dialog('笔记详情', this.el('div', 'note-detail', header, body, footer));
        this.pop.classList.add('note-detail-dialog'); this.pop.dataset.postId = post.id;
        const inlineComment = this.pop.querySelector('.note-inline-comment');
        inlineComment.append(this.avatar(state.people.find(person => person.id === PLAYER)), this.el('span', '', '留下你的想法吧'), this.icon('edit'));
        gallery.scrollLeft = gallery.clientWidth * mediaIndex;
    }

    postEditor(state, generate = false) {
        const platform = this.view;
        const method = this.select([['manual', '手动发布'], ['ai', 'AI 生成']], generate ? 'ai' : 'manual');
        const authors = state.people.filter(person => person.id !== PLAYER);
        const actor = this.select(authors.map(person => [person.id, person.name]), authors[0]?.id || '');
        actor.setAttribute('aria-label', '动态发布角色');
        const choices = postCounts(PLATFORMS[platform]);
        const count = this.select(choices.map(value => [String(value), `最多生成 ${value} 条动态`]), platform === 'x' ? '7' : '1');
        count.setAttribute('aria-label', '生成动态条数');
        const countField = this.el('label', 'field', '动态条数 · 每条配图张数由角色决定', count);
        const title = this.input('text', '', '标题（可选）');
        const tags = this.input('text', '', '话题（可选）');
        const media = this.el('textarea'); media.placeholder = '图片地址或画面说明，每行一张，最多 9 张'; media.rows = 2;
        const text = this.el('textarea'); text.rows = 4; text.maxLength = 2000;
        const scope = this.select([['all', '当前联系人全部可见'], ['selected', '仅勾选的人可见']], 'all');
        const checks = this.peopleChecks(state); checks.node.hidden = true;
        scope.onchange = () => { checks.node.hidden = scope.value !== 'selected'; };
        const profile = this.settings.apiProfiles?.find(row => row.id === this.settings.platformApis?.[platform]);
        const styleHint = this.small(`${PLATFORMS[platform]}：${this.settings.platformPrompts?.[platform]?.trim() ? '使用自定义平台提示词' : PLATFORM_RULES[PLATFORMS[platform]]?.summary || ''} · 可含一年前的历史动态 · 配图由角色决定`);
        const apiHint = this.small(`AI 使用：${profile?.name || '默认连接'} · 多条动态也只发送一次请求 · 可在设置 → 各平台 API 中分别配置`);
        const inject = this.input('checkbox', this.settings.socialSync?.[platform] === true);
        const syncField = this.el('label', 'field switch', '将这条内容注入下一轮正文', inject);
        const submit = this.button('', () => {
            this.closeDialog();
            this.action(method.value === 'ai' ? 'postActor' : 'post', { actor: actor.value, count: Number(count.value), text: text.value, platform, inject: !syncField.hidden && inject.checked,
                payload: { title: title.value, tags: tags.value, media: media.value.split('\n').map(text => text.trim()).filter(Boolean).slice(0, 9).map(text => ({ type: platform === 'douyin' && !safeUrl(text) ? 's-video' : 's-image', text: safeUrl(text) ? '图片' : text, ...(safeUrl(text) ? { fields: { src: safeUrl(text) } } : {}) })) }, public: scope.value === 'all', members: checks.selected() });
        }, 'primary');
        const update = () => {
            const ai = method.value === 'ai';
            countField.hidden = apiHint.hidden = styleHint.hidden = actor.hidden = !ai;
            syncField.hidden = ai && platform === 'x';
            for (const field of [title, tags, media]) field.hidden = ai;
            text.placeholder = ai ? '想看什么动态？也可写“一年前的旅行记录”等时间要求（可选）' : '记录此刻真实发生的事';
            submit.textContent = ai ? `AI 生成并发布（最多 ${count.value} 条）` : '发布';
            submit.disabled = ai && !actor.value;
        };
        method.onchange = update; count.onchange = update; update();
        this.dialog(`发布到${PLATFORMS[platform]}`, this.el('div', 'form post-editor', method, actor, countField, styleHint, apiHint, title, text, media, tags, scope, checks.node, syncField, submit));
    }

    regeneratePostImages(post) {
        const media = post.payload?.media || [];
        const choices = media.map((part, index) => ({ part, index })).filter(({ part }) => part.type === 's-image');
        if (!choices.length) return null;
        const open = ({ part, index }) => this.imageEditor({ sourceId: post.id, index, ownerId: post.speakerId, title: post.payload?.title, description: part.text, prompt: part.fields?.prompt, url: photoSource(this.state?.albumRows?.find(row => row.sourceId === post.id && row.index === index && row.generated)?.url || part.fields?.src) });
        return this.button('重新生成图片', () => {
            if (choices.length === 1) return open(choices[0]);
            const body = this.el('div', 'form', ...choices.map(item => this.button(`第 ${item.index + 1} 张 · ${String(item.part.text || '').slice(0, 35) || '图片'}`, () => open(item), 'outline')));
            this.dialog('选择要重新生成的图片', body);
        }, 'outline');
    }

    bindPhotoGesture(node, photo) {
        node.classList.add('photo-gesture');
        let timer = null;
        const edit = () => { if (timer) this.host.clearTimeout(timer); timer = null; this.imageEditor(photo); };
        node.addEventListener('click', event => {
            event.stopPropagation();
            if (timer) { edit(); return; }
            timer = this.host.setTimeout(() => { timer = null; if (node.isConnected) this.photoViewer(photo); }, 380);
        });
        node.addEventListener('keydown', event => { if (event.key === 'Enter' && event.altKey) { event.preventDefault(); edit(); } });
        return node;
    }

    photoActions(photo) {
        const actions = this.el('div', 'photo-actions');
        const generated = this.state?.albumRows?.find(row => row.sourceId === photo.sourceId && row.index === (photo.index || 0) && row.generated);
        const url = generated?.url || photo.url;
        if (url) actions.append(this.button('保存相册', () => this.action('savePhoto', { ...photo, url }), 'link'));
        if (photo.description) { const generate = this.button('重新生成', () => this.imageEditor({ ...photo, url }), 'link'); actions.append(generate); }
        return actions;
    }

    ensurePhotoPost(photo) {
        const source = this.state?.rows.find(row => row.id === photo.sourceId && row.kind === 'post');
        if (source && this.pop?.dataset.postId !== source.id) {
            if (source.thread === 'redbook') this.noteDetail(this.state, source, photo.index || 0);
            else this.socialDetail(this.state, source);
        }
        return source;
    }

    photoViewer(photo, gallery = []) {
        const source = this.ensurePhotoPost(photo);
        const cached = this.state?.photoSources?.find(item => item.sourceId === photo.sourceId && item.index === (photo.index || 0));
        photo = { ...cached, ...photo, prompt: cached && cached.description === photo.description ? cached.prompt || photo.prompt || '' : photo.prompt || cached?.prompt || '' };
        if (source && !gallery.length) gallery = (this.state.photoSources || []).filter(item => item.sourceId === source.id);
        let layer;
        const stored = this.state?.albumRows?.find(row => row.id === photo.id) || this.state?.albumRows?.find(row => photo.sourceId && row.sourceId === photo.sourceId && row.index === (photo.index || 0) && row.url === photo.url);
        const url = photoSource(photo.url);
        const content = url ? this.el('img', 'album-full-image') : this.el('div', 'photo-description-preview', this.el('p', 'photo-description', photo.description || '暂无画面说明'));
        if (url) {
            content.src = url; content.alt = photo.description || photo.title || '图片';
            // Preserve native image context menus and the mobile long-press save action.
            content.draggable = true;
            content.addEventListener('dblclick', () => { if (!photo.readOnly && content.isConnected) this.imageEditor(photo); });
        }
        if (!url) content.addEventListener('dblclick', () => { if (!photo.readOnly && content.isConnected) this.imageEditor(photo); });
        let lastTouch = 0;
        content.addEventListener('pointerup', event => {
            if (event.pointerType !== 'touch' || photo.readOnly) return;
            const now = Date.now();
            if (lastTouch && now - lastTouch < 380 && content.isConnected) { lastTouch = 0; this.imageEditor(photo); } else lastTouch = now;
        });
        const body = this.el('div', 'form photo-viewer',
            gallery.length > 1 ? this.el('div', 'generated-gallery-nav', ...gallery.map((item, index) => this.button(`第 ${index + 1} 张`, () => this.photoViewer(item, gallery), (item.id === photo.id || item.sourceId === photo.sourceId && item.index === photo.index) ? 'outline active' : 'link'))) : null,
            content, url && photo.description ? this.el('p', 'photo-description', photo.description) : null,
            photo.generated ? this.small('AI 生成图片') : null, photo.warning ? this.small(photo.warning) : null,
            url ? this.small(photo.readOnly ? '手机可长按图片保存。' : '手机可长按图片保存；双击图片打开生图面板。') : null,
            url && !photo.readOnly ? this.button('保存到我的相册', () => this.action('savePhoto', { ...photo, ownerId: PLAYER, inAlbum: true }), 'outline') : null,
            photo.readOnly ? null : isEnglishPrompt(photo.prompt) ? this.el('details', 'photo-prompt-preview', this.el('summary', '', '英文生图提示词'), this.el('p', 'photo-description', photo.prompt)) : this.button('AI 生成提示词', async event => {
                const button = event.currentTarget; button.disabled = true;
                const result = await this.action('draftImagePrompt', photo);
                if (result && button.isConnected) this.photoViewer({ ...photo, ...result }, gallery);
                else button.disabled = false;
            }, 'outline'),
            photo.description && !photo.readOnly ? this.button(url ? '重新生成图片' : '编辑提示词与生图', () => this.imageEditor(photo), 'outline') : null,
            stored && !photo.readOnly ? this.button('删除图片', async () => {
                if (await this.action('deletePhoto', { id: stored.id })) { if (layer) layer.remove(); else this.closeDialog(); }
            }, 'outline danger') : null);
        if (this.pop?.querySelector('.note-detail, .social-detail')) layer = this.noteSheet(photo.title || '图片', body);
        else this.dialog(url ? photo.title || '图片' : '图片说明', body);
    }

    albumView(state) {
        const owner = this.select(state.people.map(person => [person.id, person.id === PLAYER ? '我的相册' : `${person.name}的相册`]), this.albumOwner || PLAYER);
        owner.setAttribute('aria-label', '选择相册');
        owner.onchange = () => { this.albumOwner = owner.value; this.render(this.state); };
        const sources = (state.photoSources || []).filter(row => row.ownerId === owner.value);
        const stored = (state.albumRows || []).filter(row => row.ownerId === owner.value && row.inAlbum !== false);
        const rows = [...stored, ...sources.filter(row => !stored.some(saved => saved.sourceId === row.sourceId && saved.index === row.index))];
        const grid = this.el('div', 'album-grid', ...rows.map(photo => {
            const button = this.bindPhotoGesture(this.button('', () => {}, 'album-tile', '单击查看，双击生图'), photo);
            if (photo.url) { const image = this.el('img'); image.src = photo.url; image.alt = photo.description || '图片'; image.loading = 'lazy'; button.append(image); }
            else button.append(this.icon('photo'), this.el('span', '', photo.description || '图片描述'));
            if (photo.generated) button.append(this.el('small', 'generated-badge', 'AI'));
            return button;
        }));
        return this.el('div', 'screen album-screen', this.heading('相册', 'PHOTOS', this.iconButton('add', '添加到相册', () => this.photoImport())), owner,
            this.small(owner.value === PLAYER ? '自己保存和生成的图片，以及自己发过的照片。' : '仅展示当前剧情中对你可见的聊天、动态图片和明确生成的图片。'),
            this.button('生成新图片', () => this.imageEditor({ ownerId: owner.value }), 'outline'), rows.length ? grid : this.el('p', 'empty', '还没有可见图片，可先添加照片或根据画面描述生图。'),
            state.next ? this.button('载入更早的图片来源', () => this.action('more'), 'link') : null);
    }

    photoImport() {
        const url = this.input('url', '', '图片地址（或上传本地图片）');
        const file = this.input('file', ''); file.accept = 'image/png,image/jpeg,image/webp,image/gif';
        const description = this.input('text', '', '图片说明（可选）');
        this.dialog('添加相册图片', this.el('div', 'form', file, url, description, this.small('本地图片最大 5 MiB。')), () => this.action('savePhoto', { file: file.files[0], url: url.value, description: description.value }));
    }

    imageView(state) {
        return this.el('div', 'screen image-studio', this.heading('画面工坊', 'IMAGE STUDIO', this.iconButton('settings', '生图设置', () => this.imageSettingsPanel())),
            this.el('div', 'image-studio-art', this.icon('imagegen')), this.el('h2', '', '把画面描述变成图片'),
            this.el('p', '', '默认跟随酒馆生图，也可使用自己的直连 API 或代理。可选择一次生成 1–4 张，完成后保存到相册。'),
            this.button('开始生图', () => this.imageEditor({}), 'primary'), this.button('打开相册', () => this.navigate('album'), 'outline'),
            this.small('任务进行中可继续提交请求，按顺序执行。'));
    }

    imageEditor(photo = {}) {
        this.ensurePhotoPost(photo);
        const cached = this.state?.photoSources?.find(item => item.sourceId === photo.sourceId && item.index === (photo.index || 0));
        if (cached?.prompt && cached.description === photo.description) photo = { ...photo, prompt: cached.prompt };
        const state = this.state;
        const taskId = `manual-image:${Date.now()}:${Math.random().toString(36).slice(2)}`;
        const owner = this.select(state.people.map(person => [person.id, person.id === PLAYER ? '我' : person.name]), photo.ownerId || PLAYER); owner.setAttribute('aria-label', '图片人物');
        const count = this.select([['1', '1 张'], ['2', '2 张'], ['3', '3 张'], ['4', '4 张']], '1'); count.setAttribute('aria-label', '生图数量');
        const description = this.el('textarea'); description.rows = 4; description.maxLength = 2000; description.value = photo.description || ''; description.placeholder = '描述画面、人物、服装、场景和光线'; description.setAttribute('aria-label', '生图画面描述');
        const english = this.el('textarea'); english.rows = 4; english.maxLength = 6000; english.value = photo.prompt || ''; english.placeholder = 'English prompt, single standalone image…'; english.setAttribute('aria-label', '英文生图提示词');
        const reference = this.el('textarea'); reference.rows = 4; reference.maxLength = 4000; reference.placeholder = '人物外观参考（可选）';
        const error = this.el('p', 'editor-error');
        let layer;
        const body = this.el('div', 'form image-editor', this.el('label', 'field', photo.sourceId ? '图片人物' : '图片人物 / 相册', owner), description, this.el('label', 'field', '英文生图提示词（可选，留空直接使用画面说明）', english),
            this.button('AI 生成画面说明与提示词', async event => {
                const button = event.currentTarget; const title = button.textContent;
                button.disabled = true; button.textContent = '正在重新生成提示词…';
                try {
                    const result = await this.action('draftImagePrompt', { ...photo, description: description.value, prompt: english.value, characterProfile: reference.value });
                    if (result && button.isConnected) { description.value = result.description; english.value = result.prompt; }
                } finally { button.disabled = false; button.textContent = title; }
            }, 'outline'), reference, this.small('生成图片直接使用填写内容；需要 AI 整理时，请手动点击上方按钮（使用默认文本 API）。'),
            this.el('label', 'field', '生成数量', count),
            this.small(`连接：${({ tavern: '跟随酒馆', direct: '独立直连', proxy: '自定义代理' })[state.imageConfig?.mode || 'tavern']} · 模型：${state.imageConfig?.mode === 'tavern' ? '沿用酒馆设置' : state.imageConfig?.model || '未设置'}`),
            this.small(`多张图片逐张请求；中途取消或失败会停止。${photo.sourceId ? '已完成图片保留为当前配图，可另存相册。' : '已完成图片保留在相册。'}`), error,
            this.button(photo.sourceId || photo.url ? '重新生成' : '生成图片', () => {
                if (!description.value.trim() && !english.value.trim()) { error.textContent = '请填写生图提示词或画面描述'; return; }
                if (layer) layer.remove(); else this.closeDialog();
                this.action('generateImage', { ...photo, inAlbum: !photo.sourceId, taskId, count: Number(count.value), keepNote: !!layer, description: description.value, prompt: english.value, characterProfile: reference.value, ownerId: owner.value });
            }, 'primary'), photo.url ? this.button('保存当前图片到相册', () => this.action('savePhoto', photo), 'outline') : null,
            this.button('生图设置', () => this.imageSettingsPanel(), 'link'));
        if (this.pop?.querySelector('.note-detail, .social-detail')) layer = this.noteSheet('图片与生图', body);
        else this.dialog(photo.sourceId || photo.url ? '重新生成图片' : '生成图片', body);
    }

    characterProfilesEditor(value) {
        const cards = this.el('div', 'character-reference-list');
        const entries = [];
        const add = (row = { name: '', prompt: '' }) => {
            const name = this.input('text', row.name, '角色姓名'); name.maxLength = 60; name.setAttribute('aria-label', '外貌参考角色姓名');
            const prompt = this.el('textarea', 'character-reference-prompt'); prompt.rows = 6; prompt.maxLength = 8000;
            prompt.value = row.prompt; prompt.placeholder = '发色、眼睛、五官、身形、服装与辨识特征…\n可分行填写英文提示词，例如 brown curly hair, a small red beauty mark'; prompt.setAttribute('aria-label', '角色英文外貌生图提示词');
            const entry = { name, prompt };
            const remove = this.button('×', () => { card.remove(); entries.splice(entries.indexOf(entry), 1); cards.dispatchEvent(new this.host.Event('change', { bubbles: true })); }, 'character-reference-remove', '删除这条外貌参考');
            const card = this.el('section', 'character-reference-card', this.el('div', 'character-reference-head', this.icon('contacts'), name, remove), prompt);
            entries.push(entry); cards.append(card);
        };
        characterReferenceRows(value).forEach(add);
        if (!entries.length) add();
        const node = this.el('div', 'character-references', this.el('div', 'character-references-heading', this.el('strong', '', '角色外貌提示词'), this.el('small', '', '按人物匹配')),
            this.small('每位角色独立填写英文外貌词，按姓名匹配。外貌参考原样参与生图，不自动调用文本模型转换。'), cards, this.button('＋ 添加角色外貌', () => { add(); cards.dispatchEvent(new this.host.Event('change', { bubbles: true })); }, 'character-reference-add'));
        return { node, value: () => JSON.stringify(entries.map(entry => ({ name: entry.name.value.trim(), prompt: entry.prompt.value.trim() })).filter(row => row.prompt)) };
    }

    imagePromptPresets(config, fields) {
        const name = this.input('text', '', '方案名称，例如：柔光动漫'); name.maxLength = 80; name.setAttribute('aria-label', '生图提示词方案名称');
        const select = this.select([], ''); select.setAttribute('aria-label', '已保存的生图提示词方案');
        const status = this.el('small'); const error = this.el('p', 'editor-error'); error.setAttribute('role', 'alert');
        const sync = () => {
            const config = this.state?.imageConfig || {};
            select.replaceChildren(...[['', '选择已保存的方案'], ...(config.promptPresets || []).map(row => [row.id, row.name])].map(([id, title]) => { const option = this.el('option', '', title); option.value = id; return option; }));
            select.value = config.activePromptPreset || '';
            const current = config.promptPresets?.find(row => row.id === select.value);
            name.value = current?.name || ''; status.textContent = current ? `当前使用：${current.name}` : '保存多套画风和正负向提示词，随时切换';
            remove.disabled = !select.value;
        };
        const remove = this.button('删除方案', async () => { await this.flushAutosaves(); if (await this.action('deleteImagePromptPreset', { id: select.value })) sync(); }, 'link danger');
        select.onchange = async () => {
            const id = select.value;
            if (!id) { sync(); return; }
            select.disabled = true;
            try {
                await this.flushAutosaves();
                if (!(await this.action('applyImagePromptPreset', { id }))) return;
                const current = this.state.imageConfig;
                for (const key of IMAGE_PROMPT_FIELDS) if (fields[key]) fields[key].value = current[key] || '';
            } finally { select.disabled = false; sync(); }
        };
        const save = this.button('保存当前提示词为方案', async () => {
            if (!name.value.trim()) { error.textContent = '请填写方案名称'; name.focus(); return; }
            error.textContent = '';
            await this.flushAutosaves();
            const values = Object.fromEntries(IMAGE_PROMPT_FIELDS.map(key => [key, fields[key]?.value || '']));
            if (await this.action('saveImagePromptPreset', { name: name.value, values })) sync();
        }, 'outline image-preset-save');
        const node = this.el('section', 'image-prompt-presets', this.el('div', 'image-presets-heading', this.icon('star'), this.el('strong', '', '我的提示词方案')),
            status, select, this.el('div', 'image-preset-actions', this.small('选择方案即切换'), remove), name, save, this.small('保存画风、自定义画风和正负向补充词；同名保存会更新原方案。'), error);
        sync(); return node;
    }

    modelControl(input, models) {
        const choices = [...new Set(models || [])];
        const select = this.select([['', choices.length ? '选择模型' : '请先读取模型列表'], ...choices.map(id => [id, id])], choices.includes(input.value) ? input.value : '');
        select.className = 'model-dropdown'; select.setAttribute('aria-label', '展开全部模型'); select.disabled = !choices.length;
        select.onchange = () => { if (select.value) { input.value = select.value; input.dispatchEvent(new Event('input', { bubbles: true })); } };
        input.addEventListener('input', () => { select.value = choices.includes(input.value) ? input.value : ''; });
        return this.el('div', 'model-combobox', input, select, this.icon('down'));
    }

    imageSettingsPanel(keepSections = false) {
        const expanded = keepSections ? [...this.pop?.querySelectorAll('.settings-section[open]') || []].map(node => node.querySelector('strong').textContent) : [];
        const config = this.state?.imageConfig || { mode: 'tavern' };
        const fields = {};
        const field = (key, caption, type = 'text', choices) => {
            const node = choices ? this.select(choices, config[key]) : type === 'area' ? this.el('textarea') : this.input(type, ['token', 'upstreamKey'].includes(key) ? '' : config[key]);
            if (type === 'area') { node.value = config[key] || ''; node.rows = 3; }
            if (type === 'password') { node.autocomplete = 'off'; node.placeholder = config[key === 'token' ? 'hasToken' : 'hasUpstreamKey'] ? '已保存，留空保留' : '填写自己的密钥'; }
            fields[key] = node; return this.el('label', `field ${type === 'checkbox' ? 'switch' : ''}`, caption, node);
        };
        const values = () => ({ mode: config.mode, ...Object.fromEntries(Object.entries(fields).filter(([key, node]) => !['token', 'upstreamKey'].includes(key) || node.value).map(([key, node]) => [key, node.type === 'checkbox' ? node.checked : node.value])) });
        const mode = this.select([['tavern', '跟随酒馆生图设置（推荐）'], ['direct', '独立 API 直连'], ['proxy', '自定义后端代理']], config.mode);
        mode.setAttribute('aria-label', '生图连接方式');
        mode.onchange = async () => { await this.flushAutosaves(); this.action('imageMode', { mode: mode.value, values: values() }); };
        const connection = this.el('div', 'form');
        const loadModels = this.button(config.mode === 'tavern' ? '读取酒馆模型' : '拉取模型', async () => { await this.flushAutosaves(); if (await this.action('imageSettingsAuto', values())) this.action('imageModels'); }, 'outline');
        if (config.mode === 'tavern') connection.append(this.small('使用官方 Image Generation 扩展当前已配置的来源、模型和认证；静默生成并返回保存的图片路径，不额外发送正文图片消息，不更改全局配置。'));
        else {
            connection.append(field('endpoint', config.mode === 'direct' ? '自己的生图 API 地址' : '自己的后端代理地址'));
            if (config.mode === 'direct') connection.append(field('format', '接口格式', 'text', [['openai', 'OpenAI 兼容'], ['link', '链接式第三方 / NiniJoker'], ['json', '通用 JSON / SD WebUI']]));
            else connection.append(field('provider', '代理中的生图来源', 'text', [['custom', '链接式第三方 / NiniJoker'], ['novelai', 'NovelAI 官方'], ['openai', 'OpenAI 兼容']]), field('upstreamEndpoint', '上游生图服务地址'));
            connection.append(field('upstreamKey', '自己的 API Key', 'password'));
            if (config.mode === 'proxy') connection.append(field('token', 'NovelAI Token（NovelAI 来源）', 'password'));
            connection.append(field('model', '模型名称'));
            const modelField = fields.model.parentElement;
            modelField.append(this.el('div', 'settings-model-row', this.modelControl(fields.model, this.state?.imageModels), loadModels));
        }
        const params = config.mode === 'tavern' ? this.small('尺寸、步数、CFG、Scale、采样器和模型沿用酒馆设置。') : this.el('div', 'form',
            field('niniSize', '链接式 / 通用尺寸，如 832x1216'), field('niniSteps', '步数'), field('niniScale', 'CFG / Scale'), field('niniCfg', 'CFG Rescale'), field('niniSampler', '采样器'),
            field('openaiSize', 'OpenAI 尺寸，如 1024x1024'), field('openaiQuality', 'OpenAI 质量（不支持时填 none）'), field('modelsEndpoint', '模型列表地址（可选）'));
        const profiles = this.characterProfilesEditor(config.characterProfiles);
        fields.characterProfiles = { get value() { return profiles.value(); } };
        const ruleField = field('imageRules', '生图规则提示词', 'area');
        fields.imageRules.value = config.imageRules ?? DEFAULT_IMAGE_RULES;
        fields.imageRules.rows = 12; fields.imageRules.maxLength = IMAGE_RULES_LIMIT;
        fields.imageRules.setAttribute('aria-label', '生图规则提示词');
        const restoreRules = this.button('恢复默认规则', () => {
            fields.imageRules.value = DEFAULT_IMAGE_RULES;
            fields.imageRules.dispatchEvent(new this.host.Event('change', { bubbles: true }));
        }, 'link');
        const section = (title, caption, open, ...children) => {
            const node = this.el('details', 'settings-section', this.el('summary', '', this.el('strong', '', title), this.el('small', '', caption), this.icon('down')), this.el('div', 'form settings-section-body', ...children));
            node.open = open || expanded.includes(title); return node;
        };
        const connectionSection = section('连接与模型', '选择生图服务与模型', false,
            this.el('label', 'field', '生图连接方式', mode), connection,
            config.mode === 'tavern' ? loadModels : null,
            config.mode === 'tavern' && this.state?.imageModels?.length ? this.small(`酒馆模型：${this.state.imageModels.join('、')}`) : null,
            field('autoGenerate', '新回复 / 动态自动生图（每轮最多一张）', 'checkbox'),
            config.mode !== 'tavern' ? this.button('清除当前方式的生图密钥', async () => { await this.flushAutosaves(); await this.action('imageSettings', { mode: config.mode, token: '', upstreamKey: '' }); this.imageSettingsPanel(true); }, 'link danger') : null);
        const styleSection = section('画风与提示词方案', '选择方案即切换 · 独立于生图规则', false,
            this.imagePromptPresets(config, fields),
            field('style', '额外画风', 'text', [['inherit', '不额外指定'], ['anime', '动漫'], ['cinematic', '电影感'], ['soft', '柔和'], ['dark', '暗色'], ['custom', '自定义']]), field('customStyle', '自定义画风'),
            field('extraPrompt', '正向补充提示词', 'area'), field('negativePrompt', '负面提示词', 'area'));
        const body = this.el('div', 'wechat-page-body image-settings form', connectionSection, styleSection,
            section('生图规则提示词', '全局画面理解规则 · 自动保存', false,
                this.small('用于文本模型理解画面并生成英文提示词；所有连接方式共用，切换画风方案不覆盖。'), ruleField, restoreRules),
            section('角色外貌参考', '按画面中的人物匹配', false, profiles.node),
            section('尺寸与生成参数', config.mode === 'tavern' ? '沿用酒馆原生配置' : '按连接方式分别保留', false, params));
        const entries = Object.entries(fields).filter(([key]) => key !== 'characterProfiles').map(([key, node]) => [node, () => (['token', 'upstreamKey'].includes(key) && !node.value) ? {} : { mode: config.mode, [key]: node.type === 'checkbox' ? node.checked : node.value }]);
        entries.push([profiles.node, () => ({ mode: config.mode, characterProfiles: profiles.value() })]);
        const autosave = this.autoSettings(body, entries, patch => this.action('imageSettingsAuto', patch));
        body.prepend(autosave.status);
        this.fullPage('生图设置', body);
    }

    clearNotificationsButton(rows) {
        const button = this.button('×', () => this.action('clearNotifications'), 'notifications-clear', '清除全部通知');
        button.disabled = !rows.length; return button;
    }

    notifications(state) {
        const notifications = notificationRows(state.rows, state.prefs, PLAYER);
        const rows = notifications.slice(0, 35);
        return this.el('div', 'screen', this.heading('通知中心', 'UPDATES', this.clearNotificationsButton(notifications)), ...rows.map(row => {
            const entry = this.button('', () => this.navigate(['message', 'call'].includes(row.kind) ? 'chat' : row.thread, ['message', 'call'].includes(row.kind) ? row.thread : null), 'notification');
            entry.append(this.el('span', 'notification-icon', this.icon(row.kind === 'message' ? 'messages' : 'notifications')), this.el('span', 'list-info', this.el('strong', '', `${row.speaker} · ${label[row.kind]}`), this.el('small', '', row.text)));
            return entry;
        }), rows.length ? null : this.el('p', 'empty', '暂无通知。'));
    }

    input(type, value, placeholder = '') {
        const node = this.el('input'); node.type = type;
        if (type === 'checkbox') node.checked = value;
        else node.value = value ?? '';
        node.placeholder = placeholder;
        return node;
    }

    select(choices, value) {
        const node = this.el('select');
        for (const [id, caption] of choices) { const option = this.el('option', '', caption); option.value = id; node.append(option); }
        node.value = value; return node;
    }

    wallpaperLibraryView() {
        const library = this.settings.wallpaperLibrary || [];
        const status = this.el('p', `small wallpaper-status${this.wallpaperFeedback?.error ? ' error' : ''}`, this.wallpaperFeedback?.text || '');
        status.dataset.wallpaperStatus = 'true'; status.setAttribute('role', 'status');
        const grid = this.el('div', 'wallpaper-library-grid', ...library.map(item => {
            const active = this.settings.wallpaper === `saved:${item.id}` && !this.settings.wallpaperImage;
            const apply = this.button('', async () => { await this.flushAutosaves(); this.action('applyWallpaper', { id: item.id }); }, 'wallpaper-library-apply', `使用壁纸：${item.name}`);
            apply.append(this.wallpaperPreview(item.image), this.el('span', '', this.el('strong', '', item.name), this.el('small', '', active ? '正在使用' : '点击使用')));
            return this.el('article', `wallpaper-library-item${active ? ' selected' : ''}`, apply,
                this.el('div', 'wallpaper-library-actions', this.button('编辑名称 / 图片', () => this.wallpaperEditor(item), 'link', `编辑壁纸：${item.name}`),
                    this.button('移除', async () => { await this.flushAutosaves(); this.action('deleteWallpaper', { id: item.id }); }, 'link danger', `移除壁纸：${item.name}`)));
        }));
        return this.el('section', 'wallpaper-library', this.el('div', 'wallpaper-library-heading', this.el('strong', '', '我的壁纸'), this.el('small', '', `${library.length} / 30`)),
            grid, library.length ? null : this.small('把喜欢的图片取名保存，以后从上方壁纸列表直接切换。'), status,
            this.el('div', 'actions', this.button('添加壁纸', () => this.wallpaperEditor(), 'outline'), this.button('保存当前壁纸', () => {
                const input = this.content.querySelector('[data-keep="wallpaper-url"]');
                const source = input?.value.trim() || wallpaperSource(this.settings);
                if (!source) { this.notice('请先填写图片链接或上传图片。', true); return; }
                this.wallpaperEditor({ source });
            }, 'outline')));
    }

    wallpaperEditor(item = {}) {
        const name = this.input('text', item.name || '', '给这张壁纸取个名字'); name.maxLength = 60; name.setAttribute('aria-label', '壁纸名称');
        const initial = item.image || item.source || '';
        const url = this.input('url', safeUrl(initial), '图片直链或 freeimage.host 分享链接'); url.setAttribute('aria-label', '壁纸图片链接');
        const file = this.input('file', ''); file.accept = 'image/png,image/jpeg,image/webp,image/gif'; file.setAttribute('aria-label', '选择本地壁纸');
        const preview = this.el('div', 'wallpaper-editor-preview', initial ? this.wallpaperPreview(initial) : this.el('span', '', '图片预览'));
        const status = this.el('p', 'small'); status.setAttribute('role', 'status');
        let temporary = ''; let revision = 0;
        const revoke = () => { if (temporary) this.host.URL.revokeObjectURL(temporary); temporary = ''; };
        const validFile = () => !file.files[0] || file.files[0].size <= 2 * 1024 * 1024 && /^image\/(png|jpeg|webp|gif)$/.test(file.files[0].type);
        const showPreview = async () => {
            const sequence = ++revision;
            if (!validFile()) { status.textContent = '请选择 2 MiB 以内的 PNG/JPEG/WebP/GIF 图片。'; return; }
            status.textContent = '正在检查图片…';
            try {
                let source;
                if (file.files[0]) { revoke(); temporary = this.host.URL.createObjectURL(file.files[0]); source = temporary; }
                else source = await this.resolveWallpaper(url.value.trim() || initial);
                if (sequence !== revision || !preview.isConnected) return;
                const image = this.el('img'); image.src = source; image.alt = '壁纸预览'; image.onerror = () => { status.textContent = '图片无法显示，请更换链接或图片。'; };
                preview.replaceChildren(image); status.textContent = '可保存并加入我的壁纸';
            } catch (error) { if (sequence === revision) status.textContent = error.message; }
        };
        file.onchange = () => { if (file.files[0]) { url.value = ''; if (!name.value.trim()) name.value = file.files[0].name.replace(/\.[^.]+$/, '').slice(0, 60); showPreview(); } };
        url.oninput = () => { revision++; file.value = ''; revoke(); status.textContent = ''; };
        const save = this.button('保存并使用', async () => {
            if (save.disabled) return;
            if (!name.value.trim()) { status.textContent = '请先给壁纸取一个名字。'; name.focus(); return; }
            if (!validFile()) { status.textContent = '请选择 2 MiB 以内的 PNG/JPEG/WebP/GIF 图片。'; return; }
            save.disabled = true; status.textContent = '正在检查并保存壁纸…';
            await this.flushAutosaves();
            const ok = await this.action('saveWallpaper', { id: item.id, name: name.value, url: url.value.trim(), source: initial, file: file.files[0] });
            if (ok) this.closeDialog(); else { save.disabled = false; status.textContent = '未保存，请检查名称、链接或图片后重试。'; }
        }, 'primary');
        this.dialog(item.id ? '编辑我的壁纸' : '添加到我的壁纸', this.el('div', 'form wallpaper-editor', preview,
            this.el('label', 'field', '壁纸名称', name), this.el('label', 'field', '图片链接', url), this.el('label', 'field', '或上传本地图片', file),
            this.small('本地图片最大 2 MiB。支持图片直链和 freeimage.host 分享链接；保存后可在壁纸列表切换。'), this.button('预览图片', showPreview, 'outline'), status, save));
        this.dialogCleanup = () => { revision++; revoke(); };
    }

    authorInfo() {
        const musicUrl = 'https://github.com/soso454u/-';
        const address = this.input('text', musicUrl);
        address.readOnly = true; address.spellcheck = false;
        address.setAttribute('aria-label', '音乐插件安装地址（只读）');
        address.onclick = () => address.select();
        const copyStatus = this.el('p', 'author-copy-status');
        copyStatus.setAttribute('role', 'status'); copyStatus.setAttribute('aria-live', 'polite');
        const copy = this.button('复制安装链接', async () => {
            copy.disabled = true;
            try {
                await this.host.navigator.clipboard.writeText(musicUrl);
                copyStatus.textContent = '安装链接已复制，可粘贴到「安装扩展程序」。';
            } catch {
                address.focus(); address.select();
                let copied = false;
                try { copied = this.doc.execCommand('copy'); } catch {}
                copyStatus.textContent = copied ? '安装链接已复制，可粘贴到「安装扩展程序」。' : '链接已选中，请长按或手动复制。';
            } finally { copy.disabled = false; }
        }, 'primary');
        const download = this.el('a', 'author-download-link', '打开插件下载页');
        download.href = musicUrl; download.target = '_blank'; download.rel = 'noopener noreferrer';
        const step = (title, ...paragraphs) => this.section(title, ...paragraphs.map(text => this.el('p', '', text)));
        // This guide is bundled, read-only content, never a saved settings field.
        const body = this.el('div', 'wechat-page-body author-info',
            this.el('div', 'author-info-hero', this.el('span', 'author-monogram', 'S'), this.el('h1', '', 'Selene手机'),
                this.el('p', 'author-credit', '作者：Selene海莉 | Discord: @beauty_co')),
            step('先连接，再聊天',
                '第一次使用，在「设置 → 连接与模型」选择酒馆当前连接，或填写自己的 API 地址、密钥和模型。',
                '发送消息只保存你的气泡，可以连续发送多条。准备好后，点聊天右上角的星形按钮，才会请求角色统一回复。'),
            step('手机与正文怎么联动',
                '开启正文同步后，新增的手机事件会在下一条正常的酒馆正文用户消息中交接。长按或右键消息，可以选择是否纳入正文。',
                '正文里已经明确写出的手机消息和动态会自动回读。多 NPC 按明确的姓名与收发对象分别收录，模糊提及不会自动补成消息。'),
            step('酒馆联动：第一次安装',
                '如果希望酒馆正文里的手机聊天显示成 iMessage 气泡、社交动态显示成卡片，可以在「设置 → 酒馆联动」安装配套资源。小手机窗口本身可以先直接使用。',
                '先在酒馆打开单个角色聊天，确认联动页的「当前角色」正确，再选择「目标世界书」；默认优先该角色的主世界书。角色还没绑定世界书时，可以先去酒馆绑定，或选一本已有世界书导入后再手动绑定；这里不会新建世界书或自动全局启用。',
                '首次使用可点「一键安装全部联动资源」，依次安装世界书、iMessage 角色局部正则、社交动态角色局部正则三组。也可以在对应分组中单独点「一键导入」。安装后用「检查安装状态」核对结果。'),
            step('酒馆联动：各组资源做什么',
                '「当前角色世界书」提供三类内容：IM丨线上规则约定正文中手机消息的输出格式；IM丨表情包提供可用表情名称；线上丨社交美化约定朋友圈、小红书、抖音和微博的正文动态格式。资源清单里的 325、326、327 是条目顺序，实际安装情况以检查结果为准。',
                '「角色局部正则 · iMessage」把正文里已输出的手机消息显示成聊天气泡和相关组件；「角色局部正则 · 社交动态」负责正文动态和评论的显示。正则装在当前角色卡的局部范围，不会改成全局正则，也不会改变小手机窗口里的聊天样式。',
                '「交接隐藏正则 · 仅显示」隐藏正文中展示的手机交接区块，已交接内容仍可供模型读取。通常会在打开角色时自动安装，也能在这里单独检查、导入或删除。这一组单独管理，不包含在“全部联动资源”的安装和删除里；同步范围仍由正文同步设置及你主动安排的角色手机资料决定。'),
            step('酒馆联动：检查、更新与删除',
                '「检查安装状态」只读取状态，会显示已安装、未安装、已修改或存在冲突。发现重复冲突时，先到酒馆检查重名条目或正则，再继续操作。上方资源清单的绿色标记不代替实际检查。',
                '「一键导入」补齐缺少的配套资源，已有且被修改的同名内容会保留。「更新资源」把对应组对齐到当前脚本自带的版本；覆盖手动安装或修改过的资源时，会先列出需要确认的内容，请核对后再继续。更新小手机本体仍需修改 import 的版本号，保存后重新启用脚本或刷新酒馆。',
                '「一键删除」只移除对应组的配套条目或正则，保留其他资源和世界书本身；手动安装或改过的资源会先要求确认。“一键删除全部联动资源”会先列出世界书、iMessage 和社交动态三组的删除范围，确认后执行。若世界书还被其他角色共用，导入、更新或删除也会影响使用同一本书的角色。'),
            step('酒馆联动：装好后怎么用',
                '继续正常在酒馆进行剧情即可，例如写“我打开朋友圈”或“他拿起手机给我发消息”。配套规则用于呈现剧情中实际发生的手机互动，不要求每轮正文都出现手机，也不会因为安装资源就自动请求模型。',
                '如果正文仍直接显示消息标签，先检查世界书是否绑定并启用、对应资源是否安装，以及当前角色的局部正则是否允许执行。更新资源后再检查一次状态。这些导入、检查、更新和删除操作本身不额外调用模型。'),
            step('动态与角色手机',
                '各社交平台的发布页可主动选择 AI 生成；需要不同模型时，在「各平台 API」分配已保存的连接方案。普通浏览不会生成新动态。',
                '主屏第二页的「角色手机」可以切换手机主人，查看或生成聊天、备忘录、浏览记录和购物车。右上角「生成」可勾选多个栏目，合并只发一次请求；生成期间不能重复提交，失败不会自动重试。生成的聊天是角色与其他 NPC 的模拟记录，不替 user 发言。'),
            step('把已有手机记录带进剧情',
                '已经生成并保存的内容，不用重新生成。点击角色手机里的「同步剧情」，勾选聊天记录、备忘录、浏览记录或购物车，预览后点「安排下一条正文注入」。在聊天详情中操作时，只同步当前会话。选择和同步均不额外调用模型。',
                '随后在酒馆正文输入你的行动，例如：“我查看了她的手机，翻到她和朋友的聊天。” 选中的资料会随这条正文一起提供给模型。同步不自动替 user 写行动，也不代表所有人物都看见了内容。每次安排只交接一次；发送前可取消待注入内容，需要再次查阅时再主动选择。'),
            step('照片与生图分两步',
                '「AI 生成说明与提示词」只准备图片文字；点击「生成图片」才请求生图。先在生图设置中配置酒馆生图或自己的图片接口，聊天照片也可直接选用相册图片。'),
            step('保存自己的壁纸',
                '在「设置 → 外观 → 我的壁纸」添加图片链接或上传本地图片，填写名称后保存。保存的图片会加入壁纸列表，可以直接切换、编辑名称或移除；也可把当前自定义壁纸取名保存。支持 freeimage.host 分享链接，保存前会检查图片能否显示。'),
            this.section('音乐功能 · 需要另装插件',
                this.el('p', '', '使用音乐功能，需要先安装下方的 Selene 音乐插件。'),
                this.el('ol', 'author-install-steps', this.el('li', '', '在酒馆中打开「扩展」，选择「安装扩展程序」。'),
                    this.el('li', '', '复制下方地址，粘贴到安装框中完成安装，并启用插件。'),
                    this.el('li', '', '安装完成后，打开小手机的「音乐」。如未连接到播放器，先刷新酒馆页面再试。')),
                this.el('label', 'field', this.el('span', '', '下载 / 安装地址'), address), copy, copyStatus, download),
            step('保存与换设备',
                '设置修改后会自动保存。换设备前可在「数据同步」点「立即同步」，另一台设备打开同一个酒馆聊天后点「从云端恢复」；也可在「本地账本」导出和恢复备份。API 连接与密钥需在接收设备单独配置。'));
        this.fullPage('作者说明', body);
        const back = this.pop.querySelector('.wechat-page-head .icon-button');
        back.title = '返回设置'; back.setAttribute('aria-label', '返回设置');
    }

    settingsView(state) {
        const settings = this.settings;
        const form = this.el('form', 'screen settings');
        const fields = {};
        const field = (name, caption, kind = 'text', options = []) => {
            const node = kind === 'choice' ? this.select(options, settings[name]) : kind === 'area' ? this.el('textarea') : this.input(kind, name === 'secret' ? '' : settings[name]);
            if (kind === 'area') { node.value = settings[name]; node.rows = name === 'preset' ? 7 : 3; }
            if (name === 'secret') { node.placeholder = this.hasApiKey ? '已保存；留空保留' : '未设置；请输入独立 API 密钥'; node.autocomplete = 'off'; }
            if (kind === 'number') node.step = 'any';
            if (name === 'output') { node.min = '0'; node.step = '1'; node.placeholder = '0：跟随模型服务'; }
            fields[name] = node;
            return this.el('label', `field ${kind === 'checkbox' ? 'switch' : ''}`, this.el('span', '', caption), node);
        };
        const values = () => Object.fromEntries(Object.entries(fields).filter(([key, node]) => key !== 'secret' || node.value).map(([key, node]) => [key, node.type === 'checkbox' ? node.checked : node.value]));
        const scale = this.input('range', '');
        scale.min = '50'; scale.max = '150'; scale.step = '1'; scale.value = settings.scale;
        scale.setAttribute('aria-label', '窗口缩放'); fields.scale = scale;
        const scaleValue = this.el('output', '', `${settings.scale}%`);
        const previewScale = () => {
            scaleValue.textContent = `${scale.value}%`;
            scale.setAttribute('aria-valuetext', `${scale.value}%`);
            this.windowScale = Number(scale.value) / 100; this.bound();
        };
        scale.oninput = previewScale;
        const scaleControl = this.el('div', 'window-scale', this.el('div', 'window-scale-heading', this.el('span', '', '窗口缩放'), scaleValue,
            this.button('恢复 100%', () => { scale.value = '100'; previewScale(); scale.dispatchEvent(new this.host.Event('change', { bubbles: true })); }, 'link')), scale,
            this.small('50%–150%，文字、图标和按钮一起缩放；屏幕较小时自动适配。滑动预览，松开后自动保存。'));
        const platformFields = {};
        const platformApiGroup = this.settingsGroup('各平台 API', '朋友圈、小红书、抖音、微博、论坛与 X 分别配置', 'wifi', this.small('先在“连接与模型”保存带密钥的 API 方案，再分配给各平台。每个方案可使用不同地址、模型和密钥。'),
            ...Object.entries(PLATFORMS).map(([key, name]) => {
                const select = this.select([['', '跟随默认连接'], ...(settings.apiProfiles || []).map(profile => [profile.id, profile.name])], settings.platformApis?.[key] || '');
                platformFields[key] = select; return this.el('label', 'field', `${name} API 方案`, select);
            }));
        const promptFields = {};
        const commonField = field('socialCommonPrompt', '全平台通用提示词', 'area');
        fields.socialCommonPrompt.maxLength = 16000; fields.socialCommonPrompt.rows = 9; fields.socialCommonPrompt.setAttribute('aria-label', '全平台通用提示词');
        const promptValues = () => ({ socialCommonPrompt: fields.socialCommonPrompt.value, platformPrompts: Object.fromEntries(Object.entries(promptFields).map(([id, node]) => [id, node.value])) });
        const platformPromptGroup = this.settingsGroup('各平台提示词', '所有平台 · 通用真人感与独立发帖风格', 'edit',
            this.small('生成动态时读取通用规则和当前平台规则；各平台文本替换对应内置风格。可直接粘贴纯文本要求，页面仍按应用样式展示。编辑后自动保存。'), commonField,
            this.button('恢复通用默认文本', () => { fields.socialCommonPrompt.value = SOCIAL_COMMON_PROMPT; fields.socialCommonPrompt.dispatchEvent(new this.host.Event('change', { bubbles: true })); }, 'link'),
            ...Object.entries(PLATFORMS).map(([id, name]) => {
                const input = this.el('textarea'); input.rows = 7; input.maxLength = 16000; input.value = settings.platformPrompts?.[id] || PLATFORM_RULES[name].text;
                input.setAttribute('aria-label', `${name}提示词`); promptFields[id] = input;
                return this.el('details', 'platform-prompt', this.el('summary', '', `${name}${settings.platformPrompts?.[id] ? ' · 自定义' : ''}`),
                    this.el('div', 'form', input, this.button(`恢复${name}默认文本`, () => { input.value = PLATFORM_RULES[name].text; input.dispatchEvent(new this.host.Event('change', { bubbles: true })); }, 'link')));
            }));
        form.onsubmit = event => event.preventDefault();
        const modelField = field('model', '自定义模型');
        const profiles = this.select([['', '选择已保存的 API 方案'], ...(settings.apiProfiles || []).map(profile => [profile.id, profile.name])], settings.activeApiProfile || '');
        profiles.setAttribute('aria-label', '已保存的 API 方案');
        const profileName = this.input('text', settings.apiProfiles?.find(profile => profile.id === settings.activeApiProfile)?.name || '', '方案名称，例如 DeepSeek 日常');
        profileName.setAttribute('aria-label', 'API 方案名称'); profileName.maxLength = 50;
        const profileControls = this.el('details', 'settings-subsection', this.el('summary', '', '我的 API 方案 · 选择即切换'), this.el('div', 'form', profiles, this.el('label', 'field', '方案名称', profileName), this.el('div', 'actions',
            this.button('保存当前方案', async () => { await this.flushAutosaves(); this.action('saveApiProfile', { name: profileName.value, values: values() }); }, 'outline'),
            this.button('删除方案', () => this.dialog('删除 API 方案？', this.small('只删除所选保存方案，当前连接参数和聊天记录保留。'), () => this.action('deleteApiProfile', { id: profiles.value })), 'outline danger')),
            this.small('选择即切换连接与密钥；同名保存会更新原方案。')));
        profiles.onchange = async () => { const id = profiles.value; if (id) { await this.flushAutosaves(); this.action('applyApiProfile', { id }); } };
        const modelPicker = state?.models?.length ? this.select([['', '从服务端列表选择模型'], ...state.models.map(id => [id, id])], state.models.includes(settings.model) ? settings.model : '') : null;
        if (modelPicker) { modelPicker.setAttribute('aria-label', '服务端模型列表'); modelPicker.onchange = () => { if (modelPicker.value) { fields.model.value = modelPicker.value; fields.model.dispatchEvent(new this.host.Event('change', { bubbles: true })); } }; }
        form.append(this.heading('设置', 'PREFERENCES'), this.settingsGroup('连接与模型', '生成通路、API 和模型参数', 'wifi', field('apiMode', '生成通路', 'choice', [['tavern', '酒馆当前连接'], ['custom', '独立 OpenAI 兼容 API']]),
            field('base', '独立 Base URL'), field('secret', '独立 API 密钥（持久保存）', 'password'), modelPicker, this.el('div', 'settings-model-row', modelField, this.button('拉取模型', async () => { if ((await this.flushAutosaves()).every(Boolean)) await this.action('models'); }, 'outline')), profileControls,
            field('streaming', '独立 API 流式接收', 'checkbox'), this.small('逐步接收以减轻网关等待；完整结构化回复接收成功后才显示和写入账本。连接测试成功只代表短请求可用。'),
            field('temperature', '独立温度', 'number'), field('output', '手机最大输出 Token（0＝不额外限制）', 'number'), this.small('默认不发送输出上限，由服务商决定。可填写任意有效正整数；要求明确上限的原生服务沿用当前连接设置。'), this.el('div', 'actions', this.button('测试连接', async () => { if ((await this.flushAutosaves()).every(Boolean)) await this.action('test'); }, 'outline'), this.button('清除当前密钥', () => this.action('settings', { secret: '' }), 'link')),
            this.small('连接测试会发一个不含剧情的短请求。模型列表不请求生成。密钥保存在当前酒馆账号的浏览器存储中，刷新或更新脚本后保留；不进入剧情、聊天备份或提示词。')),
            platformApiGroup, platformPromptGroup,
            this.settingsGroup('生图设置', '跟随酒馆、独立 API 与自定义代理', 'imagegen', this.button('打开生图设置', () => this.imageSettingsPanel(), 'outline'), this.small('连接、画风、画面规则与角色参考在此管理；密钥独立保存在本机。')),
            this.settingsGroup('手机专用预设', settings.presetEnabled ? '已启用 · 按任务装配模块' : '已禁用 · 保留应用输出协议', 'spark', this.small('关闭行为预设后仍读取剧情资料，并保留应用输出协议。不会继承酒馆正文预设。'),
                field('presetEnabled', '启用手机行为预设', 'checkbox'), field('preset', '手机专用预设文本', 'area'), this.el('div', 'actions',
                    this.button('导入文本', () => {
                        const file = this.input('file', ''); file.accept = '.txt,.md,text/plain,text/markdown';
                        this.dialog('导入手机预设', this.el('div', 'form', file, this.small('导入会替换当前预设文本并保存，不改变启用状态。')), () => this.action('importPreset', { file: file.files[0] }));
                    }, 'outline'), this.button('导出文本', () => this.action('exportPreset', { text: fields.preset.value }), 'outline'),
                    this.button('恢复默认', () => this.dialog('恢复内置手机预设？', this.small('将替换当前预设文本，不改变启用状态。'), () => this.action('resetPreset')), 'outline'))),
            this.settingsGroup('上下文与记忆', '世界书、正文范围和预算', 'contacts', field('budget', '上下文 Token 预算（估算）', 'number'), field('storyLimit', '正文最近消息数', 'number'), field('lore', '读取适用世界书', 'checkbox'), field('dynamic', '读取可核验的剧情摘要与记忆', 'checkbox')),
            this.settingsGroup('正文同步', '双向剧情交接与触发', 'messages', field('sync', '手机 → 正文', 'choice', [['auto', '自动交接'], ['manual', '手动安排下一轮'], ['pause', '暂停并保留队列'], ['off', '关闭，新事件仅本地']]), field('syncChars', '每轮交接字符上限', 'number'), field('reverse', '正文 → 手机', 'checkbox'), field('imessage', '识别 iMessage 线上规则', 'checkbox'), field('prose', '识别明确的正文原话', 'checkbox'), field('eventTag', 'XML 事件标签'), field('jsonTag', 'JSON 容器标签'), field('socialAliases', '网名与人物对应（每行：网名=人物名）', 'area'), field('auto', '仅手机打开时的事件触发', 'choice', [['off', '关闭'], ['initiative', '主动消息'], ['post', '角色动态']]), field('every', '自动行为至少间隔几层', 'number'), this.small('自动行为只在正文明确写出新手机事件时评估；另有五分钟冷却。')),
            this.settingsGroup('酒馆联动', '世界书与角色局部正则', 'contacts', state?.resourceTarget && this.resourceManager ? this.resourcePanel(state.resourceTarget, this.resourceManager) : this.small(state?.resourceError || '选择角色后，可在此一键导入世界书和局部正则。')),
            this.settingsGroup('数据同步', state?.cloudStatus || '聊天、各平台、相册和提示词', 'wifi', field('autoCloud', '自动云端保存', 'checkbox'), this.small('同步当前酒馆聊天下的全部私聊、群聊、六个平台的帖子与互动、相册图片、手机设置及生图规则/画风方案/角色参考。API 地址、密钥、模型和连接方案保持各设备本机设置；数据存入酒馆聊天文件，不作为模型提示词。'),
                this.button('立即同步', () => this.action('cloudSave'), 'outline'), this.button('从云端恢复', () => this.action('cloudRestore'), 'outline'),
                this.button('清空数据', () => this.dialog('清空当前聊天的手机数据？', this.el('div', 'form',
                    this.small('删除当前酒馆聊天下的全部手机聊天、动态、互动、记忆、手动联系人、群聊、本机相册及聊天背景设置；同时清空此聊天的手机云端备份（酒馆群聊仅清空本机）。'),
                    this.small('保留其他聊天、API 与密钥、手机预设、外观和角色绑定，以及酒馆正文、世界书和正则。已有正文中的旧手机消息不会重新导入。此操作不可撤销，建议先在“本地账本”导出备份。')),
                    () => this.action('clearData', { scope: state.scope })), 'outline danger')),
            this.settingsGroup('外观', '主题、壁纸和窗口缩放', 'moments', scaleControl, field('showLauncher', '显示悬浮手机图标', 'checkbox'), this.small('隐藏后，可从酒馆魔法棒工具栏 → Selene手机打开。悬浮图标支持拖动，位置会自动保存。'),
                field('musicIsland', 'Selene 音乐灵动岛', 'checkbox'), this.small('检测到兼容播放器时自动联动；播放信息仅用于此界面，不进入剧情。'),
                this.button('重置悬浮图标位置', () => this.action('launcherPosition', { position: null }), 'outline'), field('theme', '颜色模式', 'choice', [['auto', '跟随系统'], ['light', '浅色'], ['dark', '深色']]), field('wallpaper', '壁纸', 'choice', [...Object.entries(WALLPAPERS).map(([id, item]) => [id, item.name]), ...settings.wallpaperLibrary.map(item => [`saved:${item.id}`, `我的壁纸 · ${item.name}`])]),
                this.backgroundPages(state),
                field('wallpaperImage', '自定义壁纸图片链接（留空使用所选壁纸）'), field('wallpaperShade', '壁纸遮罩 0–85', 'number'),
                this.wallpaperLibraryView(), this.button('上传本地壁纸', () => this.wallpaperEditor(), 'outline'),
                this.button('恢复内置壁纸', () => this.action('settings', { wallpaper: 'dusk', wallpaperImage: '', wallpaperShade: 30 }), 'outline'), field('clockMode', '锁屏与状态栏时钟', 'choice', [['device', '设备时钟（不推进剧情）'], ['rp', '剧情时间（未知时留空）']]),
                field('rpTimeAuto', '从正文自动读取 RP 时间', 'checkbox'), this.small(`当前剧情时间：${state?.rpTime || '尚未识别'}。读取正文的明确时间，不按设备时间推算；关闭自动读取可手动指定。`), field('rpTime', '手动 RP 时间（未识别时使用，可留空）')),
            this.settingsGroup('角色绑定与分享', state?.cardBound ? `已绑定 ${state.cardName}` : '让背景、表情包和手机预设随角色卡分享', 'contacts',
                this.small('绑定后，外观修改按当前角色单独保存。修改后需再次更新绑定，才会写入角色卡；导出角色卡和本脚本即可分享。API 密钥、个人头像和聊天记录不会写入角色卡。'),
                this.button(state?.cardBound ? '更新当前角色绑定' : '绑定当前角色', () => this.dialog(`绑定到 ${state?.cardName || '当前角色'}？`, this.small('保存当前背景、表情包及手机预设到角色卡。上传的背景会一并嵌入，不依赖本机文件路径。'), async () => { if ((await this.flushAutosaves()).every(Boolean)) await this.action('bindCharacter', { avatar: state?.cardAvatar }); }), 'outline'),
                this.button('恢复默认脚本', () => this.dialog('恢复默认脚本？', this.small('恢复默认外观、表情包和手机预设；若当前角色已绑定，同时更新其默认模板。保留 API 连接及密钥、聊天账本、原版正则和世界书。'), () => this.action('resetPhoneDefaults')), 'outline')),
            this.settingsGroup('本地账本', '导出聊天或恢复备份', 'debug', this.small('导出当前酒馆聊天下的全部手机聊天、各平台、相册、设置和提示词；不包含 API 连接与密钥。云端同步使用相同范围。'), this.el('div', 'actions', this.button('导出当前聊天', () => this.action('backup'), 'outline'), this.button('恢复备份', () => {
                const file = this.input('file', ''); file.accept = '.json,application/json';
                this.dialog('恢复到当前聊天', this.el('div', 'form', file, this.small('只匹配同一角色/群和聊天文件；不会覆盖同 ID 的本地记录。')), () => this.action('restore', { file: file.files[0] }));
            }, 'outline'))));
        // An explicit preset selection takes precedence over an earlier custom image.
        // Only the unsaved form changes here; the existing Save settings action persists it.
        fields.wallpaper.onchange = () => { fields.wallpaperImage.value = ''; };
        fields.wallpaperImage.dataset.keep = 'wallpaper-url';
        const persona = state?.people?.find(person => person.id === PLAYER) || { id: PLAYER, name: state?.context?.name1 || '玩家', avatar: settings.userAvatar };
        const profile = this.button('', () => this.avatarEditor(persona), 'settings-profile', '修改我的头像');
        profile.append(this.avatar(persona, 'large'), this.el('span', '', this.el('strong', '', persona.name), this.el('small', '', '个人头像 · 点击更换')), this.icon('right'));
        form.querySelector('.page-heading').after(profile);
        const categories = [...form.children].filter(node => node.classList.contains('settings-group'));
        const lists = [];
        // 连接、剧情、外观、数据分别成组，所有条目统一使用紧凑行。
        for (const [start, end, caption] of [[0, 4, '连接与生成'], [4, 8, '预设与剧情'], [9, 11, '外观与分享']]) {
            const list = this.el('div', 'ios-settings-list', ...categories.slice(start, end));
            list.setAttribute('role', 'group'); list.setAttribute('aria-label', caption); lists.push(list);
        }
        const dataList = this.el('div', 'ios-settings-list', categories[8], categories[11]);
        dataList.setAttribute('role', 'group'); dataList.setAttribute('aria-label', '数据管理'); lists.push(dataList);
        form.append(...lists);
        const about = this.button('', () => this.authorInfo(), 'settings-about-row', '作者说明');
        about.append(this.el('span', 'settings-icon', this.icon('user')), this.el('span', 'settings-label', this.el('strong', '', '作者说明')), this.icon('right'));
        const aboutList = this.el('div', 'ios-settings-list', about);
        aboutList.setAttribute('role', 'group'); aboutList.setAttribute('aria-label', '作者与使用说明');
        categories.push(about); lists.push(aboutList); form.append(aboutList);
        const search = this.input('search', '', '搜索设置');
        search.className = 'search'; search.setAttribute('aria-label', '搜索设置');
        search.oninput = () => {
            for (const category of categories) category.hidden = !category.textContent.includes(search.value.trim());
            for (const list of lists) list.hidden = [...list.children].every(category => category.hidden);
        };
        const searchBox = this.el('label', 'search-box settings-search', this.icon('search'), search);
        profile.after(searchBox);
        const entries = Object.entries(fields).map(([key, node]) => [node, () => key === 'secret' && !node.value ? {} : { [key]: node.type === 'checkbox' ? node.checked : node.value, ...(key === 'wallpaper' ? { wallpaperImage: '' } : {}) }]);
        entries.push(...Object.values(promptFields).map(node => [node, () => ({ platformPrompts: promptValues().platformPrompts })]));
        entries.push(...Object.values(platformFields).map(node => [node, () => ({ platformApis: Object.fromEntries(Object.entries(platformFields).map(([key, select]) => [key, select.value])) })]));
        const autosave = this.autoSettings(form, entries, patch => this.action('settingsAuto', patch));
        searchBox.after(autosave.status);
        return form;
    }

    avatarEditor(persona) {
        const preview = this.el('div', 'avatar-editor-preview', this.avatar(persona, 'large'), this.el('strong', '', persona.name));
        const url = this.input('url', safeUrl(this.settings.userAvatar), 'https://… 图片地址');
        url.setAttribute('aria-label', '头像图片地址');
        const file = this.input('file', ''); file.accept = 'image/png,image/jpeg,image/webp,image/gif';
        file.setAttribute('aria-label', '上传头像图片');
        let temporary = '';
        const clearTemporary = () => { if (temporary) this.host.URL.revokeObjectURL(temporary); temporary = ''; };
        const updatePreview = source => {
            const avatar = this.avatar({ name: persona.name }, 'large');
            if (source) {
                const image = this.el('img'); image.src = source; image.alt = '头像预览';
                image.onerror = () => image.remove(); avatar.append(image);
            }
            preview.firstElementChild.replaceWith(avatar);
        };
        url.oninput = () => { file.value = ''; clearTemporary(); updatePreview(safeUrl(url.value)); };
        file.onchange = () => {
            clearTemporary();
            const selected = file.files[0];
            if (!selected) { updatePreview(safeUrl(url.value) || persona.avatar); return; }
            if (selected.size > 2 * 1024 * 1024 || !/^image\/(png|jpeg|webp|gif)$/.test(selected.type)) { file.value = ''; this.notice('请选择 2 MiB 以内的 PNG/JPEG/WebP/GIF 图片。', true); return; }
            url.value = ''; temporary = this.host.URL.createObjectURL(selected); updatePreview(temporary);
        };
        const save = this.button('保存头像', async () => {
            const selected = file.files[0];
            const source = safeUrl(url.value);
            if (!selected && !source) { this.notice('请先选择图片或填写有效的图片地址。', true); return; }
            save.disabled = true;
            const ok = await (selected ? this.action('avatarFile', { file: selected }) : this.action('settings', { userAvatar: source }));
            save.disabled = false;
            if (ok) this.closeDialog();
        }, 'primary');
        this.dialog('我的头像', this.el('div', 'form', preview, this.el('label', 'field', '上传图片', file), this.el('label', 'field', '图片地址', url),
            this.small('支持 PNG、JPEG、WebP、GIF，最大 2 MiB。保存后用于这部小手机，刷新或更新脚本后保留。'), save,
            this.button('恢复 Persona 原头像', async () => { if (await this.action('settings', { userAvatar: '' })) this.closeDialog(); }, 'outline'),
            this.button('人设与联系人', () => { this.closeDialog(); this.navigate('contacts'); }, 'link')));
        this.dialogCleanup = clearTemporary;
    }

    debug(state) {
        const pack = state.prepared || state.lastRequest;
        const sourceNames = { preset: '手机预设', persona: 'Persona', profiles: 'Char/NPC', lore: '世界书', storyMemory: '剧情记忆', story: '近期正文', phoneMemory: '手机记忆', phone: '近期手机聊天', task: '本轮任务' };
        const tokens = new Map();
        for (const item of pack?.sources ?? []) tokens.set(item.group, (tokens.get(item.group) ?? 0) + item.tokens);
        const reports = pack ? this.el('div', 'report', ...pack.sources.map(item => this.el('details', '',
            this.el('summary', '', this.el('span', '', item.name), this.el('small', '', `≈${item.tokens} T · ${item.role}`)), this.el('pre', '', item.content))))
            : this.small('前往会话 → ··· → 预览上下文，或先发起一轮手机回复。');
        const statusRows = [...new Map([...(state.pending || []), ...state.rows].map(row => [row.id, row])).values()].slice(0, 65);
        return this.el('div', 'screen', this.heading('调试面板', 'CONTEXT & SYNC'),
            state.lastRequest?.failure ? this.section('上次回复解析失败', this.small(state.lastRequest.failure.message),
                this.small(`仅在本页临时保留，不加入剧情或后续模型请求。${state.lastRequest.failure.truncated ? '原文超过 40000 字，仅展示前 40000 字。' : ''}`),
                this.el('details', '', this.el('summary', '', '查看模型原始回复'), this.el('pre', '', state.lastRequest.failure.response))) : null,
            this.section('实际来源', this.small(`聊天：${JSON.parse(state.scope).at(-1)} · 当前分支 ${state.trail.tail}`),
                pack ? this.el('div', 'token-total', this.el('strong', '', `≈${pack.used.toLocaleString('zh-CN')}`), this.el('span', '', '估算 Token')) : this.small('暂无预览。'),
                tokens.size ? this.el('div', 'token-breakdown', ...[...tokens].map(([group, total]) => this.el('div', '', this.el('span', '', sourceNames[group]), this.el('strong', '', `≈${total} T`)))) : null,
                ...(pack?.books ?? []).map(text => this.small(text)), ...(pack?.warnings ?? []).map(text => this.small(text)), reports),
            this.section('剧情交接', this.small(`当前有效正文中有 ${state.trail.byEvent.size} 个已写入事件。外部摘要是否逐条覆盖：未验证。`),
                state.settings.sync === 'manual' ? this.button(state.armed ? '已安排下一轮' : '安排下一条正文发送', () => this.action('arm'), 'outline') : null,
                ...statusRows.map(row => this.el('div', 'event-report', this.el('strong', '', `${this.status(row, state.trail)} · ${label[row.kind]} · #${state.trail.byEvent.get(row.id)?.floor ?? row.floor}`), this.small(`${row.speaker}：${row.text}`), row.memory ? this.el('small', '', `已保留本地长期记忆：${row.memory}`) : null))),
            this.section('归档与错误', this.small('长会话按阈值建立本地阶段摘录；保留原文。模型建议不自动当作事实。'), this.small(state.notice || '暂无操作回执。')));
    }

    dialog(title, body, done) {
        this.musicIsland?.closeCard();
        this.closeDialog();
        const pop = this.el('dialog', 'dialog');
        const heading = this.el('div', 'dialog-head', this.el('h2', '', title), this.button('×', () => this.closeDialog(), 'dismiss', '关闭对话框'));
        pop.append(heading, body);
        if (done) pop.append(this.button('确认', () => { this.closeDialog(); done(); }, 'primary'));
        this.panel.append(pop); this.pop = pop;
        if (typeof pop.show === 'function') pop.show(); else pop.setAttribute('open', '');
        pop.addEventListener('keydown', event => { if (event.key === 'Escape') { event.stopPropagation(); this.closeDialog(); } });
        pop.querySelector('input:not([type="checkbox"]), textarea, select, button')?.focus({ preventScroll: true });
    }

    closeDialog() { this.flushAutosaves(); this.commentCleanup?.(); this.dialogCleanup?.(); this.dialogCleanup = null; this.pop?.remove(); this.pop = null; }

    close() {
        this.host.clearTimeout(this.keyboardTimer);
        this.musicApp?.dispose();
        this.restoreHomePage = null;
        this.musicIsland?.dispose();
        this.host.clearTimeout(this.noticeTimer);
        this.wandObserver?.disconnect(); this.wandEntry?.remove();
        this.visible = false;
        this.host.removeEventListener('resize', this.resize);
        this.host.visualViewport?.removeEventListener('resize', this.resize);
        this.host.visualViewport?.removeEventListener('scroll', this.resize);
        this.closeDialog(); this.root.remove();
    }
}

module.exports = { Phone };
