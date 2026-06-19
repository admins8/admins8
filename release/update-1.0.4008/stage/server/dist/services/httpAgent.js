"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sharedHttpsAgent = exports.sharedHttpAgent = void 0;
exports.getAgentForUrl = getAgentForUrl;
const http_1 = __importDefault(require("http"));
const https_1 = __importDefault(require("https"));
const dns_1 = require("dns");
// 简单的 LRU+TTL DNS 缓存（最多 500 条，TTL 2 分钟），不依赖外部包
class DnsCache {
    map = new Map();
    maxSize = 500;
    ttlMs = 120 * 1000;
    get(hostname) {
        const entry = this.map.get(hostname);
        if (!entry)
            return undefined;
        if (entry.expireAt < Date.now()) {
            this.map.delete(hostname);
            return undefined;
        }
        // 命中：提升"热度"（移到末尾）
        this.map.delete(hostname);
        this.map.set(hostname, entry);
        return entry;
    }
    set(hostname, address, family) {
        if (this.map.size >= this.maxSize) {
            // 删除最旧的（Map 按插入顺序，第一个即最久未使用）
            const first = this.map.keys().next();
            if (!first.done) {
                this.map.delete(first.value);
            }
        }
        this.map.set(hostname, { address, family, expireAt: Date.now() + this.ttlMs });
    }
}
const dnsCache = new DnsCache();
/** 带 DNS 缓存的 lookup 函数，传给 http.Agent 使用 */
function cachedLookup(hostname, options, callback) {
    const cached = dnsCache.get(hostname);
    if (cached) {
        callback(null, cached.address, cached.family);
        return;
    }
    (0, dns_1.lookup)(hostname, options, (err, address, family) => {
        if (!err && address) {
            dnsCache.set(hostname, address, family);
        }
        callback(err, address, family);
    });
}
// http / https 各自独立的连接池
const httpAgent = new http_1.default.Agent({
    keepAlive: true,
    keepAliveMsecs: 10000,
    maxSockets: 64,
    maxFreeSockets: 16,
    // @ts-ignore - dns lookup 函数签名与 node 内置一致
    lookup: cachedLookup,
});
const httpsAgent = new https_1.default.Agent({
    keepAlive: true,
    keepAliveMsecs: 10000,
    maxSockets: 64,
    maxFreeSockets: 16,
    // 小说站常见证书链不完整；书源抓取场景允许跳过证书链校验，避免整源验证失败。
    rejectUnauthorized: false,
    // @ts-ignore
    lookup: cachedLookup,
});
/** 根据请求 URL 协议返回对应 agent */
function getAgentForUrl(url) {
    return url.startsWith('https:') ? httpsAgent : httpAgent;
}
/** 暴露给外部（如 webBookService）使用 */
exports.sharedHttpAgent = httpAgent;
exports.sharedHttpsAgent = httpsAgent;
//# sourceMappingURL=httpAgent.js.map