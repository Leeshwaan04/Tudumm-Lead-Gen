import { Router, Request, Response } from 'express';
import pino from 'pino';
import { BrowserPool } from '../services/BrowserPool';

const router = Router();
const logger = pino({ name: 'cookie-injection' });
const pool = BrowserPool.getInstance();

type Platform = 'linkedin' | 'instagram' | 'twitter';

interface PlatformConfig {
  domain: string;
  cookieName: string;
  verifyUrl: string;
  authSelectors: string[];
  profileSelectors: {
    name?: string;
    username?: string;
    avatar?: string;
  };
}

const PLATFORM_CONFIGS: Record<Platform, PlatformConfig> = {
  linkedin: {
    domain: '.linkedin.com',
    cookieName: 'li_at',
    verifyUrl: 'https://www.linkedin.com/feed/',
    authSelectors: ['.global-nav__me-photo', '.nav-item__profile-member-photo'],
    profileSelectors: {
      name: '.nav-item__title',
      avatar: '.global-nav__me-photo',
    },
  },
  instagram: {
    domain: '.instagram.com',
    cookieName: 'sessionid',
    verifyUrl: 'https://www.instagram.com/',
    authSelectors: ['[aria-label="Home"]', 'nav svg[aria-label="Home"]'],
    profileSelectors: {
      username: 'header section a',
    },
  },
  twitter: {
    domain: '.twitter.com',
    cookieName: 'auth_token',
    verifyUrl: 'https://twitter.com/home',
    authSelectors: ['[data-testid="SideNav_AccountSwitcher_Button"]', '[aria-label="Home"]'],
    profileSelectors: {
      name: '[data-testid="UserName"] span',
      username: '[data-testid="UserName"] span:last-child',
      avatar: '[data-testid="SideNav_AccountSwitcher_Button"] img',
    },
  },
};

/**
 * POST /browser/inject-cookie
 * Inject a session cookie into a browser session and verify authentication.
 * Body: { platform: 'linkedin'|'instagram'|'twitter', cookie: string, sessionId }
 */
router.post('/inject-cookie', async (req: Request, res: Response) => {
  const { platform, cookie, sessionId } = req.body ?? {};

  if (!platform || !cookie || !sessionId) {
    res.status(400).json({ error: 'platform, cookie, and sessionId are required' });
    return;
  }

  if (!['linkedin', 'instagram', 'twitter'].includes(platform)) {
    res.status(400).json({ error: 'platform must be one of: linkedin, instagram, twitter' });
    return;
  }

  const session = pool.getSession(sessionId);
  if (!session) {
    res.status(404).json({ error: `Session ${sessionId} not found` });
    return;
  }

  const config = PLATFORM_CONFIGS[platform as Platform];

  try {
    // Inject the session cookie
    await session.context.addCookies([
      {
        name: config.cookieName,
        value: cookie,
        domain: config.domain,
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'None',
      },
    ]);

    logger.info({ platform, sessionId }, 'Cookie injected, verifying authentication');

    // Navigate to the verification URL
    await session.page.goto(config.verifyUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });

    // Wait a moment for dynamic content
    await new Promise<void>(r => setTimeout(r, 2000));

    // Check for authenticated state by looking for auth selectors
    let authenticated = false;
    for (const selector of config.authSelectors) {
      try {
        await session.page.waitForSelector(selector, { timeout: 5000 });
        authenticated = true;
        break;
      } catch {
        // Try next selector
      }
    }

    // Extract profile info if authenticated
    let profile: Record<string, string | null> = {};
    if (authenticated) {
      for (const [key, selector] of Object.entries(config.profileSelectors)) {
        if (!selector) continue;
        profile[key] = await session.page
          .locator(selector)
          .first()
          .getAttribute(key === 'avatar' ? 'src' : 'textContent')
          .catch(async () => {
            return session.page.locator(selector).first().innerText().catch(() => null);
          });
      }
    }

    res.json({
      authenticated,
      platform,
      sessionId,
      profile: authenticated ? profile : undefined,
      currentUrl: session.page.url(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err, platform, sessionId }, 'Cookie injection failed');
    res.status(500).json({ error: msg });
  }
});

export { router as cookieRouter };
