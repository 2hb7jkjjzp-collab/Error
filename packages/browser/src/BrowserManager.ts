import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { MeshalError, ErrorCode } from "@meshal/shared";

/**
 * Thin Playwright wrapper. Deliberately does not include any CAPTCHA
 * solving, fingerprint spoofing, or anti-bot evasion (forbidden by Section
 * 21) — it only launches a normal, honest browser context, optionally
 * restoring a previously authenticated storageState.
 */
export class BrowserManager {
  private browser: Browser | null = null;

  async launch(): Promise<Browser> {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: process.env.PLAYWRIGHT_HEADLESS !== "false",
      });
    }
    return this.browser;
  }

  async newContext(storageStatePath?: string): Promise<BrowserContext> {
    const browser = await this.launch();
    try {
      return await browser.newContext({
        storageState: storageStatePath,
        viewport: { width: 1366, height: 900 },
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
      });
    } catch (err) {
      throw new MeshalError(ErrorCode.ENGINEERING_ERROR, `Failed to create browser context: ${err}`);
    }
  }

  async navigate(page: Page, url: string, timeoutMs = 30_000): Promise<void> {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    } catch (err) {
      throw new MeshalError(ErrorCode.NAVIGATION_TIMEOUT, `Navigation to ${url} timed out or failed: ${err}`, { url });
    }
  }

  async screenshot(page: Page, path: string): Promise<void> {
    await page.screenshot({ path, fullPage: true });
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
