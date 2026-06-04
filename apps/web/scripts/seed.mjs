import { PrismaClient } from '@prisma/client'
import { createHash, randomBytes } from 'crypto'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

const DEMO_ACTORS = [
  { name: 'LinkedIn Profile Scraper', slug: 'linkedin-profile-scraper', description: 'Extract LinkedIn profiles at scale. Get name, title, company, email, and more from search results.', categories: JSON.stringify(['Social Media', 'Lead Gen']), tags: JSON.stringify(['linkedin', 'profiles', 'b2b']), isPublic: true, status: 'PUBLISHED', totalRuns: 0, rating: 0, ratingCount: 0 },
  { name: 'Google Maps Extractor', slug: 'google-maps-extractor', description: 'Scrape business listings from Google Maps. Get name, address, phone, website, hours, and reviews.', categories: JSON.stringify(['Local Business', 'Lead Gen']), tags: JSON.stringify(['google-maps', 'local', 'business']), isPublic: true, status: 'PUBLISHED', totalRuns: 0, rating: 0, ratingCount: 0 },
  { name: 'Email Finder', slug: 'email-finder', description: 'Find verified business emails using waterfall enrichment across 10+ data sources.', categories: JSON.stringify(['Enrichment', 'Email']), tags: JSON.stringify(['email', 'enrichment', 'verification']), isPublic: true, status: 'PUBLISHED', totalRuns: 0, rating: 0, ratingCount: 0 },
  { name: 'Twitter Search Scraper', slug: 'twitter-search', description: 'Extract tweets and user profiles from Twitter/X search results.', categories: JSON.stringify(['Social Media', 'Research']), tags: JSON.stringify(['twitter', 'x', 'social']), isPublic: true, status: 'PUBLISHED', totalRuns: 0, rating: 0, ratingCount: 0 },
  { name: 'Instagram Scraper', slug: 'instagram-scraper', description: 'Scrape Instagram profiles, posts, followers, and hashtag results.', categories: JSON.stringify(['Social Media', 'Influencer']), tags: JSON.stringify(['instagram', 'influencer', 'social']), isPublic: true, status: 'PUBLISHED', totalRuns: 0, rating: 0, ratingCount: 0 },
  { name: 'Apollo.io Enrichment', slug: 'apollo-enrichment', description: 'Enrich leads with Apollo.io data including emails, phone numbers, and company info.', categories: JSON.stringify(['Enrichment', 'B2B']), tags: JSON.stringify(['apollo', 'enrichment', 'b2b']), isPublic: true, status: 'PUBLISHED', totalRuns: 0, rating: 0, ratingCount: 0 },
  { name: 'GitHub Profile Scraper', slug: 'github-profile-scraper', description: 'Extract developer profiles, repos, and contribution data from GitHub.', categories: JSON.stringify(['Developer', 'Tech']), tags: JSON.stringify(['github', 'developers', 'tech']), isPublic: true, status: 'PUBLISHED', totalRuns: 0, rating: 0, ratingCount: 0 },
  { name: 'Product Hunt Scraper', slug: 'product-hunt-scraper', description: 'Scrape product launches, makers, and upvote data from Product Hunt.', categories: JSON.stringify(['Research', 'SaaS']), tags: JSON.stringify(['producthunt', 'saas', 'startups']), isPublic: true, status: 'PUBLISHED', totalRuns: 0, rating: 0, ratingCount: 0 },
]

