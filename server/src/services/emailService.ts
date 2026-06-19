import nodemailer from 'nodemailer';
import { getAllSiteConfigs } from '../repositories/siteConfigRepository';
import { buildEmailConfig, formatSmtpError, isEmailConfigComplete } from './emailConfig';

async function loadEmailConfig() {
  const configs = await getAllSiteConfigs();
  const map = configs.reduce<Record<string, string>>((acc, item) => {
    acc[item.config_key] = item.config_value || '';
    return acc;
  }, {});
  return buildEmailConfig(map);
}

export async function sendMail(options: { to: string; subject: string; text: string; html?: string }): Promise<void> {
  const config = await loadEmailConfig();
  if (!isEmailConfigComplete(config)) {
    throw new Error('邮箱 SMTP 配置不完整或未启用');
  }

  const transporter = nodemailer.createTransport({
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
  } catch (err: any) {
    throw new Error(formatSmtpError(err));
  }
}

export async function sendPasswordResetCode(to: string, code: string): Promise<void> {
  await sendMail({
    to,
    subject: '密码重置验证码',
    text: `您的密码重置验证码是：${code}，15 分钟内有效。若非本人操作，请忽略此邮件。`,
    html: `<p>您的密码重置验证码是：</p><p style="font-size:24px;font-weight:bold;letter-spacing:4px">${code}</p><p>15 分钟内有效。若非本人操作，请忽略此邮件。</p>`,
  });
}

export async function sendTestEmail(to: string): Promise<void> {
  await sendMail({
    to,
    subject: '邮箱配置测试',
    text: '这是一封邮箱配置测试邮件。收到此邮件说明 SMTP 配置可用。',
  });
}
