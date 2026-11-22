const { test } = require('node:test');
const assert = require('node:assert/strict');
const { saveProfile, cleanProfiles } = require('../src/api-profiles.cjs');
const { phoneSettings } = require('../src/context.cjs');

test('API profiles survive reload, update by name and never retain session keys or story data', () => {
    const values = { apiMode: 'custom', base: 'https://example.test/v1', model: 'model-a', temperature: 0.7, output: 0, streaming: true, secret: 'private-key', token: 'private-token', chat: '剧情', preset: '人物规则' };
    const saved = saveProfile([], '日常', values);
    const updated = saveProfile(saved.profiles, '日常', { ...values, model: 'model-b' });
    assert.equal(updated.profiles.length, 1);
    assert.equal(updated.id, saved.id);
    assert.equal(updated.profiles[0].values.model, 'model-b');
    const second = saveProfile(updated.profiles, '备用', { ...values, output: 64000 });
    const restored = phoneSettings(JSON.parse(JSON.stringify({ apiProfiles: second.profiles, activeApiProfile: second.id, outputLimitVersion: 1 })));
    assert.equal(restored.apiProfiles.length, 2);
    assert.equal(restored.activeApiProfile, second.id);
    assert.equal(restored.apiProfiles[1].values.output, 64000);
    assert.doesNotMatch(JSON.stringify(restored.apiProfiles), /private-key|private-token|剧情|人物规则|secret|token/);
    assert.deepEqual(cleanProfiles([{ id: 'a', name: '旧方案', values: { base: 'https://example.test', secret: 'must-remove' } }])[0].values, { base: 'https://example.test' });
    assert.throws(() => saveProfile([], '', values), /方案名称/);
});

test('credentials survive serialization and each platform resolves its own profile without leaking keys into settings', () => {
    const { cleanCredentials, generationConnection } = require('../src/api-profiles.cjs');
    let profiles = [];
    const credentials = { current: 'default-key', profiles: {} };
    const platformApis = {};
    for (const platform of ['redbook', 'douyin', 'weibo', 'forum']) {
        const saved = saveProfile(profiles, platform, { apiMode: 'custom', base: `https://${platform}.example.test/v1`, model: platform, output: 0 });
        profiles = saved.profiles;
        platformApis[platform] = saved.id;
        credentials.profiles[saved.id] = `${platform}-key`;
    }
    const restored = cleanCredentials(JSON.parse(JSON.stringify(credentials)));
    const settings = phoneSettings({ apiProfiles: profiles, platformApis, base: 'https://default.example.test/v1', outputLimitVersion: 1 });
    for (const platform of Object.keys(platformApis)) {
        const connection = generationConnection(settings, restored, platform);
        assert.equal(connection.token, `${platform}-key`);
        assert.equal(connection.settings.model, platform);
        assert.equal(connection.settings.base, `https://${platform}.example.test/v1`);
    }
    assert.equal(generationConnection(settings, restored, '').token, 'default-key');
    assert.equal(generationConnection(settings, cleanCredentials(), 'redbook').token, '');
    assert.doesNotMatch(JSON.stringify(settings), /default-key|redbook-key|douyin-key|weibo-key|forum-key/);
    const deleted = phoneSettings({ ...settings, apiProfiles: profiles.slice(1) });
    assert.equal(deleted.platformApis.redbook, '');
    assert.equal(generationConnection(deleted, restored, 'redbook').token, 'default-key');
});
