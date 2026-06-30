import { query } from '../config/database';

export interface AppConfig {
  id: number;
  app_name: string;
  app_package: string;
  api_base_url: string;
  theme_color: string;
  about_content: string | null;
  privacy_policy_url: string | null;
  user_agreement_url: string | null;
  icon_path: string | null;
  splash_path: string | null;
  github_token: string | null;
  github_owner: string | null;
  github_repo: string | null;
  github_workflow: string | null;
  github_branch: string | null;
  build_callback_secret: string | null;
  created_at: string;
  updated_at: string;
}

// 敏感字段，不通过公开 API 返回
const SENSITIVE_FIELDS = ['github_token', 'build_callback_secret'];

export async function getAppConfig(): Promise<AppConfig | null> {
  const rows = await query('SELECT * FROM app_config LIMIT 1') as AppConfig[];
  return rows[0] || null;
}

// 仅用于管理后台，返回全部字段（包括 token）
export async function getAdminAppConfig(): Promise<Partial<AppConfig>> {
  const config = await getAppConfig();
  if (!config) return {};
  // 返回 token 的掩码版本
  return {
    ...config,
    github_token: config.github_token ? maskToken(config.github_token) : null,
  };
}

function maskToken(token: string): string {
  if (token.length <= 8) return '****';
  return token.substring(0, 4) + '****' + token.substring(token.length - 4);
}

export async function updateAppConfig(data: Partial<AppConfig>): Promise<void> {
  const allowed = ['app_name','app_package','api_base_url','theme_color',
    'about_content','privacy_policy_url','user_agreement_url','icon_path','splash_path',
    'github_token','github_owner','github_repo','github_workflow','github_branch','build_callback_secret'] as const;

  const sets: string[] = [];
  const values: any[] = [];

  for (const key of allowed) {
    if ((data as any)[key] !== undefined) {
      sets.push(`${key} = ?`);
      values.push((data as any)[key]);
    }
  }

  if (sets.length === 0) return;

  const existing = await getAppConfig();
  if (!existing) {
    await query(
      `INSERT INTO app_config (app_name, app_package, api_base_url, theme_color, about_content, privacy_policy_url, user_agreement_url, icon_path, splash_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['搜猫阅读', 'com.soumal.reader', 'https://soumal.com', '#409EFF', null, null, null, null, null]
    );
  }

  await query(`UPDATE app_config SET ${sets.join(', ')} WHERE id = ?`, [...values, existing!.id]);
}

export async function getPublicAppConfig(): Promise<Record<string, string>> {
  const config = await getAppConfig();
  if (!config) return {};
  return {
    app_name: config.app_name,
    api_base_url: config.api_base_url,
    theme_color: config.theme_color,
    privacy_policy_url: config.privacy_policy_url || '',
    user_agreement_url: config.user_agreement_url || '',
  };
}
