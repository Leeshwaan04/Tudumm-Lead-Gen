import { Router, Request, Response } from 'express';
import pino from 'pino';
import { BrowserPool } from '../services/BrowserPool';
import { AntiBotEngine } from '../services/AntiBotEngine';
import { UnlockerService } from '../services/UnlockerService';

const router = Router();
const logger = pino({ name: 'browser-routes' });
const pool = BrowserPool.getInstance();
const antiBot = new AntiBotEngine();
const unlocker = new UnlockerService();

/**
 * POST /browser/sessions
 * Create a new managed browser session.
 */
router.post('/sessions', async (req: Request, res: Response) => {
  try {
    const { proxyUrl, userAgent, viewport } = req.body ?? {};
    const session = await pool.acquire({ proxyUrl, userAgent, viewport });
    await antiBot.applyStealthPatterns(session.page);

    res.status(201).json({
      sessionId: session.id,
      wsEndpoint: session.wsEndpoint,
      createdAt: session.createdAt,
      status: session.status,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err }, 'Failed to create session');
    res.status(503).json({ error: msg });
  }
});

/**
 * DELETE /browser/sessions/:id
 * Close a browser session.
 */
router.delete('/sessions/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const session = pool.getSession(id);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  await pool.closeSession(id);
  res.json({ success: true, sessionId: id });
});

/**
 * GET /browser/sessions
 * List active sessions + memory/CPU usage.
 */
router.get('/sessions', (_req: Request, res: Response) => {
  const sessions = pool.getAllSessions().map(s => ({
    sessionId: s.id,
    status: s.status,
    createdAt: s.createdAt,
    lastUsedAt: s.lastUsedAt,
    wsEndpoint: s.wsEndpoint,
    memoryMb: s.memoryMb,
    cpuPercent: s.cpuPercent,
  }));

  const stats = pool.getStats();
  res.json({ sessions, stats });
});

/**
 * POST /browser/screenshot
 * Navigate to a URL and return a PNG screenshot as base64.
 * Body: { url, proxyUrl?, cookies? }
 */
router.post('/screenshot', async (req: Request, res: Response) => {
  const { url, proxyUrl, cookies } = req.body ?? {};

  if (!url) {
    res.status(400).json({ error: 'url is required' });
    return;
  }

  let session = await pool.acquire({ proxyUrl }).catch(() => null);
  if (!session) {
    session = await pool.acquire();
  }

  try {
    await antiBot.applyStealthPatterns(session.page);

    if (cookies?.length) {
      await session.context.addCookies(cookies);
    }

    await session.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await antiBot.simulateHumanDelay(500, 1500);

    const screenshotBuffer = await session.page.screenshot({
      type: 'png',
      fullPage: false,
    });

    pool.release(session.id);

    res.json({
      url: session.page.url(),
      screenshot: screenshotBuffer.toString('base64'),
      mimeType: 'image/png',
      sessionId: session.id,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err, url }, 'Screenshot failed');
    await pool.closeSession(session.id);
    res.status(500).json({ error: msg });
  }
});

/**
 * POST /browser/scrape
 * Scrape a URL, optionally running a custom extraction script.
 * Body: { url, waitFor?, proxyUrl?, cookies?, extractScript? }
 */
router.post('/scrape', async (req: Request, res: Response) => {
  const { url, waitFor = 'domcontentloaded', proxyUrl, cookies, extractScript, screenshot } =
    req.body ?? {};

  if (!url) {
    res.status(400).json({ error: 'url is required' });
    return;
  }

  try {
    const result = await unlocker.unlock(url, {
      proxyUrl,
      cookies,
      waitFor,
    });

    let extracted: unknown = null;
    if (extractScript && !result.blocked) {
      const session = pool.getSession(
        pool
          .getAllSessions()
          .find(s => s.status === 'idle')?.id ?? ''
      );
      if (session) {
        try {
          extracted = await session.page.evaluate(extractScript);
        } catch (evalErr) {
          logger.warn({ evalErr }, 'extractScript evaluation failed');
        }
      }
    }

    // Get a screenshot if requested
    let screenshotBase64: string | undefined;
    if (screenshot) {
      const activeSessions = pool.getAllSessions().filter(s => s.status === 'idle');
      if (activeSessions.length > 0) {
        const buf = await activeSessions[0].page.screenshot({ type: 'png' }).catch(() => null);
        screenshotBase64 = buf?.toString('base64');
      }
    }

    // Strip tags for plain text
    const text = result.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

    res.json({
      url: result.url,
      html: result.html,
      text,
      screenshot: screenshotBase64,
      extracted,
      status: result.status,
      attempts: result.attempts,
      blocked: result.blocked,
      proxyUsed: result.proxyUsed,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err, url }, 'Scrape failed');
    res.status(500).json({ error: msg });
  }
});

export { router as browserRouter };
