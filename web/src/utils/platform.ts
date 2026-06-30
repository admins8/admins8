export const isCapacitor = (): boolean => {
  return typeof (window as any).Capacitor !== 'undefined';
};

export const getPlatform = (): string => {
  if (!isCapacitor()) return 'web';
  return (window as any).Capacitor.getPlatform();
};

export const isAndroid = (): boolean => getPlatform() === 'android';
export const isIOS = (): boolean => getPlatform() === 'ios';
export const isHarmony = (): boolean => getPlatform() === 'harmony';
export const isWeb = (): boolean => getPlatform() === 'web';

export async function initAppConfig(): Promise<void> {
  if (!isCapacitor()) return;
  try {
    const res = await fetch('/api/app/config');
    const result = await res.json();
    if (result.code === 0 && result.data) {
      const config = result.data;
      if (config.api_base_url) {
        localStorage.setItem('API_BASE_URL', config.api_base_url);
      }
      if (config.theme_color) {
        document.documentElement.style.setProperty('--el-color-primary', config.theme_color);
      }
      if (config.app_name) {
        document.title = config.app_name;
      }
    }
  } catch (error) {
    console.error('APP配置初始化失败:', error);
  }
}

export async function checkAppUpdate(): Promise<void> {
  if (!isCapacitor()) return;
  try {
    const currentVersionCode = parseInt(localStorage.getItem('APP_VERSION_CODE') || '0');
    const platform = getPlatform();
    const res = await fetch(`/api/app/check-update?platform=${platform}&version_code=${currentVersionCode}`);
    const result = await res.json();
    if (result.code === 0 && result.data?.has_update) {
      const update = result.data;
      if (update.force_update) {
        alert(`发现新版本 ${update.version_name}，请更新后继续使用。\n\n更新内容：\n${update.changelog}`);
        if (update.download_url) window.location.href = update.download_url;
      } else {
        const confirmUpdate = confirm(`发现新版本 ${update.version_name}，是否更新？\n\n更新内容：\n${update.changelog}`);
        if (confirmUpdate && update.download_url) window.location.href = update.download_url;
      }
    }
  } catch (error) {
    console.error('检查更新失败:', error);
  }
}
