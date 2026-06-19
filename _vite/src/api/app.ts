import request from './request';

export interface AppConfig {
  id: number;
  app_name: string;
  app_package: string;
  api_base_url: string;
  theme_color: string;
  about_content: string;
  privacy_policy_url: string;
  user_agreement_url: string;
  icon_path: string;
  splash_path: string;
}

export interface AppVersion {
  id: number;
  platform: 'android' | 'harmony';
  version_name: string;
  version_code: number;
  changelog: string;
  download_url: string;
  force_update: boolean;
  is_published: boolean;
  file_size: number;
  created_at: string;
}

export interface BuildTask {
  id: number;
  platform: 'android' | 'harmony';
  version_name: string;
  version_code: number;
  status: 'pending' | 'building' | 'success' | 'failed';
  build_log: string;
  output_path: string;
  created_at: string;
}

export const getAppConfig = () => request.get('/app/admin/config');
export const updateAppConfig = (data: Partial<AppConfig>) => request.post('/app/admin/config', data);
export const uploadAppIcon = (file: File) => {
  const formData = new FormData();
  formData.append('icon', file);
  return request.post('/app/admin/upload-icon', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
};
export const uploadAppSplash = (file: File) => {
  const formData = new FormData();
  formData.append('splash', file);
  return request.post('/app/admin/upload-splash', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
};
export const listAppVersions = (platform?: string) =>
  request.get('/app/admin/versions', { params: { platform } });
export const createAppVersion = (data: Partial<AppVersion>) =>
  request.post('/app/admin/versions', data);
export const updateAppVersion = (id: number, data: Partial<AppVersion>) =>
  request.put(`/app/admin/versions/${id}`, data);
export const deleteAppVersion = (id: number) =>
  request.delete(`/app/admin/versions/${id}`);
export const triggerBuild = (data: { platform: string; version_name: string; version_code: number; version_id: number }) =>
  request.post('/app/admin/build', data);
export const getBuildStatus = (id: number) =>
  request.get(`/app/admin/build/${id}`);
export const listBuildTasks = () =>
  request.get('/app/admin/build-tasks');
