const { PLAYER, active } = require('./domain.cjs');

const contactDeleted = (person, prefs = {}) => !!prefs.deletedContacts?.[person.id] || Object.values(prefs.deletedContacts || {}).includes(person.name);
function conversationDeleted(row, prefs = {}) {
    if (!['message', 'call'].includes(row.kind)) return false;
    return !!prefs.deletedThreads?.[row.thread] || row.participants?.length === 2 && row.participants.includes(PLAYER)
        && (row.participants.some(id => !!prefs.deletedContacts?.[id]) || row.names?.some(name => Object.values(prefs.deletedContacts || {}).includes(name)));
}

function conversationGroups(manual, rows, trail) {
    const groups = new Map(manual.filter(group => !group.anchor || active(group, trail)).map(group => [group.id, group]));
    for (const row of rows) {
        if (!active(row, trail) || row.echoOf || !['message', 'call'].includes(row.kind) || row.participants.length < 3) continue;
        const known = groups.get(row.thread);
        if (known) continue;
        const info = row.payload?.group;
        groups.set(row.thread, { id: row.thread, name: info?.name || '群聊', members: row.participants, source: '正文群聊', anchor: row.anchor });
    }
    return [...groups.values()];
}

function privateThreadDeleted(members, people, prefs) {
    return members.length === 2 && members.includes(PLAYER) && members.some(id => {
        const person = people.find(person => person.id === id);
        return person && contactDeleted(person, prefs);
    });
}

module.exports = { contactDeleted, conversationDeleted, conversationGroups, privateThreadDeleted };
