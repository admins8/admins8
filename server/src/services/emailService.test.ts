import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEmailConfig, formatSmtpError, isEmailConfigComplete, maskEmailConfig } from './emailConfig';

test('buildEmailConfig parses booleans and ports with defaults', () => {
  const config = buildEmailConfig({
    email_enabled: 'true',
    smtp_port: '465',
    smtp_secure: 'true',
    pop3_port: '995',
    imap_port: '993',
  });

  assert.equal(config.email_enabled, true);
  assert.equal(config.smtp_port, 465);
  assert.equal(config.smtp_secure, true);
  assert.equal(config.pop3_port, 995);
  assert.equal(config.imap_port, 993);
});

test('isEmailConfigComplete requires enabled SMTP credentials', () => {
  assert.equal(isEmailConfigComplete(buildEmailConfig({ email_enabled: 'false' })), false);
  assert.equal(isEmailConfigComplete(buildEmailConfig({
    email_enabled: 'true',
    email_from_address: 'noreply@example.com',
    smtp_host: 'smtp.example.com',
    smtp_port: '465',
    smtp_username: 'noreply@example.com',
    smtp_password: 'secret',
  })), true);
});

test('maskEmailConfig hides configured smtp password', () => {
  const result = maskEmailConfig([
    { config_key: 'smtp_password', config_value: 'secret' },
    { config_key: 'smtp_host', config_value: 'smtp.example.com' },
  ]);

  assert.equal(result[0].config_value, '__CONFIGURED__');
  assert.equal(result[1].config_value, 'smtp.example.com');
});

test('buildEmailConfig trims copied SMTP values', () => {
  const config = buildEmailConfig({
    smtp_host: ' smtp.163.com ',
    smtp_username: ' noreply@example.com ',
    smtp_password: ' auth-code ',
  });

  assert.equal(config.smtp_host, 'smtp.163.com');
  assert.equal(config.smtp_username, 'noreply@example.com');
  assert.equal(config.smtp_password, 'auth-code');
});

test('formatSmtpError explains 163 permission failures', () => {
  const message = formatSmtpError({
    message: 'Invalid login: 550 User has no permission',
    code: 'EAUTH',
    command: 'AUTH PLAIN',
    responseCode: 550,
    response: '550 User has no permission',
  });

  assert.match(message, /客户端授权码/);
  assert.match(message, /responseCode=550/);
});
