/**
 * Cookie 持久化存储
 * 按域名存储 Cookie，跨请求复用，支持登录态保持
 */

interface StoredCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number | null; // timestamp ms, null = session cookie
  secure: boolean;
  httpOnly: boolean;
}

class CookieStore {
  private store = new Map<string, Map<string, StoredCookie>>();

  /**
   * 从 HTTP 响应头中提取并保存 Set-Cookie
   */
  saveCookies(url: string, setCookieHeaders: string[]): void {
    if (!setCookieHeaders || setCookieHeaders.length === 0) return;

    const domain = this.extractDomain(url);
    if (!domain) return;

    let domainCookies = this.store.get(domain);
    if (!domainCookies) {
      domainCookies = new Map();
      this.store.set(domain, domainCookies);
    }

    for (const raw of setCookieHeaders) {
      try {
        const cookie = this.parseSetCookie(raw, domain);
        if (cookie) {
          domainCookies.set(cookie.name, cookie);
        }
      } catch {
        // 忽略格式错误的 Cookie
      }
    }

    // 清理过期 Cookie
    this.cleanExpired(domainCookies);
  }

  /**
   * 获取指定 URL 的 Cookie 字符串（用于请求头）
   */
  getCookieString(url: string): string {
    const domain = this.extractDomain(url);
    if (!domain) return '';

    let allCookies: StoredCookie[] = [];

    // 精确域名匹配
    const exactCookies = this.store.get(domain);
    if (exactCookies) {
      allCookies.push(...Array.from(exactCookies.values()));
    }

    // 父域名匹配（例如 sub.example.com 匹配 .example.com）
    const parts = domain.split('.');
    for (let i = 1; i < parts.length - 1; i++) {
      const parentDomain = parts.slice(i).join('.');
      const parentCookies = this.store.get(parentDomain);
      if (parentCookies) {
        allCookies.push(...Array.from(parentCookies.values()));
      }
    }

    // 过滤并拼接
    const now = Date.now();
    const valid = allCookies.filter(c => {
      if (c.expires && c.expires < now) return false;
      return true;
    });

    if (valid.length === 0) return '';
    return valid.map(c => `${c.name}=${c.value}`).join('; ');
  }

  /**
   * 清除指定域名的所有 Cookie
   */
  clearDomain(domain: string): void {
    this.store.delete(domain);
  }

  /**
   * 清除所有 Cookie
   */
  clearAll(): void {
    this.store.clear();
  }

  /**
   * 获取 Cookie 统计信息
   */
  getStats(): { domains: number; totalCookies: number } {
    let totalCookies = 0;
    for (const cookies of this.store.values()) {
      totalCookies += cookies.size;
    }
    return { domains: this.store.size, totalCookies };
  }

  // ============ 内部方法 ============

  private extractDomain(url: string): string {
    try {
      const hostname = new URL(url).hostname;
      return hostname.startsWith('www.') ? hostname.slice(4) : hostname;
    } catch {
      return '';
    }
  }

  private parseSetCookie(raw: string, defaultDomain: string): StoredCookie | null {
    const parts = raw.split(';').map(p => p.trim());
    const first = parts[0];
    const eqIdx = first.indexOf('=');
    if (eqIdx <= 0) return null;

    const name = first.substring(0, eqIdx).trim();
    const value = first.substring(eqIdx + 1).trim();

    let domain = defaultDomain;
    let path = '/';
    let expires: number | null = null;
    let secure = false;
    let httpOnly = false;

    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      const lower = part.toLowerCase();

      if (lower.startsWith('domain=')) {
        const d = part.substring(7).trim();
        if (d) domain = d.startsWith('.') ? d.slice(1) : d;
      } else if (lower.startsWith('path=')) {
        path = part.substring(5).trim() || '/';
      } else if (lower.startsWith('expires=')) {
        const parsed = Date.parse(part.substring(8).trim());
        if (!isNaN(parsed)) expires = parsed;
      } else if (lower.startsWith('max-age=')) {
        const maxAge = parseInt(part.substring(8).trim(), 10);
        if (!isNaN(maxAge)) expires = Date.now() + maxAge * 1000;
      } else if (lower === 'secure') {
        secure = true;
      } else if (lower === 'httponly') {
        httpOnly = true;
      }
    }

    return { name, value, domain, path, expires, secure, httpOnly };
  }

  private cleanExpired(cookies: Map<string, StoredCookie>): void {
    const now = Date.now();
    for (const [name, cookie] of cookies) {
      if (cookie.expires && cookie.expires < now) {
        cookies.delete(name);
      }
    }
  }
}

export const cookieStore = new CookieStore();