async function main() {
  console.log('Seeding database...')

  // System workspace
  let systemWorkspace = await prisma.workspace.findUnique({ where: { slug: 'tudumm-system' } })
  if (!systemWorkspace) {
    systemWorkspace = await prisma.workspace.create({
      data: { name: 'Tudumm System', slug: 'tudumm-system', plan: 'ENTERPRISE', creditBalance: 999999999 },
    })
  }

  // System user
  let systemUser = await prisma.user.findUnique({ where: { email: 'system@tudumm.io' } })
  if (!systemUser) {
    systemUser = await prisma.user.create({
      data: {
        name: 'Tudumm', email: 'system@tudumm.io',
        passwordHash: await bcrypt.hash('system', 12), emailVerified: true,
        workspaceMembers: { create: { workspaceId: systemWorkspace.id, role: 'OWNER' } },
      },
    })
  }

  // Public actors
  for (const actor of DEMO_ACTORS) {
    const exists = await prisma.actor.findUnique({ where: { slug: actor.slug } })
    if (!exists) {
      await prisma.actor.create({
        data: { ...actor, workspaceId: systemWorkspace.id, authorId: systemUser.id },
      })
      console.log(`  Created actor: ${actor.name}`)
    }
  }

  // Demo user + workspace
  const demoEmail = 'demo@tudumm.io'
  let demoUser = await prisma.user.findUnique({ where: { email: demoEmail } })
  let demoWorkspaceId
  if (!demoUser) {
    const demoWorkspace = await prisma.workspace.create({
      data: { name: "Demo Workspace", slug: 'demo-workspace', plan: 'GROW', creditBalance: 45280, execHoursLimit: 80, slots: 15, aiCredits: 8900, emailCredits: 2400 },
    })
    demoWorkspaceId = demoWorkspace.id
    demoUser = await prisma.user.create({
      data: {
        name: 'Demo User', email: demoEmail,
        passwordHash: await bcrypt.hash('demo1234', 12), emailVerified: true,
        workspaceMembers: { create: { workspaceId: demoWorkspace.id, role: 'OWNER' } },
      },
    })
    console.log(`  Created demo user: ${demoEmail} / demo1234`)

    // Seed some runs and datasets for demo
    const liActor = await prisma.actor.findUnique({ where: { slug: 'linkedin-profile-scraper' } })
    const gmActor = await prisma.actor.findUnique({ where: { slug: 'google-maps-extractor' } })
    if (liActor && gmActor) {
      const run1 = await prisma.run.create({
        data: {
          workspaceId: demoWorkspace.id, actorId: liActor.id, status: 'SUCCEEDED',
          startedAt: new Date(Date.now() - 2*3600000), finishedAt: new Date(Date.now() - 1.5*3600000),
          durationMs: 300000, creditsCost: 12,
          output: JSON.stringify({ itemsScraped: 247 }),
        },
      })
      await prisma.runLog.createMany({ data: [
        { runId: run1.id, level: 'INFO', message: 'Actor started' },
        { runId: run1.id, level: 'INFO', message: 'Navigating to linkedin.com/search/results/people' },
        { runId: run1.id, level: 'INFO', message: 'Found 247 profiles on page 1' },
        { runId: run1.id, level: 'WARN', message: 'Rate limit detected — backing off 3s' },
        { runId: run1.id, level: 'INFO', message: 'Pushed 247 items to dataset' },
        { runId: run1.id, level: 'INFO', message: 'Actor finished successfully' },
      ]})
      await prisma.dataset.create({
        data: { workspaceId: demoWorkspace.id, runId: run1.id, name: 'LinkedIn Profiles Jan 2024', itemCount: 247, sizeBytes: 1258291, s3Key: `datasets/${demoWorkspace.id}/${run1.id}/data.json` },
      })

      const run2 = await prisma.run.create({
        data: {
          workspaceId: demoWorkspace.id, actorId: gmActor.id, status: 'SUCCEEDED',
          startedAt: new Date(Date.now() - 26*3600000), finishedAt: new Date(Date.now() - 25.8*3600000),
          durationMs: 900000, creditsCost: 24,
          output: JSON.stringify({ itemsScraped: 512 }),
        },
      })
      await prisma.dataset.create({
        data: { workspaceId: demoWorkspace.id, runId: run2.id, name: 'Google Maps NYC Restaurants', itemCount: 512, sizeBytes: 2201472, s3Key: `datasets/${demoWorkspace.id}/${run2.id}/data.json` },
      })

      // Credit transactions
      await prisma.creditTransaction.createMany({ data: [
        { workspaceId: demoWorkspace.id, type: 'CREDIT', amount: 50000, balanceBefore: 0, balanceAfter: 50000, description: 'Initial credit grant — GROW plan', runId: null },
        { workspaceId: demoWorkspace.id, type: 'DEBIT', amount: 12, balanceBefore: 50000, balanceAfter: 49988, description: 'Actor run: linkedin-profile-scraper', runId: run1.id },
        { workspaceId: demoWorkspace.id, type: 'DEBIT', amount: 24, balanceBefore: 49988, balanceAfter: 49964, description: 'Actor run: google-maps-extractor', runId: run2.id },
      ]})

      // Schedule
      await prisma.schedule.create({
        data: { workspaceId: demoWorkspace.id, actorId: liActor.id, name: 'Daily LinkedIn Scrape', cronExpr: '0 9 * * 1-5', timezone: 'Asia/Calcutta', status: 'ACTIVE', nextRunAt: new Date(Date.now() + 16*3600000) },
      })

      // API key
      const raw = `tud_live_${randomBytes(16).toString('hex')}`
      await prisma.apiKey.create({
        data: { workspaceId: demoWorkspace.id, name: 'Production', keyHash: createHash('sha256').update(raw).digest('hex'), keyPrefix: raw.slice(0, 14), scopes: JSON.stringify(['read', 'write', 'actor:run']) },
      })
    }
  }

  // Seed lead gen data for demo workspace
  if (demoWorkspaceId) {
    await seedLeadData(demoWorkspaceId)
  } else {
    // Workspace already existed — resolve the id
    const existingWorkspace = await prisma.workspace.findUnique({ where: { slug: 'demo-workspace' } })
    if (existingWorkspace) await seedLeadData(existingWorkspace.id)
  }

  // Seed new models for demo workspace
  const demoWs = await prisma.workspace.findUnique({ where: { slug: 'demo-workspace' } })
  if (demoWs) {
    await seedNewModels(demoWs.id)
  }

  console.log('✅ Seed complete')
}

