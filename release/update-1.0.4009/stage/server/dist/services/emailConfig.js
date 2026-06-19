"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EMAIL_CONFIG_KEYS = void 0;
exports.parseBool = parseBool;
exports.parsePort = parsePort;
exports.buildEmailConfig = buildEmailConfig;
exports.maskEmailConfig = maskEmailConfig;
exports.isEmailConfigComplete = isEmailConfigComplete;
exports.formatSmtpError = formatSmtpError;
exports.EMAIL_CONFIG_KEYS = [
    'email_enabled',
    'email_from_name',
    'email_from_address',
    'smtp_host',
    'smtp_port',
    'smtp_secure',
    'smtp_username',
    'smtp_password',
    'pop3_host',
    'pop3_port',
    'pop3_secure',
    'imap_host',
    'imap_port',
    'imap_secure',
];
function parseBool(value) {
    return value === true || value === 'true' || value === '1' || value === 1;
}
function parsePort(value, fallback) {
    const port = Number(value);
    return Number.isInteger(port) && port > 0 && port <= 65535 ? port : fallback;
}
function clean(value) {
    return (value || '').trim();
}
function buildEmailConfig(map) {
    return {
        email_enabled: parseBool(map.email_enabled),
        email_from_name: clean(map.email_from_name),
        email_from_address: clean(map.email_from_address),
        smtp_host: clean(map.smtp_host),
        smtp_port: parsePort(map.smtp_port, 465),
        smtp_secure: parseBool(map.smtp_secure),
        smtp_username: clean(map.smtp_username),
        smtp_password: clean(map.smtp_password),
        pop3_host: clean(map.pop3_host),
        pop3_port: parsePort(map.pop3_port, 995),
        pop3_secure: parseBool(map.pop3_secure),
        imap_host: clean(map.imap_host),
        imap_port: parsePort(map.imap_port, 993),
        imap_secure: parseBool(map.imap_secure),
    };
}
function maskEmailConfig(items) {
    return items.map((item) => {
        if (item.config_key === 'smtp_password' && item.config_value) {
            return { ...item, config_value: '__CONFIGURED__' };
        }
        return item;
    });
}
function isEmailConfigComplete(config) {
    return Boolean(config.email_enabled &&
        config.email_from_address &&
        config.smtp_host &&
        config.smtp_port &&
        config.smtp_username &&
        config.smtp_password);
}
function formatSmtpError(err) {
    const parts = [
        err?.message || '测试邮件发送失败',
        err?.code ? `code=${err.code}` : '',
        err?.command ? `command=${err.command}` : '',
        err?.responseCode ? `responseCode=${err.responseCode}` : '',
        err?.response ? `response=${err.response}` : '',
    ].filter(Boolean);
    const message = parts.join('；');
    if (err?.responseCode === 550 || /User has no permission/i.test(message)) {
        return `${message}。常见原因：邮箱未开启 SMTP/客户端授权服务，或 SMTP 密码不是客户端授权码。163 邮箱需在网页端开启 POP3/SMTP/IMAP，并使用授权码而不是登录密码。`;
    }
    if (err?.code === 'EAUTH') {
        return `${message}。常见原因：SMTP 用户名或授权码错误。`;
    }
    if (err?.code === 'ECONNECTION' || err?.code === 'ETIMEDOUT') {
        return `${message}。常见原因：当前网络或服务器无法连接 SMTP 主机/端口。`;
    }
    return message;
}
//# sourceMappingURL=emailConfig.js.map