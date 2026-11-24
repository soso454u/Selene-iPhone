const { digest } = require('./domain.cjs');
const { fingerprint } = require('./resources.cjs');

// Storage defaults and locally derived participation/order are not message edits.
function eventContent(row, ignoreSync = false) {
    const value = {};
    for (const key of ['origin', 'kind', 'thread', 'speakerId', 'speaker', 'text', 'rpTime', 'quote', 'target', 'parser', 'memory', 'reference', 'bubbleGroup', 'suggestedMemory']) value[key] = row[key] || '';
    for (const key of ['participants', 'audience', 'names', 'audienceNames', 'editHistory']) value[key] = row[key] || [];
    value.anchor = row.anchor || null;
    value.floor = row.floor ?? -1;
    value.payload = row.payload || null;
    value.deleted = row.deleted === true;
    if (!ignoreSync) value.sync = row.sync !== false;
    return fingerprint(value);
}

function collapseEventConflicts(rows) {
    const byId = new Map(rows.map(row => [row.id, row]));
    return rows.map(row => {
        const original = row.conflictOf && byId.get(row.conflictOf);
        return original && original.id !== row.id && eventContent(original, true) === eventContent(row, true)
            ? { ...row, echoOf: original.id, sync: false } : row;
    });
}

function mergeEvents(local, remote) {
    const merged = new Map(remote.map(row => [row.id, row]));
    for (const row of local) {
        const previous = merged.get(row.id);
        const revision = row.revision ?? 1, oldRevision = previous?.revision ?? 1;
        if (!previous || revision > oldRevision || revision === oldRevision && row.deleted && !previous.deleted) merged.set(row.id, row);
        else if (revision === oldRevision && eventContent(row) === eventContent(previous)) merged.set(row.id, row);
        else if (revision === oldRevision) {
            const id = `conflict:${digest(JSON.stringify([row.id, eventContent(row)]))}`;
            merged.set(id, { ...row, id, sync: false, conflictOf: row.id });
        }
    }
    return collapseEventConflicts([...merged.values()]);
}

module.exports = { eventContent, collapseEventConflicts, mergeEvents };
