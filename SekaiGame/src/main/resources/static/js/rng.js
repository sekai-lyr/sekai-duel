/**
 * rng.js - 可注入的随机数工具
 */

export class RandomSource {
    next() { return Math.random(); }
    integer(min, max) { return Math.floor(this.next() * (max - min + 1)) + min; }
    pick(items) { return items.length > 0 ? items[this.integer(0, items.length - 1)] : null; }
    weightedPick(entries) {
        let total = entries.reduce((s, e) => s + (e.weight || 1), 0);
        let roll = this.next() * total;
        for (const e of entries) { roll -= (e.weight || 1); if (roll <= 0) return e.value; }
        return entries[entries.length - 1].value;
    }
    shuffle(items) {
        const a = [...items];
        for (let i = a.length - 1; i > 0; i--) {
            const j = this.integer(0, i);
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }
}

/**
 * 种子随机数生成器 (xoshiro128**)
 * PvP 模式下两端使用相同种子确保随机结果一致
 */
export class SeededRandom extends RandomSource {
    constructor(seed) {
        super();
        // 将种子转为4个32位状态
        this._s = new Uint32Array(this._hashSeed(seed || Date.now()));
    }

    _hashSeed(seed) {
        const str = String(seed);
        // FNV-1a hash
        let h = 0x811c9dc5;
        for (let i = 0; i < str.length; i++) {
            h ^= str.charCodeAt(i);
            h = Math.imul(h, 0x01000193);
        }
        // 用 hash 派生4个状态
        const s = [h, h ^ 0xdeadbeef, Math.imul(h, 0x9e3779b9), Math.imul(h, 0x85ebca6b)];
        // 跑 12 轮 warmup
        this._s = new Uint32Array(s);
        for (let i = 0; i < 12; i++) this._nextUint32();
        return Array.from(this._s);
    }

    _rotl(x, k) { return (x << k) | (x >>> (32 - k)); }

    _nextUint32() {
        const s = this._s;
        const result = Math.imul(this._rotl(Math.imul(s[1], 5), 7), 9);
        const t = s[1] << 9;
        s[2] ^= s[0]; s[3] ^= s[1]; s[1] ^= s[2]; s[0] ^= s[3];
        s[2] ^= t; s[3] = this._rotl(s[3], 11);
        return result >>> 0;
    }

    next() { return this._nextUint32() / 0x100000000; }
}

export class SequenceRandom extends RandomSource {
    constructor(seq) { super(); this.seq = [...seq]; this.idx = 0; }
    next() { const v = this.seq[this.idx % this.seq.length]; this.idx++; return v; }
}

export const rng = new RandomSource();
