import type { MetadataRoute } from 'next'
import { prisma } from '@/lib/db'

const BASE = process.env.APP_URL ?? 'https://www.tudumm.in'

// Google discovers capture pages through this sitemap (it does not consume
// IndexNow). Fresh keyword pages appear here the moment they are created.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages = await prisma.capturePage
    .findMany({
      where: { published: true },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
      take: 5000,
    })
    .catch(() => [])

  return [
    { url: BASE, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    ...pages.map(p => ({
      url: `${BASE}/p/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    })),
  ]
}
