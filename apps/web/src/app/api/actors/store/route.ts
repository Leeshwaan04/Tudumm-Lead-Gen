import { NextResponse } from 'next/server'
import { auth } from '@/auth'

const STORE_ACTORS = [
  { slug: 'linkedin-scraper', name: 'LinkedIn Scraper', category: 'Social', description: 'Scrape LinkedIn profiles and company pages', price: 5, rating: 4.8, runs: 12400 },
  { slug: 'google-maps-scraper', name: 'Google Maps Scraper', category: 'Local', description: 'Extract business listings from Google Maps', price: 3, rating: 4.7, runs: 9800 },
  { slug: 'email-finder', name: 'Email Finder', category: 'Enrichment', description: 'Find verified email addresses for leads', price: 2, rating: 4.9, runs: 31200 },
  { slug: 'twitter-scraper', name: 'Twitter / X Scraper', category: 'Social', description: 'Scrape tweets, followers, and profile data', price: 4, rating: 4.5, runs: 7600 },
  { slug: 'github-scraper', name: 'GitHub Scraper', category: 'Developer', description: 'Find developers and open source contributors', price: 2, rating: 4.6, runs: 5400 },
  { slug: 'instagram-scraper', name: 'Instagram Scraper', category: 'Social', description: 'Extract Instagram profiles and followers', price: 4, rating: 4.4, runs: 8900 },
  { slug: 'web-scraper', name: 'Web Scraper', category: 'General', description: 'Generic website scraping with CSS selectors', price: 1, rating: 4.3, runs: 22100 },
  { slug: 'apollo-enricher', name: 'Apollo Enricher', category: 'Enrichment', description: 'Enrich leads using Apollo.io data', price: 6, rating: 4.7, runs: 15300 },
]

export async function GET(req: Request) {
  const session = await auth()
  const workspaceId = (session as any)?.workspaceId
  if (!workspaceId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category')
  const search = searchParams.get('search')?.toLowerCase()

  let actors = STORE_ACTORS
  if (category) actors = actors.filter(a => a.category === category)
  if (search) actors = actors.filter(a => a.name.toLowerCase().includes(search) || a.description.toLowerCase().includes(search))

  return NextResponse.json(actors)
}
