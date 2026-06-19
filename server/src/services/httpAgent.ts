import http from 'http';
import https from 'https';
import { lookup as dnsLookup } from 'dns';

/**
 * 全局 HTTP 连接复用池 & DNS 缓存
 * - keepAlive 开启长连接，减少 TCP 握手
 * - DNS 结果本地缓存，避免每次查询
 * 由 webBookService 统一使用，搜索性能提升显著
 */

interface DnsEntry {
  address: string;
  family: number;
  expireAt: number;
}

// 简单的 LRU+TTL DNS 缓存（最多 500 条，TTL 2 分钟），不依赖外部包
class DnsCache {
  private map = new Map<string, DnsEntry>();
  private readonly maxSize = 500;
  private readonly ttlMs = 120 * 1000;

  get(hostname: string): DnsEntry | undefined {
    const entry = this.map.get(hostname);
    if (!entry) return undefined;
    if (entry.expireAt < Date.now()) {
      this.map.delete(hostname);
      return undefined;
    }
    // 命中：提升"热度"（移到末尾）
    this.map.delete(hostname);
    this.map.set(hostname, entry);
    return entry;
  }

  set(hostname: string, address: string, family: number): void {
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
function cachedLookup(
  hostname: string,
  options: any,
  callback: (err: NodeJS.ErrnoException | null, address: string, family: number) => void
): void {
  const cached = dnsCache.get(hostname);
  if (cached) {
    callback(null, cached.address, cached.family);
    return;
  }
  dnsLookup(hostname, options, (err, address, family) => {
    if (!err && address) {
      dnsCache.set(hostname, address, family);
    }
    callback(err, address, family);
  });
}

// http / https 各自独立的连接池
const httpAgent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: 10000,
  maxSockets: 64,
  maxFreeSockets: 16,
  // @ts-ignore - dns lookup 函数签名与 node 内置一致
  lookup: cachedLookup,
});

const httpsAgent = new https.Agent({
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
export function getAgentForUrl(url: string): http.Agent | https.Agent {
  return url.startsWith('https:') ? httpsAgent : httpAgent;
}

/** 暴露给外部（如 webBookService）使用 */
export const sharedHttpAgent = httpAgent;
export const sharedHttpsAgent = httpsAgent;
