import { Page } from 'playwright';
import pino from 'pino';
import { BrowserPool } from './BrowserPool';
import { AntiBotEngine } from './AntiBotEngine';

const logger = pino({ name: 'unlocker-service' });

const PROXY_POOL: string[] = (process.env.PROXY_LIST ?? '').split(',').filter(Boolean);

export interface UnlockOptions {
  proxyUrl?: string;
  headers?: Record<string, string>;
  cookies?: Array<{ name: string; value: string; domain: string; path?: string }>;
  waitFor?: 'load' | 'domcontentloaded' | 'networkidle';
  maxAttempts?: number;
  timeout?: number;
}

export interface UnlockResult {
  html: string;
  status: number;
  attempts: number;
  proxyUsed?: string;
  blocked: boolean;
  url: string;
}

export class UnlockerService {
  private pool = BrowserPool.getInstance();
  private antiBot = new AntiBotEngine();

  /**
   * Full Web Unlocker pipeline:
   * pick proxy → set headers → navigate → check for bot detection
   * → retry with different fingerprint if blocked → return result
   */
  async unlock(url: string, options: UnlockOptions = {}): Promise<UnlockResult> {
    const maxAttempts = options.maxAttempts ?? 3;
    const waitFor = options.waitFor ?? 'domcontentloaded';
    const timeout = options.timeout ?? 30_000;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const proxyUrl = options.proxyUrl ?? this.pickProxy();
      let session = await this.pool.acquire({ proxyUrl: proxyUrl || undefined }).catch(() => null);

      if (!session) {
        session = await this.pool.acquire();
      }

      try {
        const page = session.page;

        // Apply stealth on first attempt, rotate fingerprint on retries
        if (attempt === 1) {
          await this.antiBot.applyStealthPatterns(page);
        } else {
          await this.antiBot.rotateFingerprint(page);
        }

        // Set extra headers
        if (options.headers) {
          await page.setExtraHTTPHeaders(options.headers);
        }

        // Inject cookies
        if (options.cookies?.length) {
          await session.context.addCookies(
            options.cookies.map(c => ({
              name: c.name,
              value: c.value,
              domain: c.domain,
              path: c.path ?? '/',
            }))
          );
        }

        // Navigate
        const response = await page.goto(url, {
          waitUntil: waitFor,
          timeout,
        });

        const status = response?.status() ?? 0;

        // Check for bot detection
        const botCheck = await this.antiBot.detectBotChallenge(page);

        if (botCheck.blocked) {
          logger.warn(
            { attempt, reason: botCheck.reason, url },
            'Bot challenge detected, retrying with different fingerprint'
          );

          if (botCheck.captchaType) {
            const solved = await this.antiBot.solveCaptcha(page, botCheck.captchaType);
            if (solved) {
              // Re-check after solving
              const recheck = await this.antiBot.detectBotChallenge(page);
              if (!recheck.blocked) {
                const html = await page.content();
                this.pool.release(session.id);
                return { html, status, attempts: attempt, proxyUsed: proxyUrl, blocked: false, url: page.url() };
              }
            }
          }

          this.pool.release(session.id);
          await this.antiBot.simulateHumanDelay(1000, 3000);
          continue;
        }

        // Human-like delay before extracting content
        await this.antiBot.simulateHumanDelay(500, 1500);

        const html = await page.content();
        this.pool.release(session.id);

        return {
          html,
          status,
          attempts: attempt,
          proxyUsed: proxyUrl || undefined,
          blocked: false,
          url: page.url(),
        };
      } catch (err) {
        lastError = err as Error;
        logger.error({ err, attempt, url }, 'Unlock attempt failed');
        await this.pool.closeSession(session.id);
        await this.antiBot.simulateHumanDelay(500, 2000);
      }
    }

    throw new Error(
      `Failed to unlock ${url} after ${maxAttempts} attempts: ${lastError?.message}`
    );
  }

  private pickProxy(): string {
    if (PROXY_POOL.length === 0) return '';
    return PROXY_POOL[Math.floor(Math.random() * PROXY_POOL.length)];
  }
}