async function seedLeadData(demoWorkspaceId) {
  // Guard: skip if LeadLists already seeded
  const existingCount = await prisma.leadList.count({ where: { workspaceId: demoWorkspaceId } })
  if (existingCount > 0) {
    console.log('  Lead data already seeded — skipping')
    return
  }

  // 1. Create LeadLists
  const list1 = await prisma.leadList.create({
    data: {
      workspaceId: demoWorkspaceId,
      name: 'LinkedIn — VP Engineering (US)',
      description: 'VP and Director of Engineering at US-based SaaS companies scraped from LinkedIn',
      source: 'linkedin',
      leadCount: 7,
    },
  })
  const list2 = await prisma.leadList.create({
    data: {
      workspaceId: demoWorkspaceId,
      name: 'Google Maps — NYC Restaurants',
      description: 'Restaurant owners and GMs in New York City sourced from Google Maps',
      source: 'google-maps',
      leadCount: 5,
    },
  })
  console.log('  Created 2 LeadLists')

  // 2. Create 12 Leads
  const leadsData = [
    // List 1 — LinkedIn VP Engineering
    {
      workspaceId: demoWorkspaceId, listId: list1.id,
      firstName: 'Jordan', lastName: 'Hayes', fullName: 'Jordan Hayes',
      title: 'VP Engineering', company: 'Clarityx', companyDomain: 'clarityx.io',
      email: 'jordan.hayes@clarityx.io', emailStatus: 'VERIFIED',
      linkedinUrl: 'https://linkedin.com/in/jordan-hayes-clarityx',
      location: 'San Francisco, CA', industry: 'SaaS', companySize: '51-200',
      icpScore: 92,
      aiSummary: 'Jordan leads a 22-person eng team at Clarityx, a Series B workflow automation SaaS. Previously at Stripe and Segment. Active on LinkedIn — posts about eng culture, hiring, and distributed systems.',
      outreachAngle: 'Reference their recent post on async engineering culture. Ask how they handle cross-timezone code reviews at scale.',
      source: 'linkedin', tags: JSON.stringify(['vp-eng', 'series-b', 'sf']),
    },
    {
      workspaceId: demoWorkspaceId, listId: list1.id,
      firstName: 'Priya', lastName: 'Nair', fullName: 'Priya Nair',
      title: 'CTO', company: 'Stacklane', companyDomain: 'stacklane.com',
      email: 'priya@stacklane.com', emailStatus: 'VERIFIED',
      linkedinUrl: 'https://linkedin.com/in/priya-nair-cto',
      twitterUrl: 'https://twitter.com/priyanair_eng',
      location: 'New York, NY', industry: 'DevTools', companySize: '11-50',
      icpScore: 88,
      aiSummary: 'CTO at Stacklane (seed-stage DevTools startup). Ex-Google engineer. Building a developer observability platform. Actively hiring senior engineers.',
      outreachAngle: 'Mention their open DevTools position and offer help sourcing senior engineers from the LinkedIn dataset.',
      source: 'linkedin', tags: JSON.stringify(['cto', 'devtools', 'seed']),
    },
    {
      workspaceId: demoWorkspaceId, listId: list1.id,
      firstName: 'Marcus', lastName: 'Delgado', fullName: 'Marcus Delgado',
      title: 'Director of Engineering', company: 'Revflow', companyDomain: 'revflow.ai',
      email: 'mdelgado@revflow.ai', emailStatus: 'VERIFIED',
      linkedinUrl: 'https://linkedin.com/in/marcus-delgado-revflow',
      location: 'Austin, TX', industry: 'AI/ML', companySize: '201-500',
      icpScore: 85,
      aiSummary: 'Marcus manages platform infra at Revflow, a revenue intelligence SaaS. Background in MLOps. Focuses on data pipelines and model deployment.',
      outreachAngle: 'Lead with MLOps — ask how they handle model versioning and drift at their data volume.',
      source: 'linkedin', tags: JSON.stringify(['director-eng', 'ai-ml', 'austin']),
    },
    {
      workspaceId: demoWorkspaceId, listId: list1.id,
      firstName: 'Sara', lastName: 'Kim', fullName: 'Sara Kim',
      title: 'VP Engineering', company: 'Loopwise', companyDomain: 'loopwise.co',
      email: 'sara.kim@loopwise.co', emailStatus: 'RISKY',
      linkedinUrl: 'https://linkedin.com/in/sara-kim-loopwise',
      location: 'Seattle, WA', industry: 'SaaS', companySize: '11-50',
      icpScore: 78,
      aiSummary: 'VP Eng at Loopwise, a customer feedback SaaS. Previously at Intercom. Team of 8. Recently shipped a major product redesign.',
      outreachAngle: 'Connect over their Intercom background — ask how feedback tooling has evolved from the inside.',
      source: 'linkedin', tags: JSON.stringify(['vp-eng', 'saas', 'seattle']),
    },
    {
      workspaceId: demoWorkspaceId, listId: list1.id,
      firstName: 'Ethan', lastName: 'Ross', fullName: 'Ethan Ross',
      title: 'Head of Growth Engineering', company: 'Driftbase', companyDomain: 'driftbase.io',
      email: 'ethan@driftbase.io', emailStatus: 'VERIFIED',
      linkedinUrl: 'https://linkedin.com/in/ethan-ross-driftbase',
      twitterUrl: 'https://twitter.com/ethanross_eng',
      location: 'Los Angeles, CA', industry: 'MarTech', companySize: '51-200',
      icpScore: 81,
      aiSummary: 'Ethan bridges product and growth at Driftbase, a MarTech SaaS. Focuses on experimentation infra and conversion optimization.',
      outreachAngle: 'Ask about their A/B testing stack — specifically how they handle experiment isolation at scale.',
      source: 'linkedin', tags: JSON.stringify(['growth-eng', 'martech', 'la']),
    },
    {
      workspaceId: demoWorkspaceId, listId: list1.id,
      firstName: 'Natasha', lastName: 'Ivanova', fullName: 'Natasha Ivanova',
      title: 'Director of Sales Engineering', company: 'Quantra', companyDomain: 'quantra.com',
      email: 'n.ivanova@quantra.com', emailStatus: 'VERIFIED',
      linkedinUrl: 'https://linkedin.com/in/natasha-ivanova-quantra',
      location: 'Chicago, IL', industry: 'FinTech', companySize: '201-500',
      icpScore: 74,
      aiSummary: 'Natasha leads sales engineering at Quantra, a fintech SaaS. Manages a team of 12 SEs. Strong in technical demo creation and enterprise deal support.',
      outreachAngle: 'Offer a LinkedIn scraper tailored to finding enterprise fintech buyers matching her ICP.',
      source: 'linkedin', tags: JSON.stringify(['sales-eng', 'fintech', 'chicago']),
    },
    {
      workspaceId: demoWorkspaceId, listId: list1.id,
      firstName: 'Leo', lastName: 'Park', fullName: 'Leo Park',
      title: 'Founder & CEO', company: 'Nudge.so', companyDomain: 'nudge.so',
      email: null, emailStatus: 'NOT_FOUND',
      linkedinUrl: 'https://linkedin.com/in/leo-park-nudge',
      githubUrl: 'https://github.com/leopark',
      location: 'San Francisco, CA', industry: 'SaaS', companySize: '1-10',
      icpScore: 67,
      aiSummary: 'Solo founder building Nudge.so, a user onboarding tool. Ex-YC batch W23. Actively growing — 300 GitHub stars in 2 months.',
      outreachAngle: 'Offer a free run of the GitHub scraper to identify early adopters of competing onboarding tools.',
      source: 'linkedin', tags: JSON.stringify(['founder', 'yc', 'early-stage']),
    },

    // List 2 — Google Maps NYC Restaurants
    {
      workspaceId: demoWorkspaceId, listId: list2.id,
      firstName: 'Tony', lastName: 'Ferrara', fullName: 'Tony Ferrara',
      title: 'Owner', company: 'Ferrara Cucina', companyDomain: null,
      email: 'tony@ferraracucina.com', emailStatus: 'VERIFIED',
      phone: '+12125550192', phoneStatus: 'VERIFIED',
      location: 'Brooklyn, NY', industry: 'Restaurant', companySize: '1-10',
      icpScore: 71,
      aiSummary: 'Tony runs a family Italian restaurant in Williamsburg. 4.7 stars, 800+ Google reviews. Looking for catering software based on his recent Google search activity.',
      outreachAngle: 'Lead with his Google rating — congratulate then pitch how our data tools can help him find catering leads.',
      source: 'google-maps', tags: JSON.stringify(['restaurant', 'brooklyn', 'italian']),
    },
    {
      workspaceId: demoWorkspaceId, listId: list2.id,
      firstName: 'Amy', lastName: 'Chen', fullName: 'Amy Chen',
      title: 'General Manager', company: 'Golden Wok NYC', companyDomain: null,
      email: 'info@goldenwoknyc.com', emailStatus: 'RISKY',
      phone: '+12125550308', phoneStatus: 'VERIFIED',
      location: 'Manhattan, NY', industry: 'Restaurant', companySize: '1-10',
      icpScore: 63,
      source: 'google-maps', tags: JSON.stringify(['restaurant', 'manhattan', 'chinese']),
    },
    {
      workspaceId: demoWorkspaceId, listId: list2.id,
      firstName: 'Diego', lastName: 'Reyes', fullName: 'Diego Reyes',
      title: 'Owner & Chef', company: 'Casa Reyes', companyDomain: null,
      email: 'diego@casareyesnyc.com', emailStatus: 'VERIFIED',
      phone: '+17185550441', phoneStatus: 'VERIFIED',
      location: 'Queens, NY', industry: 'Restaurant', companySize: '1-10',
      icpScore: 69,
      source: 'google-maps', tags: JSON.stringify(['restaurant', 'queens', 'mexican']),
    },
    {
      workspaceId: demoWorkspaceId, listId: list2.id,
      firstName: 'Hannah', lastName: 'Osei', fullName: 'Hannah Osei',
      title: 'Co-Owner', company: 'Abena Kitchen', companyDomain: null,
      email: null, emailStatus: 'NOT_FOUND',
      phone: '+17185550872', phoneStatus: 'VERIFIED',
      location: 'The Bronx, NY', industry: 'Restaurant', companySize: '1-10',
      icpScore: 60,
      source: 'google-maps', tags: JSON.stringify(['restaurant', 'bronx', 'west-african']),
    },
    {
      workspaceId: demoWorkspaceId, listId: list2.id,
      firstName: 'Ryan', lastName: 'Cho', fullName: 'Ryan Cho',
      title: 'Owner', company: 'Hanok BBQ', companyDomain: null,
      email: 'ryan@hanokbbq.com', emailStatus: 'VERIFIED',
      phone: '+12125550664', phoneStatus: 'VERIFIED',
      location: 'Manhattan, NY', industry: 'Restaurant', companySize: '11-50',
      icpScore: 77,
      aiSummary: 'Ryan runs a popular Korean BBQ spot in K-Town. Expanding to a second location in Jersey City. Active on Instagram with 12K followers.',
      outreachAngle: 'Reference their Instagram growth — offer a free Instagram scraper trial to help them understand their audience before the Jersey City launch.',
      source: 'google-maps', tags: JSON.stringify(['restaurant', 'ktown', 'korean-bbq', 'expanding']),
    },
  ]

  const createdLeads = []
  for (const lead of leadsData) {
    const created = await prisma.lead.create({ data: lead })
    createdLeads.push(created)
  }
  console.log(`  Created ${createdLeads.length} Leads`)

  // 3. Create 2 Sequences
  const seq1Steps = JSON.stringify([
    { day: 0, type: 'linkedin_connect', message: "Hi {{firstName}}, I came across your profile while researching engineering leaders at innovative SaaS companies. I'm building tools that help teams like yours source and enrich leads 10x faster. Would love to connect!" },
    { day: 3, type: 'linkedin_message', message: "Hey {{firstName}}, thanks for connecting! Quick context — at Tudumm we help eng and growth teams run LinkedIn scrapers, email finders, and enrichment workflows without writing code. Curious if lead gen is something your team spends time on?" },
    { day: 7, type: 'email', message: "Hi {{firstName}},\n\nFollowing up from LinkedIn — I wanted to share a quick case study on how {{company}}-sized teams are cutting lead research time by 80% using automated enrichment pipelines.\n\nWould a 15-min demo make sense this week?\n\nBest,\nThe Tudumm Team" },
  ])

  const seq2Steps = JSON.stringify([
    { day: 0, type: 'email', message: "Hi {{firstName}},\n\nI noticed {{company}} is scaling fast — congrats on the growth! We work with decision makers at companies like yours to automate outbound lead generation using AI-powered scraping and enrichment.\n\nWould you be open to a quick 10-min call to see if it's relevant?" },
    { day: 5, type: 'email', message: "Hi {{firstName}},\n\nJust bumping this up — wanted to make sure my last note didn't get buried.\n\nWe have a free trial that lets you run 3 actors (LinkedIn, Google Maps, Email Finder) with no credit card. Might be worth a look for your team at {{company}}.\n\nHappy to help set it up: https://tudumm.io/trial" },
  ])

  const sequence1 = await prisma.sequence.create({
    data: {
      workspaceId: demoWorkspaceId,
      name: 'LinkedIn Cold Outreach — Engineers',
      platform: 'linkedin',
      status: 'ACTIVE',
      steps: seq1Steps,
      leadCount: 5,
      sentCount: 3,
      replyCount: 1,
    },
  })

  const sequence2 = await prisma.sequence.create({
    data: {
      workspaceId: demoWorkspaceId,
      name: 'Email Drip — Decision Makers',
      platform: 'email',
      status: 'DRAFT',
      steps: seq2Steps,
      leadCount: 0,
      sentCount: 0,
      replyCount: 0,
    },
  })
  console.log('  Created 2 Sequences')

  // 4. Add 5 SequenceLeads (first 5 leads from list1) to sequence1
  const linkedInLeads = createdLeads.slice(0, 5)
  const statuses = ['COMPLETED', 'IN_PROGRESS', 'IN_PROGRESS', 'PENDING', 'PENDING']
  const currentSteps = [3, 2, 1, 0, 0]
  for (let i = 0; i < linkedInLeads.length; i++) {
    await prisma.sequenceLead.create({
      data: {
        sequenceId: sequence1.id,
        leadId: linkedInLeads[i].id,
        status: statuses[i],
        currentStep: currentSteps[i],
        lastStepAt: i < 3 ? new Date(Date.now() - (3 - i) * 86400000) : null,
        nextStepAt: i < 3 ? new Date(Date.now() + (i + 1) * 86400000) : null,
      },
    })
  }
  console.log('  Created 5 SequenceLeads')
}

