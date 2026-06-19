import { query } from '../config/database';

export interface AppVersion {
  id: number;
  platform: 'android' | 'harmony';
  version_name: string;
  version_code: number;
  changelog: string | null;
  download_url: string | null;
  force_update: boolean;
  is_published: boolean;
  file_size: number;
  build_task_id: number | null;
  created_at: string;
}

export async function listVersions(platform?: string): Promise<AppVersion[]> {
  if (platform) {
    return query('SELECT * FROM app_versions WHERE platform = ? ORDER BY version_code DESC', [platform]) as AppVersion[];
  }
  return query('SELECT * FROM app_versions ORDER BY version_code DESC') as AppVersion[];
}

export async function createVersion(data: {
  platform: string;
  version_name: string;
  version_code: number;
  changelog?: string;
}): Promise<number> {
  const result = await query(
    'INSERT INTO app_versions (platform, version_name, version_code, changelog) VALUES (?, ?, ?, ?)',
    [data.platform, data.version_name, data.version_code, data.changelog || '']
  ) as any;
  return result.insertId;
}

export async function updateVersion(id: number, data: Partial<AppVersion>): Promise<void> {
  const allowed = ['version_name','version_code','changelog','download_url','force_update','is_published','file_size','build_task_id'] as const;
  const sets: string[] = [];
  const values: any[] = [];

  for (const key of allowed) {
    if ((data as any)[key] !== undefined) {
      sets.push(`${key} = ?`);
      values.push((data as any)[key]);
    }
  }

  if (sets.length === 0) return;
  await query(`UPDATE app_versions SET ${sets.join(', ')} WHERE id = ?`, [...values, id]);
}

export async function deleteVersion(id: number): Promise<void> {
  await query('DELETE FROM app_versions WHERE id = ?', [id]);
}

export async function getLatestVersion(platform: string): Promise<AppVersion | null> {
  const rows = await query(
    'SELECT * FROM app_versions WHERE platform = ? AND is_published = 1 ORDER BY version_code DESC LIMIT 1',
    [platform]
  ) as AppVersion[];
  return rows[0] || null;
}
