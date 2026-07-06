import type { Metadata } from 'next'
import { prisma } from '@/lib/db'

const BASE = process.env.APP_URL ?? 'https://www.tudumm.in'

// The page itself is a client component; SEO metadata is served from this
// server layout so capture pages are indexable (title/description/OG/canonical).
export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params
  const page = await prisma.capturePage.findUnique({ where: { slug } }).catch(() => null)
  if (!page || !page.published) return { robots: { index: false, follow: false } }

  const title = page.headline
  const description = page.subheadline || page.leadMagnet
  const url = `${BASE}/p/${slug}`
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: { index: true, follow: true },
    openGraph: { title, description, url, type: 'website', siteName: 'Tudumm' },
    twitter: { card: 'summary', title, description },
  }
}

export default function CapturePageLayout({ children }: { children: React.ReactNode }) {
  return children
}
