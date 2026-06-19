"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_RANDOM_USER_AGENTS = void 0;
exports.parseUserAgentList = parseUserAgentList;
exports.pickRandomUserAgent = pickRandomUserAgent;
exports.parseProxyList = parseProxyList;
exports.normalizeProxyUrl = normalizeProxyUrl;
exports.pickRandomProxy = pickRandomProxy;
exports.buildSearchRequestOptions = buildSearchRequestOptions;
exports.parseProxyConfig = parseProxyConfig;
exports.testSearchProxyConnection = testSearchProxyConnection;
exports.testSearchProxyPool = testSearchProxyPool;
exports.parseLooseObjectLiteral = parseLooseObjectLiteral;
exports.buildHeaders = buildHeaders;
exports.buildRequestHeaders = buildRequestHeaders;
exports.buildRetryHeaderProfiles = buildRetryHeaderProfiles;
exports.parseSearchUrl = parseSearchUrl;
exports.resolveScriptSearchUrl = resolveScriptSearchUrl;
exports.httpRequest = httpRequest;
const axios_1 = __importDefault(require("axios"));
const httpAgent_1 = require("./httpAgent");
const { SocksProxyAgent } = require('socks-proxy-agent');
exports.DEFAULT_RANDOM_USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36',
];
function parseUserAgentList(value) {
    return String(value || '')
        .split(/\r?\n/)
        .map(item => item.trim())
        .filter(Boolean);
}
function pickRandomUserAgent(userAgents = []) {
    const list = userAgents.length > 0 ? userAgents : exports.DEFAULT_RANDOM_USER_AGENTS;
    return list[Math.floor(Math.random() * list.length)] || exports.DEFAULT_RANDOM_USER_AGENTS[0];
}
function parseProxyList(value) {
    return String(value || '')
        .split(/\r?\n/)
        .map(item => item.trim())
        .filter(Boolean);
}
function normalizeProxyUrl(proxy) {
    const raw = String(proxy || '').trim();
    if (!raw)
        return undefined;
    try {
        const parsed = new URL(raw.includes('://') ? raw : `http://${raw}`);
        const protocol = parsed.protocol.replace(':', '').toLowerCase();
        if (!['http', 'https', 'socks5'].includes(protocol))
            return undefined;
        if (!parsed.hostname)
            return undefined;
        if (!parsed.port && !['http', 'https'].includes(protocol))
            return undefined;
        return parsed.toString().replace(/\/$/, '');
    }
    catch {
        return undefined;
    }
}
function pickRandomProxy(proxies = []) {
    const normalized = proxies
        .map(item => normalizeProxyUrl(item))
        .filter(Boolean);
    if (normalized.length === 0)
        return undefined;
    return normalized[Math.floor(Math.random() * normalized.length)];
}
function buildSearchRequestOptions(settings) {
    const proxy = pickRandomProxy(parseProxyList(settings.searchRequestProxy || ''));
    return {
        simulatedUserAgents: parseUserAgentList(settings.searchRequestUserAgents),
        forceRandomUserAgent: true,
        targetAccessMode: 'snapshot-fallback',
        ...(proxy ? { proxy } : {}),
    };
}
function parseProxyConfig(proxy) {
    const raw = normalizeProxyUrl(proxy);
    if (!raw)
        return undefined;
    try {
        const parsed = new URL(raw);
        const protocol = parsed.protocol.replace(':', '') || 'http';
        if (!['http', 'https'].includes(protocol)) {
            return undefined;
        }
        const port = parsed.port ? Number(parsed.port) : (protocol === 'https' ? 443 : 80);
        const config = {
            protocol,
            host: parsed.hostname,
            port,
        };
        if (parsed.username || parsed.password) {
            config.auth = {
                username: decodeURIComponent(parsed.username),
                password: decodeURIComponent(parsed.password),
            };
        }
        return config;
    }
    catch {
        return undefined;
    }
}
function buildProxyAxiosConfig(proxy) {
    const normalized = normalizeProxyUrl(proxy);
    if (!normalized)
        return undefined;
    const protocol = normalized.split('://')[0].toLowerCase();
    if (protocol === 'socks5') {
        const agent = new SocksProxyAgent(normalized);
        return {
            proxy: false,
            httpAgent: agent,
            httpsAgent: agent,
        };
    }
    const proxyConfig = parseProxyConfig(normalized);
    return proxyConfig ? { proxy: proxyConfig } : undefined;
}
async function testSearchProxyConnection(input) {
    const proxy = String(input.proxy || '').trim();
    const targetUrls = input.targetUrl
        ? [String(input.targetUrl).trim()]
        : ['http://httpbin.org/anything', 'http://httpbingo.org/anything', 'http://postman-echo.com/get'];
    const targetUrl = targetUrls[0];
    if (!proxy) {
        return {
            ok: false,
            proxy,
            targetUrl,
            error: '请先填写代理地址',
        };
    }
    const proxyAxiosConfig = buildProxyAxiosConfig(proxy);
    if (!proxyAxiosConfig) {
        const protocol = proxy.includes('://') ? proxy.split('://')[0].toLowerCase() : 'http';
        return {
            ok: false,
            proxy,
            targetUrl,
            error: protocol.startsWith('socks') ? 'SOCKS5 代理格式无法解析' : '代理格式无法解析',
        };
    }
    const userAgent = pickRandomUserAgent(parseUserAgentList(input.userAgents));
    let lastResult;
    for (const currentTargetUrl of targetUrls) {
        const start = Date.now();
        try {
            const response = await axios_1.default.get(currentTargetUrl, {
                timeout: 8000,
                ...proxyAxiosConfig,
                headers: {
                    'User-Agent': userAgent,
                    Accept: 'application/json,text/plain,*/*',
                },
                validateStatus: () => true,
            });
            const data = response.data || {};
            const responseHeaders = data.headers || {};
            const outboundIp = String(data.origin || data.ip || responseHeaders['x-forwarded-for'] || responseHeaders['X-Forwarded-For'] || '').trim();
            const rawUserAgent = responseHeaders['User-Agent'] || responseHeaders['user-agent'] || responseHeaders['User-agent'] || '';
            const receivedUa = Array.isArray(rawUserAgent) ? rawUserAgent.join(', ') : String(rawUserAgent).trim();
            const ok = response.status >= 200 && response.status < 300;
            lastResult = {
                ok,
                proxy,
                targetUrl: currentTargetUrl,
                status: response.status,
                elapsedMs: Date.now() - start,
                outboundIp,
                userAgent: receivedUa || userAgent,
                ...(ok ? {} : { error: `目标返回 HTTP ${response.status}` }),
            };
            if (ok)
                return lastResult;
        }
        catch (err) {
            lastResult = {
                ok: false,
                proxy,
                targetUrl: currentTargetUrl,
                elapsedMs: Date.now() - start,
                userAgent,
                error: err?.code || err?.message || '代理检测失败',
                message: err?.message || String(err),
            };
        }
    }
    return lastResult || {
        ok: false,
        proxy,
        targetUrl,
        userAgent,
        error: '代理检测失败',
    };
}
async function testSearchProxyPool(input) {
    const proxies = parseProxyList(input.proxy || '');
    if (proxies.length === 0) {
        const result = await testSearchProxyConnection(input);
        return {
            ok: false,
            total: 0,
            available: 0,
            results: [result],
        };
    }
    const limit = 20;
    const results = [];
    for (const proxy of proxies.slice(0, limit)) {
        results.push(await testSearchProxyConnection({
            ...input,
            proxy,
        }));
    }
    const available = results.filter(item => item.ok).length;
    return {
        ok: available > 0,
        total: proxies.length,
        available,
        results,
    };
}
function parseLooseObjectLiteral(input) {
    try {
        return JSON.parse(input);
    }
    catch {
        try {
            return Function(`"use strict"; return (${input});`)();
        }
        catch {
            return {};
        }
    }
}
function buildHeaders(sourceHeader) {
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    };
    if (sourceHeader) {
        if (typeof sourceHeader === 'object') {
            Object.assign(headers, sourceHeader);
            return headers;
        }
        try {
            const customHeaders = JSON.parse(sourceHeader);
            Object.assign(headers, customHeaders);
        }
        catch {
            const looseHeaders = parseLooseObjectLiteral(sourceHeader);
            if (looseHeaders && typeof looseHeaders === 'object' && Object.keys(looseHeaders).length > 0) {
                Object.assign(headers, looseHeaders);
                return headers;
            }
            sourceHeader.split('\n').forEach(line => {
                const idx = line.indexOf(':');
                if (idx > 0) {
                    headers[line.substring(0, idx).trim()] = line.substring(idx + 1).trim();
                }
            });
        }
    }
    return headers;
}
function requestOrigin(url) {
    try {
        return new URL(url).origin;
    }
    catch {
        return '';
    }
}
function requestBaseUrl(url) {
    const origin = requestOrigin(url);
    return origin ? `${origin}/` : '';
}
function replaceHeaderPlaceholders(value, url) {
    return value
        .replace(/\{\{baseUrl\}\}/g, requestBaseUrl(url))
        .replace(/\{\{origin\}\}/g, requestOrigin(url));
}
function buildRequestHeaders(url, headers, optionHeaders = {}) {
    const merged = {
        Connection: 'keep-alive',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.7',
        ...headers,
        ...optionHeaders,
    };
    if (!merged.Referer && requestBaseUrl(url)) {
        merged.Referer = requestBaseUrl(url);
    }
    for (const [key, value] of Object.entries(merged)) {
        if (typeof value === 'string') {
            merged[key] = replaceHeaderPlaceholders(value, url);
        }
    }
    return merged;
}
function withoutRetryOverriddenHeaders(headers) {
    const result = { ...headers };
    delete result['User-Agent'];
    delete result['user-agent'];
    delete result.Accept;
    delete result.accept;
    delete result.Referer;
    delete result.referer;
    delete result.Origin;
    delete result.origin;
    return result;
}
function buildSimpleCollectorHeaders(preserved) {
    return {
        ...preserved,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        Connection: 'keep-alive',
        DNT: '1',
    };
}
function buildRetryHeaderProfiles(url, headers, optionHeaders = {}) {
    const preserved = withoutRetryOverriddenHeaders({ ...headers, ...optionHeaders });
    const origin = requestOrigin(url);
    const referer = requestBaseUrl(url);
    return [
        { name: '书源请求头', headers: buildRequestHeaders(url, headers, optionHeaders) },
        {
            name: '简洁采集请求头',
            headers: buildSimpleCollectorHeaders(preserved),
        },
        {
            name: '桌面浏览器',
            headers: buildRequestHeaders(url, {
                ...preserved,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                Referer: referer,
                Origin: origin,
            }),
        },
        {
            name: '移动浏览器',
            headers: buildRequestHeaders(url, {
                ...preserved,
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
                Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                Referer: referer,
                Origin: origin,
            }),
        },
        {
            name: 'App okhttp',
            headers: buildRequestHeaders(url, {
                ...preserved,
                'User-Agent': 'okhttp/4.9.2',
                Accept: '*/*',
                Referer: referer,
                Origin: origin,
            }),
        },
    ];
}
function applyRuntimeRequestOptions(headers, option) {
    const runtimeHeaders = { ...headers };
    if (option.forceRandomUserAgent || option.simulatedUserAgents) {
        runtimeHeaders['User-Agent'] = pickRandomUserAgent(option.simulatedUserAgents || []);
    }
    return runtimeHeaders;
}
function shouldRetryWithNextHeader(error) {
    const status = Number(error?.response?.status || 0);
    const code = String(error?.code || '');
    return ['ECONNABORTED', 'ETIMEDOUT', 'ECONNRESET', 'EAI_AGAIN'].includes(code)
        || [403, 408, 429, 500, 502, 503, 504].includes(status);
}
function parseSearchUrl(raw) {
    if (!raw)
        return { url: '', option: {} };
    const match = raw.match(/,\s*(\{[\s\S]*)$/);
    if (match) {
        const url = raw.substring(0, raw.length - match[0].length);
        const option = parseLooseObjectLiteral(match[1]);
        return { url, option };
    }
    return { url: raw, option: {} };
}
function resolveScriptSearchUrl(rawSearchUrl, baseUrl) {
    const raw = rawSearchUrl.trim();
    if (!raw.startsWith('@js:') && !raw.startsWith('<js>'))
        return rawSearchUrl;
    const code = raw.replace(/^@js:\s*/, '').replace(/^<js>/, '').replace(/<\/js>$/s, '');
    const base = String(baseUrl || '').replace(/\/$/, '');
    const baseConcat = code.match(/baseUrl\s*\+\s*["']([^"']+)["']/);
    if (baseConcat && base)
        return `${base}${baseConcat[1]}`;
    const urlAssignment = code.match(/url\s*=\s*["']([^"']+)["']/);
    if (urlAssignment)
        return urlAssignment[1];
    const directUrl = code.match(/https?:\/\/[^"',;\s]+(?:,\{[\s\S]+?\})?/);
    if (directUrl)
        return directUrl[0];
    const directPath = code.match(/(?:^|[=;]\s*)["']?(\/[^"',;\s]+(?:,\{[\s\S]+?\})?)/);
    if (directPath)
        return directPath[1];
    return '';
}
async function httpRequest(url, headers, option = {}) {
    const method = (option.method || 'GET').toUpperCase();
    const charset = option.charset || '';
    const runtimeHeaders = applyRuntimeRequestOptions(headers, option);
    const profiles = option.forceRandomUserAgent
        ? [{ name: '模拟 UA', headers: buildRequestHeaders(url, runtimeHeaders, option.headers || {}) }]
        : buildRetryHeaderProfiles(url, runtimeHeaders, option.headers || {});
    const requestProfiles = option.retry === 0 ? profiles.slice(0, 1) : profiles;
    const proxyAxiosConfig = buildProxyAxiosConfig(option.proxy || '');
    let lastError;
    for (const profile of requestProfiles) {
        const axiosConfig = {
            url,
            method: method,
            headers: profile.headers,
            timeout: option.timeoutMs || 10000,
            responseType: 'arraybuffer',
        };
        if (proxyAxiosConfig) {
            Object.assign(axiosConfig, proxyAxiosConfig);
        }
        else {
            axiosConfig.httpAgent = (0, httpAgent_1.getAgentForUrl)(url);
            axiosConfig.httpsAgent = (0, httpAgent_1.getAgentForUrl)(url);
        }
        if (method === 'POST' && option.body) {
            axiosConfig.data = option.body;
            if (!axiosConfig.headers['Content-Type']) {
                axiosConfig.headers['Content-Type'] = 'application/x-www-form-urlencoded';
            }
        }
        try {
            const response = await (0, axios_1.default)(axiosConfig);
            const buffer = Buffer.from(response.data);
            if (charset && charset.toLowerCase() !== 'utf-8' && charset.toLowerCase() !== 'utf8') {
                try {
                    const iconv = await Promise.resolve().then(() => __importStar(require('iconv-lite')));
                    return iconv.decode(buffer, charset);
                }
                catch {
                    return buffer.toString('utf-8');
                }
            }
            return buffer.toString('utf-8');
        }
        catch (error) {
            lastError = error;
            if (!shouldRetryWithNextHeader(error)) {
                throw error;
            }
        }
    }
    throw lastError;
}
//# sourceMappingURL=bookSourceHttpClient.js.map