"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendMail = sendMail;
exports.sendPasswordResetCode = sendPasswordResetCode;
exports.sendTestEmail = sendTestEmail;
const nodemailer_1 = __importDefault(require("nodemailer"));
const siteConfigRepository_1 = require("../repositories/siteConfigRepository");
const emailConfig_1 = require("./emailConfig");
async function loadEmailConfig() {
    const configs = await (0, siteConfigRepository_1.getAllSiteConfigs)();
    const map = configs.reduce((acc, item) => {
        acc[item.config_key] = item.config_value || '';
        return acc;
    }, {});
    return (0, emailConfig_1.buildEmailConfig)(map);
}
async function sendMail(options) {
    const config = await loadEmailConfig();
    if (!(0, emailConfig_1.isEmailConfigComplete)(config)) {
        throw new Error('邮箱 SMTP 配置不完整或未启用');
    }
    const transporter = nodemailer_1.default.createTransport({
        host: config.smtp_host,
        port: config.smtp_port,
        secure: config.smtp_secure,
        auth: {
            user: config.smtp_username,
            pass: config.smtp_password,
        },
    });
    try {
        await transporter.sendMail({
            from: {
                name: config.email_from_name || config.email_from_address,
                address: config.email_from_address,
            },
            sender: config.smtp_username,
            to: options.to,
            subject: options.subject,
            text: options.text,
            html: options.html,
        });
    }
    catch (err) {
        throw new Error((0, emailConfig_1.formatSmtpError)(err));
    }
}
async function sendPasswordResetCode(to, code) {
    await sendMail({
        to,
        subject: '密码重置验证码',
        text: `您的密码重置验证码是：${code}，15 分钟内有效。若非本人操作，请忽略此邮件。`,
        html: `<p>您的密码重置验证码是：</p><p style="font-size:24px;font-weight:bold;letter-spacing:4px">${code}</p><p>15 分钟内有效。若非本人操作，请忽略此邮件。</p>`,
    });
}
async function sendTestEmail(to) {
    await sendMail({
        to,
        subject: '邮箱配置测试',
        text: '这是一封邮箱配置测试邮件。收到此邮件说明 SMTP 配置可用。',
    });
}
//# sourceMappingURL=emailService.js.map