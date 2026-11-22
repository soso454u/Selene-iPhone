const { regexes } = require('./bundled.cjs');

const STICKERS = Object.fromEntries([...regexes.map(entry => entry.replaceString).join('\n').matchAll(/\.im-sticker\[data-name="([^"]+)"\]\{background-image:url\("(https?:\/\/[^"\s]+)"\)/g)].map(match => [match[1], match[2]]));
const PLATFORMS = { moments: '朋友圈', redbook: '小红书', douyin: '抖音', weibo: '微博', forum: '论坛', x: 'X' };
const platformId = value => ['Twitter', '推特', 'twitter', 'X'].includes(value) ? 'x' : Object.keys(PLATFORMS).find(key => key === value || PLATFORMS[key] === value) || 'moments';
const xSideStory = row => row?.thread === 'x' && row.payload?.sideStory === true;
const xHandle = value => typeof value === 'string' && /^@[A-Za-z0-9_]{1,15}$/.test(value) ? value : '';
const safeUrl = value => { try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : ''; } catch { return ''; } };
function mediaData(body, attrs, entities) {
    const text = value => entities(String(value ?? '').replace(/<[^>]*>/g, '')).trim();
    const components = [...body.matchAll(/<(trans|reply|photo|video|voice|sticker|loc|red|pay|call|file|link|sys)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/\1>)/gi)].map(match => ({ type: match[1].toLowerCase(), fields: attrs(match[2]), text: text(match[3]) }));
    const caption = text(body.replace(/<(trans|reply|photo|video|voice|sticker|loc|red|pay|call|file|link|sys)\b[^>]*?(?:\/>|>[\s\S]*?<\/\1>)/gi, ''));
    return { components, caption, raw: body, text: text(body) };
}

function socialData(body, attrs, entities) {
    const strip = value => entities(String(value ?? '').replace(/<[^>]*>/g, '')).trim();
    const get = tag => strip(body.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'))?.[1]);
    return { title: get('s-title'), text: get('s-text'), tags: get('s-tags'), location: get('s-location'), avatar: safeUrl(attrs(body.match(/<s-avatar\b([^>]*)>/i)?.[1] || '').src), repost: get('s-repost'), repostName: attrs(body.match(/<s-repost\b([^>]*)>/i)?.[1] || '').name || '', commentCount: attrs(body.match(/<s-comments\b([^>]*)>/i)?.[1] || '').count,
        media: [...body.matchAll(/<(s-image|s-video)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/\1>)/gi)].map(match => ({ type: match[1], fields: { ...attrs(match[2]), src: safeUrl(attrs(match[2]).src) }, text: strip(match[3]) })),
        likes: get('s-likes'), counts: [...body.matchAll(/<s-count\b([^>]*)>([\s\S]*?)<\/s-count>/gi)].map(match => ({ ...attrs(match[1]), text: strip(match[2]) })).filter(count => ['点赞', '评论', '收藏', '分享', '转发'].includes(count.kind) && /^\d+(?:\.\d+)?(?:万|亿|[kKmM])?\+?$/.test(count.text)),
        comments: [...body.matchAll(/<s-comment\b([^>]*)>([\s\S]*?)<\/s-comment>/gi)].map(match => ({ ...attrs(match[1]), text: strip(match[2]) })), raw: body };
}

function reactions(rows, post, kind) {
    const latest = new Map();
    for (const row of [...rows].sort((a, b) => a.stamp - b.stamp)) {
        if (row.deleted || row.kind !== kind || (kind === 'follow' ? !row.participants?.includes(post.speakerId) : row.target !== post.id && (!post.reference || row.target !== post.reference))) continue;
        latest.set(row.speakerId, row);
    }
    return [...latest.values()].filter(row => row.payload?.reactionActive !== false);
}

function notificationRows(rows, prefs, player) {
    const cleared = Number(prefs?.notificationsClearedThrough) || 0;
    return rows.filter(row => row.speakerId !== player && row.stamp > cleared && !prefs?.muted?.includes(row.thread));
}

module.exports = { STICKERS, PLATFORMS, platformId, xSideStory, xHandle, safeUrl, mediaData, socialData, reactions, notificationRows };
