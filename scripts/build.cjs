const { mkdirSync, readFileSync, writeFileSync, renameSync } = require('node:fs');
const { createHash } = require('node:crypto');
const { join } = require('node:path');

const root = join(__dirname, '..');
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const modules = ['domain', 'event-merge', 'conversations', 'request-queue', 'storage', 'portable', 'story-sources', 'story-time', 'chat-time', 'sync', 'image-rules', 'phone-preset', 'host', 'api-profiles', 'wallpapers', 'backgrounds', 'character-phone', 'context', 'api', 'resources', 'media', 'cloud', 'card-style', 'photos', 'image-service', 'music-island', 'music-app', 'ui', 'main'];
const definitions = modules.map(name => `${JSON.stringify(`./${name}.cjs`)}: function(module,exports,require){\n${readFileSync(join(root, 'src', `${name}.cjs`), 'utf8')}\n}`);
definitions.push(`"./bundled.cjs":function(module){module.exports=${JSON.stringify({ worldbook: JSON.parse(readFileSync(join(root, 'iMessage世界书.json'), 'utf8')), regexes: JSON.parse(readFileSync(join(root, 'regex-imessage-native.json'), 'utf8')), socialRegexes: JSON.parse(readFileSync(join(root, 'regex-social-story-weibo.json'), 'utf8')) })}}`);
definitions.push(`"./style.cjs":function(module){module.exports=${JSON.stringify(readFileSync(join(root, 'src', 'phone.css'), 'utf8'))}}`);
mkdirSync(join(root, 'dist'), { recursive: true });
const script = `;(function(){\n'use strict';\nconst modules={${definitions.join(',\n')}};\nconst cache=Object.create(null);\nfunction load(id){if(!cache[id]){const module=cache[id]={exports:{}};modules[id](module,module.exports,load);}return cache[id].exports;}\nload('./main.cjs').start(window);\n})();\n`;
const buildId = createHash('sha256').update(script).digest('hex').slice(0, 12);
const output = `// Selene build: ${buildId}\n${script}`;
// A side-effect-only bundle also runs as an ES module, so remote imports use
// exactly the same implementation and persistent storage as the pasted script.
const outputs = ['Selene手机.js', '外置小手机.js', 'index.js'].map(name => ({ path: join(root, 'dist', name), content: output }));
const remoteUrl = `https://gcore.jsdelivr.net/gh/soso454u/Selene-iPhone@v${version}/dist/index.js`;
outputs.push({ path: join(root, 'dist', 'import.js'), content: `// Selene手机 v${version} · 远程加载入口\n// 更新时只改下面 @ 后的版本号，保存后重新启用脚本或刷新酒馆。\nimport '${remoteUrl}';\n` });
for (const { path, content } of outputs) writeFileSync(`${path}.tmp`, content);
for (const { path } of outputs) renameSync(`${path}.tmp`, path);
for (const { path, content } of outputs) if (readFileSync(path, 'utf8') !== content) throw new Error(`成品写入校验失败：${path}`);
console.log(`Selene v${version} build ${buildId}: 三份同内容脚本与远程导入入口写入并回读校验通过。`);
