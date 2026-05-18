import { PrismaClient, PlanType, MemberRole, ActorStatus, RunStatus } from "@prisma/client";
import { createHash } from "crypto";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Tudumm database...");

  // ── Workspaces ─────────────────────────────────────────────────────────────

  const workspace1 = await prisma.workspace.upsert({
    where: { slug: "acme-corp" },
    update: {},
    create: {
      name: "Acme Corp",
      slug: "acme-corp",
      plan: PlanType.SCALE,
      creditBalance: 50000,
      execHoursUsed: 12.5,
      execHoursLimit: 200,
      slots: 20,
      proxyGbUsed: 8.3,
      aiCredits: 5000,
      emailCredits: 10000,
    },
  });

  const workspace2 = await prisma.workspace.upsert({
    where: { slug: "startup-labs" },
    update: {},
    create: {
      name: "Startup Labs",
      slug: "startup-labs",
      plan: PlanType.GROW,
      creditBalance: 12500,
      execHoursUsed: 4.2,
      execHoursLimit: 50,
      slots: 10,
      proxyGbUsed: 1.1,
      aiCredits: 1000,
      emailCredits: 2000,
    },
  });

  const workspace3 = await prisma.workspace.upsert({
    where: { slug: "solo-dev" },
    update: {},
    create: {
      name: "Solo Dev",
      slug: "solo-dev",
      plan: PlanType.STARTER,
      creditBalance: 1000,
      execHoursUsed: 0.8,
      execHoursLimit: 10,
      slots: 3,
      proxyGbUsed: 0.2,
      aiCredits: 100,
      emailCredits: 200,
    },
  });

  // ── Users ──────────────────────────────────────────────────────────────────

  const passwordHash = createHash("sha256").update("password123").digest("hex");

  const alice = await prisma.user.upsert({
    where: { email: "alice@acmecorp.io" },
    update: {},
    create: {
      email: "alice@acmecorp.io",
      passwordHash,
      name: "Alice Chen",
      avatarUrl: "https://avatars.githubusercontent.com/u/1001",
      emailVerified: true,
    },
  });

  const bob = await prisma.user.upsert({
    where: { email: "bob@startuplabs.dev" },
    update: {},
    create: {
      email: "bob@startuplabs.dev",
      passwordHash,
      name: "Bob Martinez",
      avatarUrl: "https://avatars.githubusercontent.com/u/1002",
      emailVerified: true,
    },
  });

  const carol = await prisma.user.upsert({
    where: { email: "carol@example.com" },
    update: {},
    create: {
      email: "carol@example.com",
      passwordHash,
      name: "Carol Singh",
      emailVerified: false,
    },
  });

  // ── Workspace Members ──────────────────────────────────────────────────────

  await prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: workspace1.id, userId: alice.id } },
    update: {},
    create: { workspaceId: workspace1.id, userId: alice.id, role: MemberRole.OWNER },
  });

  await prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: workspace2.id, userId: bob.id } },
    update: {},
    create: { workspaceId: workspace2.id, userId: bob.id, role: MemberRole.OWNER },
  });

  await prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: workspace3.id, userId: carol.id } },
    update: {},
    create: { workspaceId: workspace3.id, userId: carol.id, role: MemberRole.OWNER },
  });

  await prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: workspace1.id, userId: bob.id } },
    update: {},
    create: { workspaceId: workspace1.id, userId: bob.id, role: MemberRole.MEMBER },
  });

  // ── Actors ─────────────────────────────────────────────────────────────────

  const actorDefs = [
    {
      name: "Amazon Product Scraper",
      slug: "amazon-product-scraper",
      description: "Scrape product listings, prices, reviews, and seller info from Amazon at scale.",
      categories: ["e-commerce", "scraping"],
      tags: ["amazon", "products", "prices", "reviews"],
      isPublic: true,
      status: ActorStatus.PUBLISHED,
      totalRuns: 42830,
      totalRevenueCents: 318500,
      rating: 4.8,
      ratingCount: 312,
    },
    {
      name: "LinkedIn Profile Enricher",
      slug: "linkedin-profile-enricher",
      description: "Enrich contact lists with LinkedIn profile data including job titles, companies, and skills.",
      categories: ["lead-gen", "enrichment"],
      tags: ["linkedin", "b2b", "contacts", "enrichment"],
      isPublic: true,
      status: ActorStatus.PUBLISHED,
      totalRuns: 18920,
      totalRevenueCents: 204800,
      rating: 4.6,
      ratingCount: 187,
    },
    {
      name: "Google SERP Extractor",
      slug: "google-serp-extractor",
      description: "Extract organic search results, ads, featured snippets, and PAA boxes from Google.",
      categories: ["seo", "scraping"],
      tags: ["google", "seo", "serp", "search"],
      isPublic: true,
      status: ActorStatus.PUBLISHED,
      totalRuns: 31450,
      totalRevenueCents: 142000,
      rating: 4.7,
      ratingCount: 256,
    },
    {
      name: "Shopify Store Crawler",
      slug: "shopify-store-crawler",
      description: "Crawl Shopify stores to extract product catalogs, collections, and pricing data.",
      categories: ["e-commerce", "scraping"],
      tags: ["shopify", "products", "catalog"],
      isPublic: true,
      status: ActorStatus.PUBLISHED,
      totalRuns: 9870,
      totalRevenueCents: 88200,
      rating: 4.5,
      ratingCount: 94,
    },
    {
      name: "Instagram Hashtag Monitor",
      slug: "instagram-hashtag-monitor",
      description: "Monitor Instagram hashtags and collect post metadata, engagement stats, and author info.",
      categories: ["social-media", "monitoring"],
      tags: ["instagram", "hashtag", "social", "monitoring"],
      isPublic: true,
      status: ActorStatus.PUBLISHED,
      totalRuns: 14200,
      totalRevenueCents: 97600,
      rating: 4.3,
      ratingCount: 128,
    },
    {
      name: "Indeed Job Listings Scraper",
      slug: "indeed-job-listings-scraper",
      description: "Scrape job listings from Indeed with filters for location, salary, and job type.",
      categories: ["jobs", "scraping"],
      tags: ["indeed", "jobs", "hiring", "recruitment"],
      isPublic: true,
      status: ActorStatus.PUBLISHED,
      totalRuns: 22100,
      totalRevenueCents: 118400,
      rating: 4.4,
      ratingCount: 201,
    },
    {
      name: "Trustpilot Review Harvester",
      slug: "trustpilot-review-harvester",
      description: "Collect customer reviews from Trustpilot for any business, with sentiment metadata.",
      categories: ["reviews", "scraping"],
      tags: ["trustpilot", "reviews", "sentiment"],
      isPublic: true,
      status: ActorStatus.PUBLISHED,
      totalRuns: 7640,
      totalRevenueCents: 56300,
      rating: 4.6,
      ratingCount: 72,
    },
    {
      name: "Zillow Property Data Extractor",
      slug: "zillow-property-data-extractor",
      description: "Extract property listings, Zestimate values, and market trends from Zillow.",
      categories: ["real-estate", "scraping"],
      tags: ["zillow", "real-estate", "property", "housing"],
      isPublic: true,
      status: ActorStatus.PUBLISHED,
      totalRuns: 5230,
      totalRevenueCents: 73500,
      rating: 4.2,
      ratingCount: 48,
    },
    {
      name: "YouTube Channel Analyzer",
      slug: "youtube-channel-analyzer",
      description: "Analyze YouTube channels: subscriber count, video stats, top content, and growth trends.",
      categories: ["social-media", "analytics"],
      tags: ["youtube", "video", "channel", "analytics"],
      isPublic: true,
      status: ActorStatus.PUBLISHED,
      totalRuns: 11340,
      totalRevenueCents: 62100,
      rating: 4.5,
      ratingCount: 109,
    },
    {
      name: "AI Email Outreach Composer",
      slug: "ai-email-outreach-composer",
      description: "Use AI to generate personalized cold email sequences from prospect data and company context.",
      categories: ["ai", "email", "outreach"],
      tags: ["ai", "email", "gpt", "outreach", "sales"],
      isPublic: false,
      status: ActorStatus.DRAFT,
      totalRuns: 0,
      totalRevenueCents: 0,
      rating: 0,
      ratingCount: 0,
    },
  ];

  const actors = [];
  for (const def of actorDefs) {
    const actor = await prisma.actor.upsert({
      where: { slug: def.slug },
      update: {},
      create: {
        workspaceId: workspace1.id,
        authorId: alice.id,
        ...def,
        rating: def.rating,
      },
    });

    // Create a published version for each public actor
    if (def.status === ActorStatus.PUBLISHED) {
      await prisma.actorVersion.upsert({
        where: { actorId_version: { actorId: actor.id, version: "1.0.0" } },
        update: {},
        create: {
          actorId: actor.id,
          version: "1.0.0",
          dockerImage: `ghcr.io/tudumm/${def.slug}:1.0.0`,
          inputSchema: {
            type: "object",
            properties: {
              startUrls: { type: "array", items: { type: "string" }, description: "Start URLs" },
              maxItems: { type: "integer", default: 100, description: "Maximum items to collect" },
              proxyConfig: { type: "object", description: "Proxy configuration" },
            },
            required: ["startUrls"],
          },
          changeLog: "Initial public release",
          isLatest: true,
        },
      });
    }

    actors.push(actor);
  }

  // ── Sample Runs ────────────────────────────────────────────────────────────

  const runStatuses = [RunStatus.SUCCEEDED, RunStatus.SUCCEEDED, RunStatus.FAILED, RunStatus.RUNNING];

  for (let i = 0; i < 5; i++) {
    const actor = actors[i % actors.length];
    const status = runStatuses[i % runStatuses.length];
    const durationMs = status === RunStatus.SUCCEEDED ? Math.floor(Math.random() * 120000) + 5000 : null;

    await prisma.run.create({
      data: {
        workspaceId: workspace1.id,
        actorId: actor.id,
        status,
        input: { startUrls: ["https://example.com"], maxItems: 50 },
        output: status === RunStatus.SUCCEEDED ? { itemsScraped: 47, exportUrl: "s3://tudumm/datasets/abc123" } : null,
        exitCode: status === RunStatus.SUCCEEDED ? 0 : status === RunStatus.FAILED ? 1 : null,
        errorMessage: status === RunStatus.FAILED ? "Connection timeout after 3 retries" : null,
        startedAt: new Date(Date.now() - (i + 1) * 3600 * 1000),
        finishedAt: durationMs
          ? new Date(Date.now() - (i + 1) * 3600 * 1000 + durationMs)
          : null,
        durationMs,
        memoryMb: 512,
        cpuSeconds: durationMs ? Math.round(durationMs / 1000) * 0.5 : null,
        creditsCost: durationMs ? Math.ceil(durationMs / 60000) * 5 : 0,
      },
    });
  }

  // ── API Keys ───────────────────────────────────────────────────────────────

  await prisma.apiKey.upsert({
    where: { keyHash: createHash("sha256").update("td_live_acme_key_1").digest("hex") },
    update: {},
    create: {
      workspaceId: workspace1.id,
      name: "Production Key",
      keyHash: createHash("sha256").update("td_live_acme_key_1").digest("hex"),
      keyPrefix: "td_live_acm",
      scopes: ["runs:read", "runs:write", "datasets:read"],
      lastUsedAt: new Date(),
    },
  });

  // ── Webhook ────────────────────────────────────────────────────────────────

  await prisma.webhook.create({
    data: {
      workspaceId: workspace1.id,
      url: "https://hooks.acmecorp.io/tudumm",
      events: ["run.completed", "run.failed", "actor.published"],
      secret: createHash("sha256").update("webhook-secret-acme").digest("hex"),
    },
  });

  console.log("Seed complete.");
  console.log(`  Workspaces: 3`);
  console.log(`  Users: 3`);
  console.log(`  Actors: ${actors.length}`);
  console.log(`  Runs: 5`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
