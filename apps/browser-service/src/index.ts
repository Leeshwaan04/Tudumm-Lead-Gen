import express from 'express';
import { WebSocketServer } from 'ws';
import http from 'http';
import pino from 'pino';
import { BrowserPool } from './services/BrowserPool';
import { browserRouter } from './routes/browser';
import { cookieRouter } from './routes/cookie-injection';
import { setupCDPProxy } from './routes/cdp-proxy';
import { linkedinRouter } from './routes/linkedin';

const logger = pino({ name: 'browser-service' });
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });
const pool = BrowserPool.getInstance();

app.use(express.json());

// Main Browser Routes
app.use('/browser', browserRouter);
app.use('/browser/cookies', cookieRouter);
app.use('/linkedin', linkedinRouter);

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', sessions: pool.getStats() });
});

// Upgrade HTTP to WS for CDP proxying
server.on('upgrade', (request, socket, head) => {
  const { pathname } = new URL(request.url || '', `http://${request.headers.host}`);
  
  if (pathname.startsWith('/cdp/')) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

// Initialize CDP Proxy
setupCDPProxy(wss);

const PORT = process.env.PORT || 8007;
server.listen(PORT, () => {
  logger.info(`Browser Service listening on port ${PORT}`);
});

// Periodic cleanup of idle sessions
setInterval(() => pool.cleanup(), 60000);

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down...');
  const sessions = pool.getAllSessions();
  for (const s of sessions) {
    await pool.closeSession(s.id);
  }
  process.exit(0);
});
