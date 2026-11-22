const { dialogue } = require('./domain.cjs');

const number = text => {
    if (/^\d+$/.test(text)) return Number(text);
    const digit = value => '零一二三四五六七八九'.indexOf(value.replace('〇', '零').replace('两', '二'));
    if (!text.includes('十')) return digit(text);
    const [tens, units] = text.split('十');
    return (tens ? digit(tens) : 1) * 10 + (units ? digit(units) : 0);
};

function readTime(text) {
    const match = text.match(/(?<!\d)(?:(凌晨|清晨|早上|早晨|上午|中午|下午|傍晚|晚上|夜晚|午夜)\s*)?(\d{1,2})[:：]([0-5]\d)(?::[0-5]\d)?\s*(AM|PM)?(?![\d:：])/i)
        || text.match(/(凌晨|清晨|早上|早晨|上午|中午|下午|傍晚|晚上|夜晚|午夜)?\s*([零〇一二两三四五六七八九十\d]{1,3})[点时](?:(?<half>半)|(?<quarter>一刻|三刻)|(?<minute>[零〇一二两三四五六七八九十\d]{1,3})分?)?/);
    if (!match) return '';
    let hour = number(match[2]);
    const minute = match.groups?.half ? 30 : match.groups?.quarter === '一刻' ? 15 : match.groups?.quarter === '三刻' ? 45 : number(match.groups?.minute || match[3] || '0');
    const period = (match[1] || match[4] || '').toLowerCase();
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return '';
    if (/下午|傍晚|晚上|夜晚|pm/.test(period) && hour < 12) hour += 12;
    if (/凌晨|午夜|am/.test(period) && hour === 12) hour = 0;
    if (period === '中午' && hour < 11) hour += 12;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function readDate(text) {
    const match = text.match(/(?<!\d)(?:(\d{4})\s*(?:年|[-/.])\s*(\d{1,2})\s*(?:月|[-/.])\s*(\d{1,2})\s*日?|(\d{1,2})\s*月\s*(\d{1,2})\s*日)(?!\d)/);
    if (!match) return '';
    const year = match[1], month = match[2] || match[4], day = match[3] || match[5];
    const leap = year ? Number(year) % 4 === 0 && (Number(year) % 100 !== 0 || Number(year) % 400 === 0) : true;
    const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (Number(month) < 1 || Number(month) > 12 || Number(day) < 1 || Number(day) > days[Number(month) - 1]) return '';
    return `${year ? `${year}年` : ''}${Number(month)}月${Number(day)}日`;
}

function messageTime(source, settings) {
    const excluded = ['think', 'thinking', 'analysis', 'script', 'style', 'pre', 'code', 'phone_events', 'phone_event', 'phone_log', '线上消息', '社交动态', settings.eventTag, settings.jsonTag].filter(Boolean);
    let text = String(source || '').replace(/```[^]*?(?:```|$)/g, '\n');
    for (const tag of new Set(excluded)) {
        const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        text = text.replace(new RegExp(`<${escaped}(?=[\\s>])[^>]*>[^]*?(?:<\\/${escaped}\\s*>|$)`, 'gi'), '\n');
    }
    text = text.replace(/<(?:rp_time|story_time|datetime|time|时间)(?=[\s>])[^>]*>/gi, '\n时间：')
        .replace(/<[^>]*>/g, '\n').replace(/https?:\/\/\S+/g, '').replace(/&nbsp;/gi, ' ').replace(/[“「『][^]*?[”」』]/g, '').replace(/[*_`~]/g, '');
    const candidates = [];
    for (const line of text.split(/[\n。！？!?；;]/)) {
        if (/^\s*>/.test(line) || /昨天|昨日|昨晚|明天|明日|回忆|回想|曾经|当年|约定|计划|预约|将于|定于|预计|过去|以前|之前|如果|假如|比如|例如/.test(line)) continue;
        const date = readDate(line), time = readTime(line);
        if (!date && !time) continue;
        const labelled = /(?:当前|剧情|故事|RP)?\s*(?:日期|时间|时刻)\s*[:：|｜】\]]|(?:date|time)\s*[:：]/i.test(line);
        // Require a time field, a date, or an explicit present-time cue. Bare
        // numbers in dialogue, URLs, schedules and media metadata are not clocks.
        if (!labelled && !date && !/现在|此刻|此时|已是|已经|时钟|钟表|手表|钟面|显示.{0,6}(?:时间|\d{1,2}[:：])/.test(line)
            && !/^\s*[*#【\[（(\s]*(?:凌晨|清晨|早上|早晨|上午|中午|下午|傍晚|晚上|夜晚|午夜|\d{1,2}[:：])/.test(line)) continue;
        candidates.push({ date, time, labelled });
    }
    const fields = candidates.filter(item => item.labelled);
    if (!candidates.length) return null;
    return { date: fields.findLast(item => item.date)?.date || candidates.findLast(item => item.date)?.date || '',
        time: fields.findLast(item => item.time)?.time || candidates.findLast(item => item.time)?.time || '' };
}

function storyTime(chat, settings = {}) {
    for (let floor = (chat?.length || 0) - 1; floor >= 0; floor--) {
        const row = chat[floor];
        if (!dialogue(row) || row.is_user) continue;
        const found = messageTime(row.mes, settings);
        if (!found) continue;
        return [found.date, found.time].filter(Boolean).join(' ');
    }
    return '';
}

function resolveRpTime(chat, settings = {}) {
    return (settings.rpTimeAuto !== false && storyTime(chat, settings)) || settings.rpTime || '';
}

module.exports = { storyTime, resolveRpTime };
