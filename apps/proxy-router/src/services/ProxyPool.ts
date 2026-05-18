import pino from 'pino';

const logger = pino({ name: 'proxy-pool' });

export interface Proxy {
  url: string;
  country: string;
  provider: string;
  lastUsed: number;
  failureCount: number;
}

export class ProxyPool {
  private static instance: ProxyPool;
  private proxies: Proxy[] = [];

  private constructor() {
    // Initial proxies from environment or config
    const rawProxies = process.env.PROXY_LIST?.split(',') || [];
    this.proxies = rawProxies.map(url => ({
      url,
      country: 'unknown',
      provider: 'default',
      lastUsed: 0,
      failureCount: 0,
    }));
  }

  public static getInstance(): ProxyPool {
    if (!ProxyPool.instance) {
      ProxyPool.instance = new ProxyPool();
    }
    return ProxyPool.instance;
  }

  getProxy(country?: string): Proxy | null {
    let candidates = this.proxies.filter(p => p.failureCount < 5);
    
    if (country) {
      const geoCandidates = candidates.filter(p => p.country === country);
      if (geoCandidates.length > 0) {
        candidates = geoCandidates;
      }
    }

    if (candidates.length === 0) return null;

    // Least recently used
    const proxy = candidates.sort((a, b) => a.lastUsed - b.lastUsed)[0];
    proxy.lastUsed = Date.now();
    return proxy;
  }

  reportFailure(url: string) {
    const proxy = this.proxies.find(p => p.url === url);
    if (proxy) {
      proxy.failureCount++;
      logger.warn({ url, failureCount: proxy.failureCount }, 'Proxy failure reported');
    }
  }

  reportSuccess(url: string) {
    const proxy = this.proxies.find(p => p.url === url);
    if (proxy) {
      proxy.failureCount = 0;
    }
  }

  addProxy(proxy: Proxy) {
    this.proxies.push(proxy);
  }
}
