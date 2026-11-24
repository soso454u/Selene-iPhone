const DAY = 86400000;
const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
const clockOf = text => text.match(/(?<!\d)([01]?\d|2[0-3])[:：]([0-5]\d)(?::[0-5]\d)?(?!\d)/)?.slice(1).map(value => value.padStart(2, '0')).join(':') || '';
function calendar(text) {
    const full = text.match(/(\d{4})\s*(?:年|[-/.])\s*(\d{1,2})\s*(?:月|[-/.])\s*(\d{1,2})\s*日?/);
    const short = !full && text.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
    if (!full && !short) return null;
    const year = full ? Number(full[1]) : null, month = Number(full?.[2] || short[1]), day = Number(full?.[3] || short[2]);
    const value = Date.UTC(year || 2000, month - 1, day), check = new Date(value);
    return check.getUTCMonth() + 1 === month && check.getUTCDate() === day ? { year, month, day, value: year ? value : null } : null;
}
function dayOffset(text) {
    if (/^今天|^今日/.test(text)) return 0;
    if (/^昨天|^昨日/.test(text)) return -1;
    if (/^前天/.test(text)) return -2;
    if (/^半个月前/.test(text)) return -15;
    const match = text.match(/^([\d一二两三四五六七八九十]+)\s*(天|周|星期)前/);
    if (!match) return null;
    const digits = value => '零一二三四五六七八九'.indexOf(value.replace('两', '二'));
    const count = /^\d+$/.test(match[1]) ? Number(match[1]) : match[1].includes('十') ? ((match[1].split('十')[0] ? digits(match[1].split('十')[0]) : 1) * 10 + (match[1].split('十')[1] ? digits(match[1].split('十')[1]) : 0)) : digits(match[1]);
    return count > 0 && count <= 3650 ? -count * (match[2] === '天' ? 1 : 7) : null;
}
function stamp(raw, base, inherited) {
    raw = String(raw || '').trim();
    const clock = clockOf(raw);
    let date = calendar(raw);
    const offset = dayOffset(raw), anchor = calendar(String(base || ''));
    if (!date && offset !== null && anchor?.year) {
        const value = new Date(anchor.value + offset * DAY);
        date = { year: value.getUTCFullYear(), month: value.getUTCMonth() + 1, day: value.getUTCDate(), value: Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()) };
    }
    if (!date && clock && offset === null && /^\d{1,2}[:：]\d{2}(?::\d{2})?$/.test(raw)) date = inherited || null;
    const minute = date?.year && clock ? date.value / 60000 + Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3)) : null;
    return { raw, date, clock, minute };
}
function historicalTime(raw, base) {
    const value = stamp(raw, base);
    return dayOffset(String(raw || '').trim()) !== null && value.date?.year
        ? `${value.date.year}年${value.date.month}月${value.date.day}日${value.clock ? ` ${value.clock}` : ''}` : raw || '';
}
function label(value, current) {
    if (!value.date) return /^\d{1,2}[:：]\d{2}(?::\d{2})?$/.test(value.raw) ? value.clock : value.raw;
    const date = value.date, now = calendar(String(current || ''));
    let day = `${date.month}月${date.day}日`;
    if (date.year && now?.year) {
        const elapsed = Math.round((now.value - date.value) / DAY);
        if (elapsed === 0) day = value.clock ? '' : '今天';
        else if (elapsed === 1) day = '昨天';
        else if (date.year !== now.year) day = `${date.year}年${day}`;
        else if (elapsed >= 2 && elapsed < 7) day = weekdays[new Date(date.value).getUTCDay()];
    } else if (date.year) day = `${date.year}年${day}`;
    return [day, value.clock].filter(Boolean).join(' ');
}
function sourceDate(row, chat) {
    if (row.origin !== 'tavern' || !Number.isInteger(row.floor)) return null;
    const dates = [...String(chat?.[row.floor]?.mes || '').matchAll(/<date\b[^>]*>([^<]+)<\/date>/gi)].map(match => calendar(match[1])).filter(date => date?.year);
    return new Set(dates.map(date => date.value)).size === 1 ? dates[0] : null;
}
function chatTimeline(rows, current = '', chat = []) {
    let previous, inherited;
    return rows.map(row => {
        const value = stamp(row.rpTime, row.timeBase, sourceDate(row, chat) || inherited);
        if (value.date) inherited = value.date;
        const day = value.date ? `${value.date.year || ''}/${value.date.month}/${value.date.day}` : '';
        const key = `${day}:${value.clock || value.raw}`;
        const newDay = day !== previous?.day;
        const gap = value.minute !== null && previous?.minute !== null && previous?.minute !== undefined ? value.minute - previous.minute : null;
        const show = !!value.raw && (!previous || newDay || (gap !== null ? Math.abs(gap) >= 5 : key !== previous.key));
        if (value.raw) previous = { day, key, minute: value.minute };
        return { row, text: show ? label(value, current) : '', raw: value.raw };
    });
}

module.exports = { chatTimeline, historicalTime };