async function seedNewModels(workspaceId) {
  // Guard
  const existingLI = await prisma.linkedInSession.count({ where: { workspaceId } })
  if (existingLI > 0) {
    console.log('  New models already seeded — skipping')
    return
  }

  // 2 LinkedInSession records
  await prisma.linkedInSession.createMany({
    data: [
      {
        workspaceId, alias: 'Primary Account', email: 'demo@tudumm.io',
        sessionCookie: 'enc:AQEDATxxxxxxxxxxxxxxxxxxxxxxxx', status: 'ACTIVE',
        connections: 847, dailyLimit: 100, dailyUsed: 23, riskScore: 12,
        lastUsedAt: new Date(Date.now() - 3600000),
        expiresAt: new Date(Date.now() + 30 * 86400000),
      },
      {
        workspaceId, alias: 'Backup Account', email: 'backup@tudumm.io',
        sessionCookie: 'enc:AQEDATyyyyyyyyyyyyyyyyyyyyyyyy', status: 'ACTIVE',
        connections: 312, dailyLimit: 80, dailyUsed: 0, riskScore: 5,
        lastUsedAt: new Date(Date.now() - 2 * 86400000),
        expiresAt: new Date(Date.now() + 25 * 86400000),
      },
    ],
  })
  console.log('  Created 2 LinkedInSessions')

  // 3 EnrichmentJob records
  const leads = await prisma.lead.findMany({ where: { workspaceId }, take: 3 })
  await prisma.enrichmentJob.createMany({
    data: [
      {
        workspaceId, leadId: leads[0]?.id ?? null, status: 'DONE',
        providers: JSON.stringify(['apollo', 'hunter']),
        results: JSON.stringify({ email: leads[0]?.email, confidence: 0.95 }),
        creditsUsed: 3,
      },
      {
        workspaceId, leadId: leads[1]?.id ?? null, status: 'DONE',
        providers: JSON.stringify(['apollo']),
        results: JSON.stringify({ email: leads[1]?.email, confidence: 0.88 }),
        creditsUsed: 2,
      },
      {
        workspaceId, leadId: leads[2]?.id ?? null, status: 'PENDING',
        providers: JSON.stringify(['hunter', 'clearbit']),
        results: JSON.stringify({}),
        creditsUsed: 0,
      },
    ],
  })
  console.log('  Created 3 EnrichmentJobs')

  // 2 WorkflowDefinition records
  const wf1 = await prisma.workflowDefinition.create({
    data: {
      workspaceId, name: 'LinkedIn → Enrich → Sequence',
      description: 'Scrape LinkedIn profiles, enrich emails, then add to outreach sequence',
      status: 'ACTIVE', totalRuns: 14,
      lastRunAt: new Date(Date.now() - 6 * 3600000),
      nodes: JSON.stringify([
        { id: 'node-1', type: 'actor', actorSlug: 'linkedin-profile-scraper', label: 'Scrape LinkedIn' },
        { id: 'node-2', type: 'actor', actorSlug: 'email-finder', label: 'Find Emails' },
        { id: 'node-3', type: 'sequence', label: 'Add to Sequence' },
      ]),
      edges: JSON.stringify([
        { from: 'node-1', to: 'node-2' },
        { from: 'node-2', to: 'node-3' },
      ]),
    },
  })

  await prisma.workflowDefinition.create({
    data: {
      workspaceId, name: 'Google Maps Lead Capture',
      description: 'Extract local businesses and enrich with phone and email data',
      status: 'DRAFT', totalRuns: 0,
      nodes: JSON.stringify([
        { id: 'node-1', type: 'actor', actorSlug: 'google-maps-extractor', label: 'Extract Businesses' },
        { id: 'node-2', type: 'filter', label: 'Filter by Rating ≥ 4.0' },
      ]),
      edges: JSON.stringify([
        { from: 'node-1', to: 'node-2' },
      ]),
    },
  })
  console.log('  Created 2 WorkflowDefinitions')

  // Create a WorkflowExecution for wf1
  await prisma.workflowExecution.create({
    data: {
      workflowId: wf1.id, workspaceId, status: 'SUCCEEDED',
      nodeStates: JSON.stringify({ 'node-1': 'done', 'node-2': 'done', 'node-3': 'done' }),
      startedAt: new Date(Date.now() - 6.5 * 3600000),
      finishedAt: new Date(Date.now() - 6 * 3600000),
    },
  })
  console.log('  Created 1 WorkflowExecution')

  // 3 Playbook records
  await prisma.playbook.createMany({
    data: [
      {
        workspaceId: null, name: 'LinkedIn B2B Outreach',
        description: 'Find and contact B2B decision-makers on LinkedIn using profile scraping and personalised sequences.',
        category: 'Lead Generation', platform: 'linkedin', isPublic: true, totalRuns: 8923,
        stages: JSON.stringify([
          { order: 1, label: 'Scrape Profiles', actorSlug: 'linkedin-profile-scraper' },
          { order: 2, label: 'Enrich Emails', actorSlug: 'email-finder' },
          { order: 3, label: 'Run Sequence', type: 'sequence' },
        ]),
      },
      {
        workspaceId: null, name: 'Google Maps Local Prospecting',
        description: 'Extract local business leads from Google Maps and qualify them by rating and review count.',
        category: 'Local Business', platform: 'google-maps', isPublic: true, totalRuns: 5412,
        stages: JSON.stringify([
          { order: 1, label: 'Extract Businesses', actorSlug: 'google-maps-extractor' },
          { order: 2, label: 'Filter Leads', type: 'filter' },
          { order: 3, label: 'Email Outreach', type: 'sequence' },
        ]),
      },
      {
        workspaceId: null, name: 'GitHub Developer Targeting',
        description: 'Find active open-source developers building in your target technology stack.',
        category: 'Developer GTM', platform: 'github', isPublic: true, totalRuns: 2198,
        stages: JSON.stringify([
          { order: 1, label: 'Scrape GitHub Profiles', actorSlug: 'github-profile-scraper' },
          { order: 2, label: 'Enrich Emails', actorSlug: 'email-finder' },
          { order: 3, label: 'Outreach Sequence', type: 'sequence' },
        ]),
      },
    ],
  })
  console.log('  Created 3 Playbooks')

  // 1 ActorInputSchema for linkedin-profile-scraper
  const liActor = await prisma.actor.findUnique({ where: { slug: 'linkedin-profile-scraper' } })
  if (liActor) {
    await prisma.actorInputSchema.create({
      data: {
        actorId: liActor.id,
        schema: JSON.stringify({
          type: 'object',
          required: ['searchUrl'],
          properties: {
            searchUrl: { type: 'string', title: 'LinkedIn Search URL', description: 'LinkedIn people search URL to scrape' },
            maxResults: { type: 'integer', title: 'Max Results', default: 100, minimum: 1, maximum: 1000 },
            sessionCookieId: { type: 'string', title: 'LinkedIn Session', description: 'Select a LinkedIn session to use' },
            extractEmails: { type: 'boolean', title: 'Extract Emails', default: false },
          },
        }),
        uiSchema: JSON.stringify({
          searchUrl: { 'ui:widget': 'uri', 'ui:placeholder': 'https://www.linkedin.com/search/results/people/?keywords=...' },
          maxResults: { 'ui:widget': 'updown' },
          sessionCookieId: { 'ui:widget': 'linkedinSessionSelect' },
        }),
        version: '1.2.0',
      },
    })
    console.log('  Created 1 ActorInputSchema (linkedin-profile-scraper)')
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
