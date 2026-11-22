const { DEFAULTS, phoneSettings } = require('./context.cjs');
const { configuration, IMAGE_DEFAULTS } = require('./image-service.cjs');
const { fingerprint } = require('./resources.cjs');

// Connection settings and credentials stay on the receiving device.
const CONNECTION_KEYS = new Set(['apiMode', 'base', 'model', 'temperature', 'output', 'outputLimitVersion', 'streaming', 'apiProfiles', 'activeApiProfile', 'platformApis']);
const SETTINGS_KEYS = Object.keys(DEFAULTS).filter(key => !CONNECTION_KEYS.has(key));
const IMAGE_KEYS = Object.keys(IMAGE_DEFAULTS).filter(key => !['provider', 'format', 'endpoint', 'upstreamEndpoint', 'modelsEndpoint', 'model', 'token', 'upstreamKey'].includes(key));
const PREF_KEYS = ['chatBackgrounds', 'seen', 'pins', 'muted', 'hiddenBefore', 'hiddenSocial', 'postSync', 'notificationsClearedThrough'];
const safeKeys = value => Object.keys(value || {}).filter(key => !['__proto__', 'constructor', 'prototype'].includes(key));
const pick = (value, keys) => Object.fromEntries(keys.filter(key => Object.hasOwn(value || {}, key)).map(key => [key, value[key]]));

function portableSettings(input) {
    return pick(phoneSettings(input), SETTINGS_KEYS.filter(key => Object.hasOwn(input || {}, key)));
}
function portableImage(input) {
    const clean = configuration(input);
    return { imageRules: clean.imageRules, autoGenerate: clean.autoGenerate, promptPresets: clean.promptPresets, activePromptPreset: clean.activePromptPreset,
        profiles: Object.fromEntries(Object.entries(clean.profiles).map(([mode, values]) => [mode, pick(values, IMAGE_KEYS)])) };
}
function portablePhone(input = {}) {
    input ||= {};
    return { ...(input.settings ? { settings: portableSettings(input.settings) } : {}), ...(input.image ? { image: portableImage(input.image) } : {}),
        ...(input.style ? { style: portableSettings(input.style) } : {}) };
}
const phoneDefaults = { settings: portableSettings(DEFAULTS), image: portableImage(), style: portableSettings(DEFAULTS) };
const hash = value => fingerprint(value === undefined ? { missing: true } : value);
const record = value => value && typeof value === 'object' && !Array.isArray(value);

// Compare each setting with the last successful sync. An unchanged device adopts
// remote changes; simultaneous edits keep the local value. Explicit restore wins.
function mergeState(local, remote, base = {}, defaults, restore = false, path = '') {
    if (remote === undefined) return local;
    if (record(local) && record(remote)) {
        return Object.fromEntries([...new Set([...safeKeys(local), ...safeKeys(remote)])].map(key => [key,
            mergeState(local[key], remote[key], base, defaults?.[key], restore, `${path}/${key}`)]).filter(([, value]) => value !== undefined));
    }
    if (restore || local === undefined || (Object.hasOwn(base, path) ? base[path] === hash(local) : hash(local) === hash(defaults) || local === null || local === '' || Array.isArray(local) && !local.length)) return remote;
    return local;
}
function stateHashes(value, path = '', result = {}) {
    if (record(value)) for (const key of safeKeys(value)) stateHashes(value[key], `${path}/${key}`, result);
    else result[path] = hash(value);
    return result;
}
function backupState(backup) {
    const keyed = rows => Object.fromEntries((rows || []).map(row => [row.id, row]));
    return { phone: portablePhone(backup.phone), prefs: pick(backup.prefs, PREF_KEYS), photoPrompts: backup.photoPrompts || {},
        people: keyed(backup.people), threads: keyed(backup.threads),
        photoInfo: keyed((backup.photos || []).map(({ asset, ...row }) => row)) };
}
function mergeBackupData(local, remote = {}, base = {}, restore = false) {
    const state = mergeState(backupState(local), backupState(remote), base, { phone: phoneDefaults }, restore);
    const byId = (left = [], right = []) => [...new Map([...right, ...left].map(row => [row.id, row])).values()];
    const deletedPhotos = [...new Set([...(local.deletedPhotos || []), ...(remote.deletedPhotos || [])])];
    const photos = byId(restore ? remote.photos : local.photos, restore ? local.photos : remote.photos).filter(row => !deletedPhotos.includes(row.id)).map(row => ({ ...row, ...state.photoInfo[row.id] }));
    const photoAssets = { ...remote.photoAssets, ...local.photoAssets };
    const { photoInfo, people, threads, ...mergedState } = state;
    return { ...local, ...mergedState, people: Object.values(people), threads: Object.values(threads),
        photos, deletedPhotos,
        photoAssets: Object.fromEntries([...new Set(photos.map(row => row.asset).filter(Boolean))].filter(id => photoAssets[id]).map(id => [id, photoAssets[id]])),
        chatBackgrounds: state.prefs.chatBackgrounds || { ...remote.chatBackgrounds, ...local.chatBackgrounds },
        backgroundAssets: { ...remote.backgroundAssets, ...local.backgroundAssets },
        clearedStory: restore ? remote.clearedStory || local.clearedStory : local.clearedStory || remote.clearedStory };
}

module.exports = { SETTINGS_KEYS, IMAGE_KEYS, PREF_KEYS, pick, portableSettings, portableImage, portablePhone, backupState, stateHashes, mergeBackupData };
