import axios from 'axios';
import pino from 'pino';

const logger = pino({ name: 'geo-router' });

export class GeoRouter {
  /**
   * Determine the target country for a given URL.
   * This could be based on TLD (.co.uk -> GB) or historical data.
   */
  async resolveTargetCountry(url: string): Promise<string | null> {
    try {
      const hostname = new URL(url).hostname;
      const tld = hostname.split('.').pop();

      const tldMap: Record<string, string> = {
        'uk': 'GB',
        'fr': 'FR',
        'de': 'DE',
        'in': 'IN',
        'cn': 'CN',
        'jp': 'JP',
      };

      return tldMap[tld || ''] || null;
    } catch (err) {
      logger.error({ err, url }, 'Failed to resolve target country');
      return null;
    }
  }

  /**
   * Check if a proxy is needed for this request.
   */
  shouldUseProxy(url: string): boolean {
    const internalDomains = ['tudumm.local', 'localhost'];
    const hostname = new URL(url).hostname;
    return !internalDomains.some(d => hostname.includes(d));
  }
}
