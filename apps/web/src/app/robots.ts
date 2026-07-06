import type { MetadataRoute } from 'next'

const BASE = process.env.APP_URL ?? 'https://www.tudumm.in'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/p/'],
        disallow: ['/api/', '/dashboard', '/settings', '/keywords', '/leads', '/phantoms', '/social', '/sequences', '/workflows'],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
  }
}
