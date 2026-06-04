import { Page } from 'playwright';
import pino from 'pino';
import { BrowserPool } from './BrowserPool';
import { AntiBotEngine } from './AntiBotEngine';
import { solveIfPresent, detectCaptcha, solveCaptcha } from '../stealth/captcha';

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
  blockReason?: string;
  url: string;
  data?: Record<string, unknown>;
}

// Runs INSIDE the page (browser context). Extracts universal data points plus
// structured data (JSON-LD, OpenGraph) that cover most real-world sources.
function pageExtractor(): Record<string, unknown> {
  const text = document.body?.innerText ?? '';
  const abs = (h: string | null) => { try { return h ? new URL(h, location.href).href : null; } catch { return null; } };

  // Emails — mailto links + text regex, de-duped
  const emailSet = new Set<string>();
  document.querySelectorAll('a[href^="mailto:"]').forEach(a => {
    const e = a.getAttribute('href')!.replace('mailto:', '').split('?')[0].trim();
    if (e) emailSet.add(e.toLowerCase());
  });
  (text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) ?? [])
    .forEach(e => emailSet.add(e.toLowerCase()));

  // Phones — tel links + loose text regex
  const phoneSet = new Set<string>();
  document.querySelectorAll('a[href^="tel:"]').forEach(a => {
    const p = a.getAttribute('href')!.replace('tel:', '').trim();
    if (p) phoneSet.add(p);
  });
  (text.match(/\+?\d[\d\s().-]{7,}\d/g) ?? []).slice(0, 20).forEach(p => phoneSet.add(p.trim()));

  // Social links
  const social: Record<string, string> = {};
  document.querySelectorAll('a[href]').forEach(a => {
    const h = (a as HTMLAnchorElement).href;
    if (/linkedin\.com/i.test(h) && !social.linkedin) social.linkedin = h;
    else if (/(twitter|x)\.com/i.test(h) && !social.twitter) social.twitter = h;
    else if (/instagram\.com/i.test(h) && !social.instagram) social.instagram = h;
    else if (/facebook\.com/i.test(h) && !social.facebook) social.facebook = h;
    else if (/youtube\.com/i.test(h) && !social.youtube) social.youtube = h;
  });

  // OpenGraph
  const og: Record<string, string> = {};
  document.querySelectorAll('meta[property^="og:"]').forEach(m => {
    const k = m.getAttribute('property')!.replace('og:', '');
    const v = m.getAttribute('content');
    if (v) og[k] = v;
  });

  // JSON-LD structured data (covers LocalBusiness, Organization, Product, Person…)
  const jsonLd: unknown[] = [];
  document.querySelectorAll('script[type="application/ld+json"]').forEach(s => {
    try { jsonLd.push(JSON.parse(s.textContent ?? '')); } catch { /* ignore */ }
  });

  const metaDesc = document.querySelector('meta[name="description"]')?.getAttribute('content') ?? null;

  // ── Per-site structured extraction ──────────────────────────────────────────
  // Each branch returns the fields that site's phantom actually promises.
  const host = location.hostname.replace(/^www\./, '');
  const path = location.pathname.split('/').filter(Boolean);
  const q = (sel: string) => document.querySelector(sel)?.textContent?.trim() || null;
  let site: Record<string, unknown> | null = null;
  let records: Record<string, unknown>[] = [];

  try {
    if (host.includes('github.com') && path.length === 1) {
      site = {
        type: 'github_profile',
        username: path[0],
        name: q('.vcard-fullname') || q('[itemprop="name"]'),
        bio: q('.user-profile-bio') || q('[data-bio-text]'),
        company: q('[itemprop="worksFor"]'),
        location: q('[itemprop="homeLocation"]'),
        followers: q('a[href$="tab=followers"] .text-bold') || q('a[href*="followers"] span.text-bold'),
        following: q('a[href$="tab=following"] .text-bold') || q('a[href*="following"] span.text-bold'),
        repos: q('a[href$="tab=repositories"] .Counter') || q('[data-tab-item="repositories"] .Counter'),
        profileUrl: location.href,
      };
    } else if (host.includes('linkedin.com')) {
      let person: any = null;
      for (const block of jsonLd) {
        const arr = Array.isArray((block as any)?.['@graph']) ? (block as any)['@graph'] : [block];
        for (const o of arr) {
          if (o && (o['@type'] === 'Person')) person = o;
          if (o && o['@type'] === 'ProfilePage' && o.mainEntity) person = o.mainEntity;
        }
      }
      site = {
        type: 'linkedin_profile',
        name: person?.name || (og.title || '').replace(/ \| LinkedIn.*$/, '').trim() || q('h1'),
        headline: person?.jobTitle || person?.description || og.description || null,
        location: person?.address?.addressLocality || null,
        company: (Array.isArray(person?.worksFor) ? person.worksFor[0]?.name : person?.worksFor?.name) || null,
        profileUrl: location.href,
      };
    } else if (host.includes('instagram.com') && path.length >= 1) {
      const d = og.description || metaDesc || '';
      const m = d.match(/([\d,.]+[KMB]?)\s+Followers,\s+([\d,.]+[KMB]?)\s+Following,\s+([\d,.]+[KMB]?)\s+Posts/i);
      site = {
        type: 'instagram_profile',
        username: path[0],
        fullName: (og.title || '').replace(/\s*\(@.*$/, '').replace(/\s+on Instagram.*$/, '').trim(),
        followers: m?.[1] || null, following: m?.[2] || null, posts: m?.[3] || null,
        bio: d, profileUrl: location.href,
      };
    } else if (host.includes('google.') && location.pathname.includes('/maps')) {
      const seen = new Set<string>();
      for (const a of Array.from(document.querySelectorAll('a[href*="/maps/place/"]'))) {
        const name = a.getAttribute('aria-label');
        if (!name || seen.has(name)) continue;
        seen.add(name);
        const card = (a.closest('[role="article"]') as HTMLElement) || a.parentElement;
        const ct = card?.textContent || '';
        records.push({
          type: 'google_maps_place',
          name,
          phone: (ct.match(/\+?\d[\d\s().-]{7,}\d/) || [])[0] || null,
          rating: (ct.match(/([0-5][.,]\d)/) || [])[1] || null,
          mapsUrl: (a as HTMLAnchorElement).href,
        });
        if (records.length >= 40) break;
      }
    } else if (host.includes('producthunt.com')) {
      site = { type: 'product_hunt', title: og.title || document.title, description: og.description || metaDesc, url: location.href };
    }
  } catch { /* per-site extraction is best-effort */ }

  return {
    url: location.href,
    title: document.title ?? '',
    metaDescription: metaDesc,
    lang: document.documentElement.lang || null,
    canonical: abs(document.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? null),
    h1: Array.from(document.querySelectorAll('h1')).map(h => h.textContent?.trim()).filter(Boolean).slice(0, 5),
    emails: Array.from(emailSet).slice(0, 50),
    phones: Array.from(phoneSet).slice(0, 20),
    social,
    openGraph: og,
    jsonLd,
    site,
    records,
    textSnippet: text.replace(/\s+/g, ' ').trim().slice(0, 4000),
  };
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

        // HTTP-level block detection. LinkedIn returns 999; many sites 403/429.
        // A login-wall redirect also means we got no real data.
        const finalUrl = page.url();
        const loginWall = /\/(login|authwall|checkpoint|signin|sign-in)/i.test(finalUrl);
        if (status === 999 || status === 403 || status === 429 || status === 401 || loginWall) {
          const reason = loginWall ? 'login/auth wall' : `HTTP ${status} (anti-bot block)`;
          logger.warn({ attempt, status, url, finalUrl }, `Blocked: ${reason}`);
          this.pool.release(session.id);
          if (attempt < maxAttempts) { await this.antiBot.simulateHumanDelay(1000, 3000); continue; }
          return { html: '', status, attempts: attempt, proxyUsed: proxyUrl || undefined, blocked: true, blockReason: reason, url: finalUrl };
        }

        // Check for bot detection
        const botCheck = await this.antiBot.detectBotChallenge(page);

        if (botCheck.blocked) {
          logger.warn(
            { attempt, reason: botCheck.reason, url },
            'Bot challenge detected, attempting captcha solve'
          );

          if (botCheck.captchaType) {
            try {
              // Use the real 2captcha integration from stealth/captcha.ts
              const captchaType = await detectCaptcha(page);
              if (captchaType) {
                await solveCaptcha(page, captchaType);
                logger.info({ captchaType }, 'Captcha solved — re-checking page');
                const recheck = await this.antiBot.detectBotChallenge(page);
                if (!recheck.blocked) {
                  const html = await page.content();
                  let data: Record<string, unknown> | undefined;
                  try { data = await page.evaluate(pageExtractor); } catch { /* ignore */ }
                  this.pool.release(session.id);
                  return { html, status, attempts: attempt, proxyUsed: proxyUrl, blocked: false, url: page.url(), data };
                }
              }
            } catch (captchaErr) {
              logger.warn({ captchaErr }, 'Captcha solve failed — rotating fingerprint and retrying');
            }
          }

          this.pool.release(session.id);
          await this.antiBot.simulateHumanDelay(1000, 3000);
          continue;
        }

        // Try to auto-solve any captcha that appeared after navigation
        try { await solveIfPresent(page); } catch { /* non-fatal */ }

        // Human-like delay before extracting content
        await this.antiBot.simulateHumanDelay(500, 1500);

        const html = await page.content();
        // Structured extraction from the live page (same page that loaded).
        let data: Record<string, unknown> | undefined;
        try {
          data = await page.evaluate(pageExtractor);
        } catch (e) {
          logger.warn({ e, url }, 'structured extraction failed');
        }
        this.pool.release(session.id);

        return {
          html,
          status,
          attempts: attempt,
          proxyUsed: proxyUrl || undefined,
          blocked: false,
          url: page.url(),
          data,
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
