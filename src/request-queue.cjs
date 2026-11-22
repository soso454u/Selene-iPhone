// Serialize paid requests. Each task keeps its own destination and validity check.
class RequestQueue {
    constructor(onChange = () => {}) { this.onChange = onChange; this.pending = []; this.keys = new Map(); this.active = null; this.closed = false; }
    get busy() { return !!this.active || this.pending.length > 0; }
    enqueue(run, { valid = () => true, key } = {}) {
        if (this.closed) return Promise.reject(this.cancelled('请求队列已关闭'));
        if (key && this.keys.has(key)) return this.keys.get(key);
        let resolve, reject;
        const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
        const task = { run, valid, key, resolve, reject };
        if (key) this.keys.set(key, promise);
        this.pending.push(task); this.onChange(this.pending.length); this.drain();
        return promise;
    }
    cancelled(message) { return Object.assign(new Error(message), { queueCancelled: true }); }
    clear(message = '已清空待执行请求') {
        for (const task of this.pending.splice(0)) { if (task.key) this.keys.delete(task.key); task.reject(this.cancelled(message)); }
        this.onChange(0);
    }
    close() { this.closed = true; this.clear('请求队列已关闭'); }
    async drain() {
        if (this.active || this.closed) return;
        while (!this.closed && this.pending.length) {
            const task = this.pending.shift(); this.active = task; this.onChange(this.pending.length);
            try {
                if (!task.valid()) throw this.cancelled('聊天或正文已变化，已撤销待执行请求');
                task.resolve(await task.run());
            } catch (error) { task.reject(error); }
            finally { if (task.key) this.keys.delete(task.key); this.active = null; this.onChange(this.pending.length); }
        }
    }
}
module.exports = { RequestQueue };
