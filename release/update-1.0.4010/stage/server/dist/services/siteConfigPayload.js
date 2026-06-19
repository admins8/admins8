"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeSiteConfigPayloads = normalizeSiteConfigPayloads;
const BASE64_PREFIX = '__BASE64__:';
const BASE64_TRANSPORT_KEYS = new Set(['analytics_code']);
function decodeBase64TransportValue(value) {
    if (!value.startsWith(BASE64_PREFIX))
        return value;
    const encoded = value.slice(BASE64_PREFIX.length);
    return Buffer.from(encoded, 'base64').toString('utf8');
}
function normalizeSiteConfigPayloads(configs) {
    return (Array.isArray(configs) ? configs : []).map((item) => {
        const configKey = String(item?.config_key || '');
        const configValue = String(item?.config_value ?? '');
        return {
            config_key: configKey,
            config_value: BASE64_TRANSPORT_KEYS.has(configKey) ? decodeBase64TransportValue(configValue) : configValue,
        };
    });
}
//# sourceMappingURL=siteConfigPayload.js.map