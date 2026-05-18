import { Router, Request, Response } from 'express';
import axios from 'axios';
import { HttpProxyAgent } from 'http-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';
import pino from 'pino';
import { ProxyPool } from '../services/ProxyPool';
import { GeoRouter } from '../services/GeoRouter';
import { UsageMetering } from '../services/UsageMetering';

const router = Router();
const logger = pino({ name: 'proxy-routes' });
const pool = ProxyPool.getInstance();
const geoRouter = new GeoRouter();
const metering = new UsageMetering();

/**
 * Proxy Request Handler
 * POST /proxy
 * Body: { url, method, headers, data, userId }
 */
router.post('/', async (req: Request, res: Response) => {
  const { url, method = 'GET', headers = {}, data, userId = 'anonymous' } = req.body;

  if (!url) {
    res.status(400).json({ error: 'url is required' });
    return;
  }

  const country = await geoRouter.resolveTargetCountry(url);
  const proxy = pool.getProxy(country || undefined);

  logger.info({ url, proxy: proxy?.url, userId }, 'Routing proxy request');

  const axiosConfig: any = {
    url,
    method,
    headers,
    data,
    timeout: 30000,
    validateStatus: () => true, // Forward all status codes
  };

  if (proxy) {
    const agent = url.startsWith('https') 
      ? new HttpsProxyAgent(proxy.url)
      : new HttpProxyAgent(proxy.url);
    axiosConfig.httpAgent = agent;
    axiosConfig.httpsAgent = agent;
  }

  try {
    const startTime = Date.now();
    const response = await axios(axiosConfig);
    const duration = Date.now() - startTime;

    // Record usage
    const bytesSent = JSON.stringify(data || '').length;
    const bytesReceived = JSON.stringify(response.data || '').length;
    await metering.recordUsage(userId, bytesSent, bytesReceived);

    if (proxy) pool.reportSuccess(proxy.url);

    res.status(response.status).set(response.headers).send(response.data);
  } catch (err: any) {
    logger.error({ err, url, proxy: proxy?.url }, 'Proxy request failed');
    if (proxy) pool.reportFailure(proxy.url);

    res.status(502).json({ 
      error: 'Proxy request failed', 
      message: err.message,
      proxyUsed: !!proxy
    });
  }
});

export { router as proxyRouter };
