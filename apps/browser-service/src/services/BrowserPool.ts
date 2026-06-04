import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Browser, BrowserContext, Page } from 'playwright';
import { v4 as uuidv4 } from 'uuid';
import pino from 'pino';

const logger = pino({ name: 'browser-pool' });

// Add stealth plugin
chromium.use(StealthPlugin());

/**
 * Parse a proxy URL into Playwright's proxy shape. Residential providers use
 * `http://user:pass@host:port` — Playwright needs username/password as SEPARATE
 * fields (embedding them in `server` does NOT authenticate). This makes
 * PROXY_LIST plug-and-play for IPRoyal/Smartproxy/Oxylabs/etc.
 */
function parseProxy(raw: string): { server: string; username?: string; password?: string } | undefined {
  if (!raw) return undefined;
  try {
    const u = new URL(raw.includes('://') ? raw : `http://${raw}`);
    const server = `${u.protocol}//${u.host}`; // host includes port, no creds
    const out: { server: string; username?: string; password?: string } = { server };
    if (u.username) out.username = decodeURIComponent(u.username);
    if (u.password) out.password = decodeURIComponent(u.password);
    return out;
  } catch {
    // Fall back to passing it through as a bare server string.
    return { server: raw };
  }
}

export interface BrowserSession {
  id: string;
  browser: Browser;
  browserServer?: any; // Playwright BrowserServer type
  context: BrowserContext;
  page: Page;
  wsEndpoint: string;
  createdAt: number;
  lastUsedAt: number;
  status: 'active' | 'idle' | 'closed';
  memoryMb?: number;
  cpuPercent?: number;
}

export interface AcquireOptions {
  proxyUrl?: string;
  userAgent?: string;
  viewport?: { width: number; height: number };
}

export class BrowserPool {
  private static instance: BrowserPool;
  private sessions: Map<string, BrowserSession> = new Map();
  private maxInstances = parseInt(process.env.MAX_BROWSER_INSTANCES || '20');

  private constructor() {}

  public static getInstance(): BrowserPool {
    if (!BrowserPool.instance) {
      BrowserPool.instance = new BrowserPool();
    }
    return BrowserPool.instance;
  }

  async acquire(options: AcquireOptions = {}): Promise<BrowserSession> {
    // Try to find an idle session first
    if (this.sessions.size >= this.maxInstances) {
      const idleSession = Array.from(this.sessions.values()).find(s => s.status === 'idle');
      if (idleSession) {
        idleSession.status = 'active';
        idleSession.lastUsedAt = Date.now();
        return idleSession;
      }
      throw new Error('Max browser instances reached and no idle sessions available');
    }

    const id = uuidv4();
    
    // Launch server to get a stable WebSocket endpoint for CDP proxying
    const browserServer = await chromium.launchServer({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
      ],
      proxy: options.proxyUrl ? parseProxy(options.proxyUrl) : undefined,
    });

    const wsEndpoint = browserServer.wsEndpoint();
    const browser = await chromium.connect(wsEndpoint);

    const context = await browser.newContext({
      userAgent: options.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: options.viewport || { width: 1280, height: 720 },
    });

    const page = await context.newPage();
    
    // In Playwright, to get a CDP-compatible WS endpoint for an existing browser:
    // We can't easily get it for a local 'launch'.
    // So we'll use a placeholder or implement a local proxy if needed.
    // BUT, Playwright's `chromium.launchServer` is exactly what we need.
    
    // Let's stick to a simpler approach for now: sessions managed by us.
    // If the user wants a "CDP Gateway", they likely want to connect via our service.
    
    const session: BrowserSession = {
      id,
      browser,
      browserServer,
      context,
      page,
      wsEndpoint,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      status: 'active',
    };

    this.sessions.set(id, session);
    logger.info({ sessionId: id, proxy: !!options.proxyUrl }, 'Acquired new browser session');
    
    return session;
  }

  release(id: string): void {
    const session = this.sessions.get(id);
    if (session) {
      session.status = 'idle';
      session.lastUsedAt = Date.now();
      logger.debug({ sessionId: id }, 'Released browser session to pool');
    }
  }

  getSession(id: string): BrowserSession | undefined {
    const session = this.sessions.get(id);
    if (session) {
      session.lastUsedAt = Date.now();
    }
    return session;
  }

  getAllSessions(): BrowserSession[] {
    return Array.from(this.sessions.values());
  }

  async closeSession(id: string): Promise<void> {
    const session = this.sessions.get(id);
    if (session) {
      await session.browser.close();
      if (session.browserServer) {
        await session.browserServer.close();
      }
      this.sessions.delete(id);
      logger.info({ sessionId: id }, 'Closed browser session and server');
    }
  }

  getStats() {
    const sessions = this.getAllSessions();
    return {
      total: sessions.length,
      active: sessions.filter(s => s.status === 'active').length,
      idle: sessions.filter(s => s.status === 'idle').length,
      maxInstances: this.maxInstances,
    };
  }

  async cleanup(): Promise<void> {
    const idleTimeout = 5 * 60 * 1000; // 5 minutes
    const now = Date.now();

    for (const [id, session] of this.sessions.entries()) {
      if (now - session.lastUsedAt > idleTimeout) {
        logger.info({ sessionId: id }, 'Cleaning up idle session');
        await this.closeSession(id);
      }
    }
  }
}
