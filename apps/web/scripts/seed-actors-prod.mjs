// Production-safe seed: publishes the 8 marketplace actors ONLY.
// Unlike scripts/seed.mjs (dev), this creates NO demo/system login accounts
// with guessable passwords. The system owner gets a random, un-loginnable
// password hash so the published actors have a valid authorId/workspaceId.
// Idempotent: safe to re-run.

import { PrismaClient } from '@prisma/client'
import { randomBytes } from 'crypto'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

const ACTORS = [
  { name: 'LinkedIn Profile Scraper', slug: 'linkedin-profile-scraper', description: 'Extract LinkedIn profiles at scale. Get name, title, company, email, and more from search results.', categories: JSON.stringify(['Social Media', 'Lead Gen']), tags: JSON.stringify(['linkedin', 'profiles', 'b2b']), isPublic: true, status: 'PUBLISHED', totalRuns: 284920, rating: 4.8, ratingCount: 1243 },
  { name: 'Google Maps Extractor', slug: 'google-maps-extractor', description: 'Scrape business listings from Google Maps. Get name, address, phone, website, hours, and reviews.', categories: JSON.stringify(['Local Business', 'Lead Gen']), tags: JSON.stringify(['google-maps', 'local', 'business']), isPublic: true, status: 'PUBLISHED', totalRuns: 193847, rating: 4.7, ratingCount: 892 },
  { name: 'Email Finder', slug: 'email-finder', description: 'Find verified business emails using waterfall enrichment across 10+ data sources.', categories: JSON.stringify(['Enrichment', 'Email']), tags: JSON.stringify(['email', 'enrichment', 'verification']), isPublic: true, status: 'PUBLISHED', totalRuns: 421093, rating: 4.9, ratingCount: 2107 },
  { name: 'Twitter Search Scraper', slug: 'twitter-search', description: 'Extract tweets and user profiles from Twitter/X search results.', categories: JSON.stringify(['Social Media', 'Research']), tags: JSON.stringify(['twitter', 'x', 'social']), isPublic: true, status: 'PUBLISHED', totalRuns: 98234, rating: 4.3, ratingCount: 654 },
  { name: 'Instagram Scraper', slug: 'instagram-scraper', description: 'Scrape Instagram profiles, posts, followers, and hashtag results.', categories: JSON.stringify(['Social Media', 'Influencer']), tags: JSON.stringify(['instagram', 'influencer', 'social']), isPublic: true, status: 'PUBLISHED', totalRuns: 156789, rating: 4.5, ratingCount: 987 },
  { name: 'Apollo.io Enrichment', slug: 'apollo-enrichment', description: 'Enrich leads with Apollo.io data including emails, phone numbers, and company info.', categories: JSON.stringify(['Enrichment', 'B2B']), tags: JSON.stringify(['apollo', 'enrichment', 'b2b']), isPublic: true, status: 'PUBLISHED', totalRuns: 78923, rating: 4.6, ratingCount: 432 },
  { name: 'GitHub Profile Scraper', slug: 'github-profile-scraper', description: 'Extract developer profiles, repos, and contribution data from GitHub.', categories: JSON.stringify(['Developer', 'Tech']), tags: JSON.stringify(['github', 'developers', 'tech']), isPublic: true, status: 'PUBLISHED', totalRuns: 45123, rating: 4.4, ratingCount: 321 },
  { name: 'Web Scraper', slug: 'web-scraper', description: 'Generic website scraping. Auto-extracts emails, phones, social links, and structured data from any public URL.', categories: JSON.stringify(['General', 'Lead Gen']), tags: JSON.stringify(['web', 'scraper', 'general']), isPublic: true, status: 'PUBLISHED', totalRuns: 221100, rating: 4.3, ratingCount: 1567 },
  { name: 'Product Hunt Scraper', slug: 'product-hunt-scraper', description: 'Scrape product launches, makers, and upvote data from Product Hunt.', categories: JSON.stringify(['Research', 'SaaS']), tags: JSON.stringify(['producthunt', 'saas', 'startups']), isPublic: true, status: 'PUBLISHED', totalRuns: 34892, rating: 4.2, ratingCount: 234 },
]

async function main() {
  console.log('Seeding marketplace actors (prod-safe)…')

  // System workspace to own the published actors.
  let systemWorkspace = await prisma.workspace.findUnique({ where: { slug: 'tudumm-system' } })
  if (!systemWorkspace) {
    systemWorkspace = await prisma.workspace.create({
      data: { name: 'Tudumm System', slug: 'tudumm-system', plan: 'ENTERPRISE', creditBalance: 0 },
    })
    console.log('  Created system workspace')
  }

  // System owner with a RANDOM password hash — no usable login.
  let systemUser = await prisma.user.findUnique({ where: { email: 'system@tudumm.io' } })
  if (!systemUser) {
    const unusable = await bcrypt.hash(randomBytes(32).toString('hex'), 12)
    systemUser = await prisma.user.create({
      data: {
        name: 'Tudumm', email: 'system@tudumm.io',
        passwordHash: unusable, emailVerified: true,
        workspaceMembers: { create: { workspaceId: systemWorkspace.id, role: 'OWNER' } },
      },
    })
    console.log('  Created system owner (random un-loginnable password)')
  }

  let created = 0
  for (const actor of ACTORS) {
    const exists = await prisma.actor.findUnique({ where: { slug: actor.slug } })
    if (!exists) {
      await prisma.actor.create({ data: { ...actor, workspaceId: systemWorkspace.id, authorId: systemUser.id } })
      console.log(`  Created actor: ${actor.name}`)
      created++
    }
  }
  console.log(`Done. ${created} new actor(s); ${ACTORS.length - created} already present.`)
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
