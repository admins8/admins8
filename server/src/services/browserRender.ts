import { chromium, Browser, BrowserContext, Page } from 'playwright';
import * as fs from 'fs';

let browserInstance: Browser | null = null;
let browserLock: Promise<Browser> | null = null;

/**
 * Android WebView (BackstageWebView) 模拟配置
 * Legado 使用 Android 系统的 BackstageWebView 进行后台渲染，
 * 这里通过 Playwright + Android WebView User-Agent 模拟该行为。
 */
const ANDROID_WEBVIEW_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.6099.230 Mobile Safari/537.36';

const ANDROID_WEBVIEW_VIEWPORT = { width: 412, height: 915 }; // Pixel 8 Pro 逻辑分辨率

/**
 * 查找系统安装的 Chromium/Chrome 可执行文件
 */
function findChromiumExecutable(): string | undefined {
  const possiblePaths = [
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chrome',
    '/snap/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ];

  for (const path of possiblePaths) {
    if (fs.existsSync(path)) {
      console.log(`[BrowserRender] 找到浏览器: ${path}`);
      return path;
    }
  }

  // 尝试使用 which 命令查找
  try {
    const { execSync } = require('child_process');
    for (const cmd of ['chromium-browser', 'chromium', 'google-chrome', 'google-chrome-stable']) {
      try {
        const result = execSync(`which ${cmd} 2>/dev/null`, { encoding: 'utf-8' }).trim();
        if (result && fs.existsSync(result)) {
          console.log(`[BrowserRender] 找到浏览器: ${result}`);
          return result;
        }
      } catch {
        // 忽略错误，继续尝试下一个
      }
    }
  } catch {
    // 忽略错误
  }

  console.log('[BrowserRender] 未找到系统浏览器，将使用 Playwright 内置浏览器');
  return undefined;
}

/**
 * 获取或启动浏览器实例（单例模式）
 */
async function getBrowser(): Promise<Browser> {
  if (browserInstance) {
    try {
      // 检查浏览器是否仍然可用
      await browserInstance.newContext();
      return browserInstance;
    } catch {
      browserInstance = null;
    }
  }

  if (browserLock) {
    return browserLock;
  }

  const executablePath = findChromiumExecutable();

  browserLock = chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1920,1080',
    ],
  });

  try {
    browserInstance = await browserLock;
    console.log('[BrowserRender] 浏览器启动成功');
    return browserInstance;
  } catch (error) {
    console.error('[BrowserRender] 浏览器启动失败:', error);
    throw error;
  } finally {
    browserLock = null;
  }
}

/**
 * 检测 HTML 是否包含反爬验证页面特征
 */
export function isAntiCrawlPage(html: string, url: string): boolean {
  const htmlLower = html.toLowerCase();

  // 常见的反爬验证页面特征
  const antiCrawlPatterns = [
    // 验证码/挑战页面
    /GE\/CC\/VALIDATOR/i,
    /validator/i,
    /captcha/i,
    /security check/i,
    /安全检查/i,
    /访问验证/i,
    /人机验证/i,
    // Cloudflare
    /cf-browser-verification/i,
    /__cf_bm/i,
    /checking your browser/i,
    /just a moment/i,
    // 其他反爬
    /ddos-protection/i,
    /waf/i,
    /blocked/i,
    /access denied/i,
  ];

  // 检查 URL 是否包含验证路径
  if (url.includes('/GE/CC/VALIDATOR') || url.includes('/captcha') || url.includes('/challenge')) {
    return true;
  }

  // 检查 HTML 内容
  for (const pattern of antiCrawlPatterns) {
    if (pattern.test(html)) {
      return true;
    }
  }

  // 检查页面内容是否过少（可能是验证页面）
  const textContent = html.replace(/<[^>]+>/g, '').trim();
  if (textContent.length < 100 && (htmlLower.includes('script') || htmlLower.includes('meta'))) {
    // 可能是自动跳转的验证页面
    if (htmlLower.includes('refresh') || htmlLower.includes('redirect') || htmlLower.includes('location')) {
      return true;
    }
  }

  return false;
}

/**
 * 使用浏览器渲染获取页面内容
 *
 * @param webView 渲染模式：
 *   - 'android' | 'backstage' | 'backstageWebView': 使用 Android WebView 模拟（移动端 UA + 视口）
 *   - 'desktop' | true: 使用桌面 Chromium 渲染（默认行为）
 *   - 不传: 默认桌面模式
 */
export async function fetchWithBrowser(url: string, options: {
  timeout?: number;
  waitForSelector?: string;
  waitForTimeout?: number;
  userAgent?: string;
  webView?: string | boolean;
} = {}): Promise<string> {
  const browser = await getBrowser();

  // 判断是否使用 Android WebView 模式
  const isAndroidWebView = options.webView === 'android'
    || options.webView === 'backstage'
    || options.webView === 'backstageWebView'
    || options.webView === 'BackstageWebView';

  const context = await browser.newContext({
    userAgent: options.userAgent
      || (isAndroidWebView ? ANDROID_WEBVIEW_UA : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'),
    viewport: isAndroidWebView ? ANDROID_WEBVIEW_VIEWPORT : { width: 1920, height: 1080 },
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    isMobile: isAndroidWebView,
    hasTouch: isAndroidWebView,
    extraHTTPHeaders: {
      'Accept': isAndroidWebView
        ? 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7'
        : 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'max-age=0',
    },
  });

  const page = await context.newPage();

  try {
    // 设置超时
    const timeout = options.timeout || 30000;

    // 导航到页面
    const response = await page.goto(url, {
      waitUntil: 'networkidle',
      timeout,
    });

    // 等待页面加载完成
    if (options.waitForTimeout) {
      await page.waitForTimeout(options.waitForTimeout);
    }

    if (options.waitForSelector) {
      await page.waitForSelector(options.waitForSelector, { timeout: timeout / 2 });
    }

    // 等待一段时间让 JavaScript 执行完成
    await page.waitForTimeout(2000);

    // 获取页面 HTML
    const html = await page.content();

    console.log(`[BrowserRender] 成功获取页面: ${url}, 状态: ${response?.status()}, 内容长度: ${html.length}`);

    return html;
  } catch (error: any) {
    console.error(`[BrowserRender] 获取页面失败: ${url}`, error.message);
    throw error;
  } finally {
    await page.close();
    await context.close();
  }
}

/**
 * 关闭浏览器实例（用于优雅关闭）
 */
export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
    console.log('[BrowserRender] 浏览器已关闭');
  }
}

// 进程退出时关闭浏览器
process.on('exit', () => {
  if (browserInstance) {
    browserInstance.close().catch(() => {});
  }
});

process.on('SIGINT', () => {
  if (browserInstance) {
    browserInstance.close().catch(() => {});
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  if (browserInstance) {
    browserInstance.close().catch(() => {});
  }
  process.exit(0);
});
