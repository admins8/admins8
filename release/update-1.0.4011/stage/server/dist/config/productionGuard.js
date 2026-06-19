"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateProductionConfig = validateProductionConfig;
exports.validateNativeModuleState = validateNativeModuleState;
exports.assertProductionReady = assertProductionReady;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const DEFAULT_JWT_SECRETS = new Set([
    '',
    'legado-web-secret-key',
    'legado-web-secret-key-change-in-production',
    'CHANGE_ME_IN_PRODUCTION',
]);
const DEFAULT_ADMIN_PASSWORDS = new Set([
    '',
    'admin123',
    'CHANGE_ME',
    'CHANGE_ME_IN_PRODUCTION',
]);
function validateProductionConfig(input) {
    const errors = [];
    const warnings = [];
    const isProduction = input.nodeEnv === 'production';
    const jwtSecret = String(input.jwtSecret || '').trim();
    const adminPassword = String(input.adminPassword || '').trim();
    if (DEFAULT_JWT_SECRETS.has(jwtSecret)) {
        const message = 'JWT_SECRET 使用了空值或默认示例值';
        isProduction ? errors.push(message) : warnings.push(message);
    }
    if (jwtSecret.length < 24) {
        const message = 'JWT_SECRET 长度不足，生产环境建议至少 24 个字符';
        isProduction ? errors.push(message) : warnings.push(message);
    }
    if (DEFAULT_ADMIN_PASSWORDS.has(adminPassword)) {
        const message = 'ADMIN_PASSWORD 使用了空值或默认示例值';
        isProduction ? errors.push(message) : warnings.push(message);
    }
    if (adminPassword.length < 10) {
        const message = 'ADMIN_PASSWORD 长度不足，生产环境建议至少 10 个字符';
        isProduction ? errors.push(message) : warnings.push(message);
    }
    if (isProduction && !fs_1.default.existsSync(input.licensePath)) {
        errors.push(`生产环境缺少 license 文件: ${input.licensePath}`);
    }
    if (isProduction && !input.redisEnabled) {
        errors.push('生产环境必须启用 Redis，避免多实例限流和搜索缓存状态不一致');
    }
    return { ok: errors.length === 0, errors, warnings };
}
function validateNativeModuleState(input) {
    if (input.isolatedVmAvailable) {
        return { ok: true, errors: [], warnings: [] };
    }
    const message = 'isolated-vm 当前不可用；如切换过 Node 版本，请在 server 目录执行 npm rebuild isolated-vm';
    if (input.sourceJsEnabled) {
        return { ok: false, errors: [message], warnings: [] };
    }
    return { ok: true, errors: [], warnings: [message] };
}
function isIsolatedVmAvailable() {
    try {
        require('isolated-vm');
        return true;
    }
    catch {
        return false;
    }
}
function assertProductionReady(config) {
    const result = validateProductionConfig({
        nodeEnv: process.env.NODE_ENV || 'development',
        jwtSecret: config.jwtSecret,
        adminPassword: config.adminPassword,
        licensePath: config.licensePath || path_1.default.resolve(process.cwd(), 'license/license.lic'),
        sourceJsEnabled: config.sourceJsEnabled,
        redisEnabled: config.redisEnabled,
    });
    for (const warning of result.warnings) {
        console.warn(`[SECURITY] ${warning}`);
    }
    if (!result.ok) {
        throw new Error(`生产配置校验失败:\n${result.errors.map(e => `- ${e}`).join('\n')}`);
    }
    const nativeResult = validateNativeModuleState({
        sourceJsEnabled: config.sourceJsEnabled,
        isolatedVmAvailable: isIsolatedVmAvailable(),
    });
    for (const warning of nativeResult.warnings) {
        console.warn(`[Native] ${warning}`);
    }
    if (!nativeResult.ok) {
        throw new Error(`原生模块校验失败:\n${nativeResult.errors.map(e => `- ${e}`).join('\n')}`);
    }
}
//# sourceMappingURL=productionGuard.js.map