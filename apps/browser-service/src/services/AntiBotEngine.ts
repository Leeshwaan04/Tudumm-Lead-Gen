import { Page } from 'playwright';
import pino from 'pino';

const logger = pino({ name: 'anti-bot-engine' });

export type CaptchaType = 'recaptcha_v2' | 'recaptcha_v3' | 'hcaptcha' | 'cloudflare' | 'funcaptcha';

export interface StealthOptions {
  randomizeViewport?: boolean;
  overrideWebdriver?: boolean;
  simulateMouse?: boolean;
  setRealisticUA?: boolean;
}

export class AntiBotEngine {
  /**
   * Apply stealth patterns to a Playwright page to reduce bot detection.
   */
  async applyStealthPatterns(page: Page, options: StealthOptions = {}): Promise<void> {
    const {
      randomizeViewport = true,
      overrideWebdriver = true,
      simulateMouse = true,
      setRealisticUA = true,
    } = options;

    if (overrideWebdriver) {
      await page.addInitScript(() => {
        // Override navigator.webdriver
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
          configurable: true,
        });

        // Override navigator.plugins to look non-empty
        Object.defineProperty(navigator, 'plugins', {
          get: () => {
            const plugins = [
              { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
              { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
              { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' },
            ];
            return Object.assign(plugins, { item: (i: number) => plugins[i], namedItem: (n: string) => plugins.find(p => p.name === n) || null, refresh: () => {} });
          },
          configurable: true,
        });

        // Override navigator.languages
        Object.defineProperty(navigator, 'languages', {
          get: () => ['en-US', 'en'],
          configurable: true,
        });

        // Override navigator.permissions
        const originalQuery = (window as any).navigator?.permissions?.query;
        if (originalQuery) {
          (window as any).navigator.permissions.query = (parameters: { name: string }) =>
            parameters.name === 'notifications'
              ? Promise.resolve({ state: Notification.permission })
              : originalQuery(parameters);
        }

        // Remove automation-related chrome properties
        delete (window as any).cdc_adoQpoasnfa76pfcZLmcfl_Array;
        delete (window as any).cdc_adoQpoasnfa76pfcZLmcfl_Promise;
        delete (window as any).cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
      });
    }

    if (randomizeViewport) {
      const viewports = [
        { width: 1920, height: 1080 },
        { width: 1366, height: 768 },
        { width: 1440, height: 900 },
        { width: 1536, height: 864 },
        { width: 1280, height: 720 },
      ];
      const vp = viewports[Math.floor(Math.random() * viewports.length)];
      await page.setViewportSize(vp);
    }

    if (setRealisticUA) {
      await page.addInitScript(() => {
        // Ensure consistent UA-based feature detection
        Object.defineProperty(navigator, 'hardwareConcurrency', {
          get: () => 8,
          configurable: true,
        });
        Object.defineProperty(navigator, 'deviceMemory', {
          get: () => 8,
          configurable: true,
        });
      });
    }

    if (simulateMouse) {
      // Move mouse to a random position after page loads to show human-like behaviour
      page.on('load', async () => {
        try {
          const x = 100 + Math.floor(Math.random() * 800);
          const y = 100 + Math.floor(Math.random() * 400);
          await page.mouse.move(x, y, { steps: 10 });
        } catch {
          // Page may have navigated away
        }
      });
    }

    logger.debug('Stealth patterns applied');
  }

  /**
   * Solve a captcha on the page. Currently a placeholder for CapSolver/2captcha integration.
   */
  async solveCaptcha(
    page: Page,
    captchaType: CaptchaType,
    options?: { apiKey?: string; siteKey?: string }
  ): Promise<boolean> {
    logger.info({ captchaType }, 'Attempting captcha solve');

    // Placeholder: In production, integrate with CapSolver or 2captcha APIs
    // Example flow for reCAPTCHA v2:
    // 1. Extract siteKey from page
    // 2. POST to CapSolver API with task type + siteKey + pageURL
    // 3. Poll for solution token
    // 4. Inject token into g-recaptcha-response textarea
    // 5. Submit form

    switch (captchaType) {
      case 'recaptcha_v2': {
        // Extract siteKey if not provided
        const siteKey = options?.siteKey ?? await page.evaluate(() => {
          const el = document.querySelector('[data-sitekey]');
          return el?.getAttribute('data-sitekey') ?? null;
        });
        if (!siteKey) {
          logger.warn('Could not find reCAPTCHA sitekey');
          return false;
        }
        logger.info({ siteKey }, 'reCAPTCHA v2 siteKey found — CapSolver integration required');
        return false; // Not yet integrated
      }
      case 'hcaptcha': {
        logger.info('hCaptcha detected — CapSolver integration required');
        return false;
      }
      case 'cloudflare': {
        // Cloudflare Turnstile or challenge page
        logger.info('Cloudflare challenge detected — waiting for auto-solve');
        await this.simulateHumanDelay(3000, 6000);
        return false;
      }
      default:
        logger.warn({ captchaType }, 'Unknown captcha type');
        return false;
    }
  }

  /**
   * Random delay to simulate human interaction timing.
   */
  async simulateHumanDelay(min: number = 500, max: number = 2000): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min) + min);
    await new Promise<void>(resolve => setTimeout(resolve, delay));
  }

  /**
   * Rotate canvas fingerprint, WebGL renderer string, and other fingerprinting vectors.
   */
  async rotateFingerprint(page: Page): Promise<void> {
    const noise = Math.random() * 0.1;
    const webglVendors = [
      'Google Inc. (Intel)',
      'Google Inc. (NVIDIA)',
      'Google Inc. (AMD)',
      'Apple Inc.',
    ];
    const webglRenderers = [
      'ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'ANGLE (AMD, AMD Radeon RX 580 Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'Apple GPU',
    ];
    const idx = Math.floor(Math.random() * webglVendors.length);

    await page.addInitScript(
      ({ noise, vendor, renderer }: { noise: number; vendor: string; renderer: string }) => {
        // Canvas noise
        const originalGetContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (
          this: HTMLCanvasElement,
          type: string,
          ...args: unknown[]
        ): RenderingContext | null {
          const ctx = originalGetContext.call(this, type, ...args);
          if (type === '2d' && ctx) {
            const originalFillText = (ctx as CanvasRenderingContext2D).fillText.bind(ctx);
            (ctx as CanvasRenderingContext2D).fillText = function (...a) {
              (ctx as CanvasRenderingContext2D).globalAlpha = 1 - noise * 0.01;
              return originalFillText(...a);
            };
          }
          return ctx;
        };

        // WebGL fingerprint
        const getParam = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function (parameter: number) {
          if (parameter === 37445) return vendor;   // UNMASKED_VENDOR_WEBGL
          if (parameter === 37446) return renderer; // UNMASKED_RENDERER_WEBGL
          return getParam.call(this, parameter);
        };
      },
      { noise, vendor: webglVendors[idx], renderer: webglRenderers[idx] }
    );

    logger.debug({ vendor: webglVendors[idx] }, 'Fingerprint rotated');
  }

  /**
   * Detect if the page is showing a bot challenge / blocked page.
   */
  async detectBotChallenge(page: Page): Promise<{
    blocked: boolean;
    reason?: string;
    captchaType?: CaptchaType;
  }> {
    const title = await page.title().catch(() => '');
    const url = page.url();
    const content = await page.content().catch(() => '');

    if (
      title.toLowerCase().includes('access denied') ||
      title.toLowerCase().includes('403 forbidden') ||
      url.includes('/blocked')
    ) {
      return { blocked: true, reason: 'access_denied' };
    }

    if (content.includes('grecaptcha') || content.includes('g-recaptcha')) {
      return { blocked: true, reason: 'captcha', captchaType: 'recaptcha_v2' };
    }

    if (content.includes('hcaptcha.com')) {
      return { blocked: true, reason: 'captcha', captchaType: 'hcaptcha' };
    }

    if (
      content.includes('cf-browser-verification') ||
      content.includes('Checking your browser') ||
      content.includes('cf_clearance')
    ) {
      return { blocked: true, reason: 'cloudflare', captchaType: 'cloudflare' };
    }

    return { blocked: false };
  }
}
