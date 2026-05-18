import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import pino from 'pino';
import { BrowserPool } from '../services/BrowserPool';

const logger = pino({ name: 'cdp-proxy' });

/**
 * Setup CDP WebSocket proxy.
 *
 * External Playwright/Puppeteer code can connect to:
 *   ws://browser-service/cdp/{sessionId}
 *
 * This handler proxies all CDP messages to the actual Chromium DevTools WebSocket
 * exposed by the managed browser session.
 */
export function setupCDPProxy(wss: WebSocketServer): void {
  const pool = BrowserPool.getInstance();

  wss.on('connection', (clientWs: WebSocket, req: IncomingMessage) => {
    const url = req.url ?? '';
    // Expected path: /cdp/{sessionId}
    const match = url.match(/^\/cdp\/([^/?]+)/);
    if (!match) {
      logger.warn({ url }, 'Invalid CDP proxy path');
      clientWs.close(4000, 'Invalid path. Expected /cdp/{sessionId}');
      return;
    }

    const sessionId = match[1];
    const session = pool.getSession(sessionId);

    if (!session) {
      logger.warn({ sessionId }, 'Session not found for CDP proxy');
      clientWs.close(4004, `Session ${sessionId} not found`);
      return;
    }

    const wsEndpoint = session.wsEndpoint;
    logger.info({ sessionId, wsEndpoint }, 'CDP proxy connection established');

    // Connect to the actual Chromium DevTools WebSocket
    const chromiumWs = new WebSocket(wsEndpoint);

    chromiumWs.on('open', () => {
      logger.debug({ sessionId }, 'Connected to Chromium DevTools WebSocket');
    });

    // Forward messages: client → Chromium
    clientWs.on('message', (data) => {
      if (chromiumWs.readyState === WebSocket.OPEN) {
        chromiumWs.send(data);
      } else {
        logger.warn({ sessionId }, 'Chromium WS not open, dropping message');
      }
    });

    // Forward messages: Chromium → client
    chromiumWs.on('message', (data) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(data);
      }
    });

    // Handle Chromium WS errors
    chromiumWs.on('error', (err) => {
      logger.error({ err, sessionId }, 'Chromium WS error');
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.close(1011, 'Chromium WebSocket error');
      }
    });

    // Handle Chromium WS close
    chromiumWs.on('close', (code, reason) => {
      logger.info({ sessionId, code }, 'Chromium WS closed');
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.close(code, reason);
      }
    });

    // Handle client WS close
    clientWs.on('close', (code, reason) => {
      logger.info({ sessionId, code }, 'Client WS closed');
      if (chromiumWs.readyState === WebSocket.OPEN) {
        chromiumWs.close(code, reason);
      }
      // Return session to pool
      pool.release(sessionId);
    });

    // Handle client WS errors
    clientWs.on('error', (err) => {
      logger.error({ err, sessionId }, 'Client WS error');
      if (chromiumWs.readyState === WebSocket.OPEN) {
        chromiumWs.close(1011, 'Client error');
      }
    });
  });

  logger.info('CDP proxy WebSocket handler registered on /cdp/{sessionId}');
}
