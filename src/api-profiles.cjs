const { clip, newId } = require('./domain.cjs');

const PROFILE_FIELDS = ['apiMode', 'base', 'model', 'temperature', 'output', 'streaming'];

function profileValues(input) {
    return Object.fromEntries(PROFILE_FIELDS.filter(key => Object.hasOwn(input, key)).map(key => [key, input[key]]));
}

function cleanProfiles(profiles) {
    return Array.isArray(profiles) ? profiles.filter(profile => typeof profile?.id === 'string' && typeof profile.name === 'string' && profile.values && typeof profile.values === 'object')
        .map(profile => ({ id: clip(profile.id, 80), name: clip(profile.name, 50), values: profileValues(profile.values) })).slice(0, 100) : [];
}

function saveProfile(profiles, name, input) {
    const title = clip(name, 50);
    if (!title) throw new Error('请先填写 API 方案名称。');
    const rows = cleanProfiles(profiles);
    const existing = rows.find(profile => profile.name === title);
    if (!existing && rows.length >= 100) throw new Error('API 方案最多保存 100 个，请先删除不再使用的方案。');
    const profile = { id: existing?.id || newId(), name: title, values: profileValues(input) };
    return { profiles: [...rows.filter(row => row.id !== profile.id), profile], id: profile.id };
}

// Credentials use a separate account-storage entry, never profile exports or story data.
function cleanCredentials(input) {
    return { current: clip(input?.current, 4000), profiles: Object.fromEntries(Object.entries(input?.profiles || {}).filter(([id, token]) => id.length <= 80 && typeof token === 'string').slice(0, 100).map(([id, token]) => [id, clip(token, 4000)])) };
}

function generationConnection(settings, credentials, platform) {
    const id = settings.platformApis?.[platform];
    const profile = settings.apiProfiles.find(row => row.id === id);
    return profile ? { settings: { ...settings, ...profile.values }, token: credentials.profiles[profile.id] || '' }
        : { settings, token: credentials.current || '' };
}

module.exports = { cleanProfiles, profileValues, saveProfile, cleanCredentials, generationConnection };
