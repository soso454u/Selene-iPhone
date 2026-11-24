const { PLAYER, active, threadKey, socialNickname } = require('./domain.cjs');

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

function conversationThreads(session, rows, settings) {
    const { people, groups, prefs } = session;
    // An explicitly known contact is usable before their first message exists.
    const contacts = people.filter(person => person.id !== PLAYER && !contactDeleted(person, prefs)).map(person => ({ id: threadKey([PLAYER, person.id]), members: [PLAYER, person.id], name: socialNickname(person, settings), avatar: person.avatar, source: person.source || '手动联系人' }));
    const threads = new Map([...contacts, ...groups].filter(thread => !prefs.deletedThreads?.[thread.id] && !privateThreadDeleted(thread.members, people, prefs) && thread.members.includes(PLAYER)).map(thread => [thread.id, { ...thread }]));
    for (const row of rows) {
        if (!['message', 'call'].includes(row.kind) || !row.participants.includes(PLAYER) || !row.audience.includes(PLAYER) || conversationDeleted(row, prefs) || privateThreadDeleted(row.participants, people, prefs)) continue;
        if (!threads.has(row.thread)) threads.set(row.thread, { id: row.thread, name: row.names.filter(name => name !== session.context.name1).join('、') || row.speaker, members: row.participants, source: '正文同步' });
        const thread = threads.get(row.thread);
        thread.muted = prefs.muted?.includes(thread.id) === true;
        if (!thread.latest || row.stamp > thread.latest.stamp) thread.latest = row;
        thread.unread = (thread.unread || 0) + Number(!thread.muted && row.speakerId !== PLAYER && !(prefs.seen?.[thread.id] >= row.stamp));
    }
    return [...threads.values()].sort((left, right) => Number(!!prefs.pins?.includes(right.id)) - Number(!!prefs.pins?.includes(left.id)) || (right.latest?.stamp || 0) - (left.latest?.stamp || 0));
}

function characterConversation(people, prefs, ownerId, peerId) {
    const owner = people.find(person => person.id === ownerId && person.id !== PLAYER);
    const peer = people.find(person => person.id === peerId && person.id !== PLAYER);
    if (!owner || !peer || owner.id === peer.id || contactDeleted(owner, prefs) || contactDeleted(peer, prefs)) throw new Error('请选择两位不同的有效角色；角色私聊不能代替玩家发言。');
    return { owner, peer, thread: { id: threadKey([owner.id, peer.id]), members: [owner.id, peer.id], viewer: owner.id, name: peer.name } };
}

module.exports = { contactDeleted, conversationDeleted, conversationGroups, privateThreadDeleted, conversationThreads, characterConversation };
