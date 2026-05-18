/**
 * Seed 30 realistic Actors into the Tudumm database.
 * Run with: pnpm tsx scripts/seed-actors.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface ActorSeed {
  name: string
  slug: string
  description: string
  categories: string[]
  tags: string[]
  rating: number
  totalRuns: number
  inputSchema: Record<string, unknown>
}

const actors: ActorSeed[] = [
  // ── LinkedIn ────────────────────────────────────────────────────────────────
  {
    name: 'LinkedIn Profile Scraper',
    slug: 'linkedin-profile-scraper',
    description:
      'Extract structured data from LinkedIn profiles including work experience, education, skills, and contact info. Supports bulk scraping via URL list or Sales Navigator search.',
    categories: ['Social Media', 'Lead Generation'],
    tags: ['linkedin', 'profiles', 'leads', 'b2b'],
    rating: 4.8,
    totalRuns: 42500,
    inputSchema: {
      type: 'object',
      title: 'LinkedIn Profile Scraper Input',
      properties: {
        profileUrls: {
          type: 'array',
          title: 'Profile URLs',
          description: 'List of LinkedIn profile URLs to scrape',
          items: { type: 'string' },
        },
        maxProfiles: {
          type: 'number',
          title: 'Max Profiles',
          description: 'Maximum number of profiles to scrape',
          default: 100,
          maximum: 1000,
        },
        outputFormat: {
          type: 'string',
          title: 'Output Format',
          enum: ['json', 'csv', 'xlsx'],
          default: 'json',
        },
        includeContactInfo: {
          type: 'boolean',
          title: 'Include Contact Info',
          default: false,
        },
      },
      required: ['profileUrls'],
    },
  },
  {
    name: 'LinkedIn Auto-Connect',
    slug: 'linkedin-auto-connect',
    description:
      'Automate LinkedIn connection requests with personalized messages. Supports CSV/URL list input with rate limiting to stay within LinkedIn daily limits.',
    categories: ['Automation', 'Lead Generation'],
    tags: ['linkedin', 'outreach', 'automation', 'networking'],
    rating: 4.5,
    totalRuns: 18900,
    inputSchema: {
      type: 'object',
      title: 'LinkedIn Auto-Connect Input',
      properties: {
        profileUrls: {
          type: 'array',
          title: 'Profile URLs',
          items: { type: 'string' },
        },
        message: {
          type: 'string',
          title: 'Connection Message',
          description: 'Optional personalized message (max 300 chars)',
          maxLength: 300,
        },
        delayMs: {
          type: 'number',
          title: 'Delay Between Requests (ms)',
          default: 3000,
          minimum: 1000,
        },
        dailyLimit: {
          type: 'number',
          title: 'Daily Connection Limit',
          default: 20,
          maximum: 100,
        },
      },
      required: ['profileUrls'],
    },
  },
  {
    name: 'LinkedIn Sales Navigator Scraper',
    slug: 'linkedin-sales-nav-scraper',
    description:
      'Scrape search results from LinkedIn Sales Navigator. Exports leads with contact data, company info, and decision-maker signals.',
    categories: ['Lead Generation', 'Sales'],
    tags: ['linkedin', 'sales-navigator', 'leads', 'b2b'],
    rating: 4.7,
    totalRuns: 31200,
    inputSchema: {
      type: 'object',
      title: 'Sales Navigator Scraper Input',
      properties: {
        searchUrl: { type: 'string', title: 'Sales Navigator Search URL' },
        maxResults: { type: 'number', title: 'Max Results', default: 500, maximum: 2500 },
        outputFormat: { type: 'string', enum: ['json', 'csv'], default: 'csv' },
      },
      required: ['searchUrl'],
    },
  },
  // ── Instagram ───────────────────────────────────────────────────────────────
  {
    name: 'Instagram Followers Collector',
    slug: 'instagram-followers-collector',
    description:
      'Collect follower lists from any public Instagram account. Exports username, full name, bio, follower count, and verified status.',
    categories: ['Social Media', 'Market Research'],
    tags: ['instagram', 'followers', 'influencer', 'marketing'],
    rating: 4.6,
    totalRuns: 27800,
    inputSchema: {
      type: 'object',
      title: 'Instagram Followers Input',
      properties: {
        username: { type: 'string', title: 'Instagram Username' },
        maxFollowers: { type: 'number', title: 'Max Followers to Collect', default: 1000 },
        outputFormat: { type: 'string', enum: ['json', 'csv'], default: 'json' },
      },
      required: ['username'],
    },
  },
  {
    name: 'Instagram Hashtag Scraper',
    slug: 'instagram-hashtag-scraper',
    description:
      'Scrape posts from Instagram hashtags. Collects post URLs, captions, likes, comments, author info, and media URLs.',
    categories: ['Social Media', 'Content Research'],
    tags: ['instagram', 'hashtag', 'posts', 'content'],
    rating: 4.4,
    totalRuns: 19500,
    inputSchema: {
      type: 'object',
      title: 'Instagram Hashtag Input',
      properties: {
        hashtags: { type: 'array', title: 'Hashtags', items: { type: 'string' } },
        maxPosts: { type: 'number', title: 'Max Posts per Hashtag', default: 200 },
        sortBy: { type: 'string', enum: ['recent', 'top'], default: 'recent' },
      },
      required: ['hashtags'],
    },
  },
  // ── Twitter / X ─────────────────────────────────────────────────────────────
  {
    name: 'Twitter/X Profile Scraper',
    slug: 'twitter-profile-scraper',
    description:
      'Extract data from Twitter/X profiles including bio, follower count, tweet history, and engagement metrics.',
    categories: ['Social Media', 'Research'],
    tags: ['twitter', 'x', 'profiles', 'social'],
    rating: 4.3,
    totalRuns: 14200,
    inputSchema: {
      type: 'object',
      properties: {
        usernames: { type: 'array', title: 'Twitter Usernames', items: { type: 'string' } },
        includeTweets: { type: 'boolean', title: 'Include Recent Tweets', default: true },
        maxTweets: { type: 'number', title: 'Max Tweets per Profile', default: 100 },
      },
      required: ['usernames'],
    },
  },
  {
    name: 'Twitter Search Scraper',
    slug: 'twitter-search-scraper',
    description:
      'Scrape tweets from Twitter/X search results by keyword, hashtag, or advanced query. Includes retweet and engagement data.',
    categories: ['Social Media', 'Monitoring'],
    tags: ['twitter', 'search', 'tweets', 'sentiment'],
    rating: 4.5,
    totalRuns: 22100,
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', title: 'Search Query' },
        maxTweets: { type: 'number', title: 'Max Tweets', default: 500 },
        language: { type: 'string', title: 'Language Filter', default: 'en' },
        since: { type: 'string', title: 'Since Date (YYYY-MM-DD)' },
        until: { type: 'string', title: 'Until Date (YYYY-MM-DD)' },
      },
      required: ['query'],
    },
  },
  // ── Google Maps ─────────────────────────────────────────────────────────────
  {
    name: 'Google Maps Business Extractor',
    slug: 'google-maps-business-extractor',
    description:
      'Extract business listings from Google Maps for any keyword and location. Exports name, address, phone, website, hours, and ratings.',
    categories: ['Local Business', 'Lead Generation'],
    tags: ['google-maps', 'local', 'business', 'leads'],
    rating: 4.9,
    totalRuns: 48700,
    inputSchema: {
      type: 'object',
      properties: {
        searchQuery: { type: 'string', title: 'Search Query (e.g. "coffee shops")' },
        location: { type: 'string', title: 'Location (e.g. "New York, NY")' },
        maxResults: { type: 'number', title: 'Max Results', default: 100, maximum: 500 },
        includeReviews: { type: 'boolean', title: 'Include Sample Reviews', default: false },
      },
      required: ['searchQuery', 'location'],
    },
  },
  {
    name: 'Google Maps Reviews Scraper',
    slug: 'google-maps-reviews-scraper',
    description:
      'Scrape all reviews from a Google Maps listing including reviewer name, rating, date, and review text.',
    categories: ['Local Business', 'Market Research'],
    tags: ['google-maps', 'reviews', 'reputation', 'feedback'],
    rating: 4.7,
    totalRuns: 35400,
    inputSchema: {
      type: 'object',
      properties: {
        placeUrls: { type: 'array', title: 'Google Maps URLs', items: { type: 'string' } },
        maxReviews: { type: 'number', title: 'Max Reviews per Place', default: 200 },
        sortBy: { type: 'string', enum: ['newest', 'highest_rating', 'lowest_rating', 'most_relevant'], default: 'newest' },
      },
      required: ['placeUrls'],
    },
  },
  // ── YouTube ─────────────────────────────────────────────────────────────────
  {
    name: 'YouTube Channel Scraper',
    slug: 'youtube-channel-scraper',
    description:
      'Extract YouTube channel metadata, subscriber counts, video lists, and engagement statistics.',
    categories: ['Social Media', 'Content Research'],
    tags: ['youtube', 'channels', 'video', 'content'],
    rating: 4.6,
    totalRuns: 21300,
    inputSchema: {
      type: 'object',
      properties: {
        channelUrls: { type: 'array', title: 'Channel URLs', items: { type: 'string' } },
        maxVideos: { type: 'number', title: 'Max Videos per Channel', default: 50 },
        includeStats: { type: 'boolean', title: 'Include Video Stats', default: true },
      },
      required: ['channelUrls'],
    },
  },
  {
    name: 'YouTube Comments Extractor',
    slug: 'youtube-comments-extractor',
    description:
      'Extract comments from YouTube videos including author, text, likes, and reply threads.',
    categories: ['Social Media', 'Research'],
    tags: ['youtube', 'comments', 'engagement', 'sentiment'],
    rating: 4.4,
    totalRuns: 16700,
    inputSchema: {
      type: 'object',
      properties: {
        videoUrls: { type: 'array', title: 'YouTube Video URLs', items: { type: 'string' } },
        maxComments: { type: 'number', title: 'Max Comments per Video', default: 500 },
        includeReplies: { type: 'boolean', title: 'Include Reply Threads', default: false },
      },
      required: ['videoUrls'],
    },
  },
  // ── GitHub ──────────────────────────────────────────────────────────────────
  {
    name: 'GitHub Stars Extractor',
    slug: 'github-stars-extractor',
    description:
      'Collect the list of GitHub users who starred a repository. Exports user data for lead generation and developer outreach.',
    categories: ['Developer Tools', 'Lead Generation'],
    tags: ['github', 'stars', 'developers', 'open-source'],
    rating: 4.5,
    totalRuns: 12400,
    inputSchema: {
      type: 'object',
      properties: {
        repoUrl: { type: 'string', title: 'Repository URL (e.g. https://github.com/owner/repo)' },
        maxStargazers: { type: 'number', title: 'Max Stargazers', default: 1000 },
        includeEmails: { type: 'boolean', title: 'Attempt to Include Public Emails', default: true },
      },
      required: ['repoUrl'],
    },
  },
  {
    name: 'GitHub Followers Scraper',
    slug: 'github-followers-scraper',
    description:
      'Scrape GitHub followers of any user or organization. Useful for competitor analysis and developer community research.',
    categories: ['Developer Tools', 'Research'],
    tags: ['github', 'followers', 'developers', 'community'],
    rating: 4.3,
    totalRuns: 8900,
    inputSchema: {
      type: 'object',
      properties: {
        username: { type: 'string', title: 'GitHub Username or Org' },
        maxFollowers: { type: 'number', title: 'Max Followers', default: 500 },
      },
      required: ['username'],
    },
  },
  // ── Reddit ──────────────────────────────────────────────────────────────────
  {
    name: 'Reddit Post Scraper',
    slug: 'reddit-post-scraper',
    description:
      'Scrape Reddit posts from any subreddit or search query. Exports title, body, score, comments, and author info.',
    categories: ['Social Media', 'Research'],
    tags: ['reddit', 'posts', 'community', 'content'],
    rating: 4.6,
    totalRuns: 25800,
    inputSchema: {
      type: 'object',
      properties: {
        subreddit: { type: 'string', title: 'Subreddit (without r/)' },
        searchQuery: { type: 'string', title: 'Search Query (optional)' },
        sort: { type: 'string', enum: ['hot', 'new', 'top', 'rising'], default: 'hot' },
        timeFilter: { type: 'string', enum: ['hour', 'day', 'week', 'month', 'year', 'all'], default: 'week' },
        maxPosts: { type: 'number', title: 'Max Posts', default: 200 },
      },
      required: ['subreddit'],
    },
  },
  {
    name: 'Reddit User Analyzer',
    slug: 'reddit-user-analyzer',
    description:
      'Analyze Reddit user activity including post/comment history, karma breakdown, active subreddits, and engagement patterns.',
    categories: ['Research', 'Analytics'],
    tags: ['reddit', 'user-analysis', 'community', 'analytics'],
    rating: 4.2,
    totalRuns: 7600,
    inputSchema: {
      type: 'object',
      properties: {
        usernames: { type: 'array', title: 'Reddit Usernames', items: { type: 'string' } },
        maxPosts: { type: 'number', title: 'Max Posts per User', default: 100 },
        maxComments: { type: 'number', title: 'Max Comments per User', default: 100 },
      },
      required: ['usernames'],
    },
  },
  // ── Amazon ──────────────────────────────────────────────────────────────────
  {
    name: 'Amazon Product Scraper',
    slug: 'amazon-product-scraper',
    description:
      'Scrape Amazon product listings including title, price, ASIN, description, images, and seller info.',
    categories: ['E-commerce', 'Price Monitoring'],
    tags: ['amazon', 'products', 'e-commerce', 'pricing'],
    rating: 4.8,
    totalRuns: 52000,
    inputSchema: {
      type: 'object',
      properties: {
        searchQuery: { type: 'string', title: 'Search Query or ASIN' },
        maxProducts: { type: 'number', title: 'Max Products', default: 100 },
        country: { type: 'string', title: 'Amazon Country', enum: ['us', 'uk', 'de', 'fr', 'ca', 'in'], default: 'us' },
        includeSponsored: { type: 'boolean', title: 'Include Sponsored Results', default: false },
      },
      required: ['searchQuery'],
    },
  },
  {
    name: 'Amazon Reviews Collector',
    slug: 'amazon-reviews-collector',
    description:
      'Collect customer reviews from Amazon product pages. Exports reviewer name, rating, title, body, and verified purchase status.',
    categories: ['E-commerce', 'Market Research'],
    tags: ['amazon', 'reviews', 'sentiment', 'product-research'],
    rating: 4.7,
    totalRuns: 39100,
    inputSchema: {
      type: 'object',
      properties: {
        asins: { type: 'array', title: 'ASINs', items: { type: 'string' } },
        maxReviews: { type: 'number', title: 'Max Reviews per Product', default: 300 },
        filterByStar: { type: 'number', title: 'Filter by Star Rating (1-5, 0 for all)', default: 0 },
        country: { type: 'string', enum: ['us', 'uk', 'de', 'fr', 'ca', 'in'], default: 'us' },
      },
      required: ['asins'],
    },
  },
  // ── Real Estate ─────────────────────────────────────────────────────────────
  {
    name: 'Zillow Property Scraper',
    slug: 'zillow-property-scraper',
    description:
      'Scrape Zillow property listings including price, address, beds/baths, square footage, Zestimate, and agent info.',
    categories: ['Real Estate', 'Lead Generation'],
    tags: ['zillow', 'real-estate', 'properties', 'leads'],
    rating: 4.5,
    totalRuns: 17300,
    inputSchema: {
      type: 'object',
      properties: {
        location: { type: 'string', title: 'Location (city, zip, or address)' },
        listingType: { type: 'string', enum: ['for_sale', 'for_rent', 'sold'], default: 'for_sale' },
        maxResults: { type: 'number', title: 'Max Results', default: 200 },
        minPrice: { type: 'number', title: 'Min Price' },
        maxPrice: { type: 'number', title: 'Max Price' },
        minBeds: { type: 'number', title: 'Min Bedrooms' },
      },
      required: ['location'],
    },
  },
  // ── News / Tech ─────────────────────────────────────────────────────────────
  {
    name: 'HackerNews Job Scraper',
    slug: 'hackernews-job-scraper',
    description:
      'Scrape job postings from HackerNews "Who is Hiring?" threads. Exports company, role, location, remote status, and contact info.',
    categories: ['Jobs', 'Research'],
    tags: ['hackernews', 'jobs', 'tech', 'hiring'],
    rating: 4.4,
    totalRuns: 9800,
    inputSchema: {
      type: 'object',
      properties: {
        threadUrl: { type: 'string', title: 'HN Thread URL' },
        filterKeywords: { type: 'array', title: 'Filter Keywords', items: { type: 'string' } },
        remoteOnly: { type: 'boolean', title: 'Remote Only', default: false },
      },
      required: ['threadUrl'],
    },
  },
  {
    name: 'ProductHunt Launch Scraper',
    slug: 'producthunt-launch-scraper',
    description:
      'Scrape ProductHunt launches including product name, tagline, upvotes, maker info, and comments.',
    categories: ['Market Research', 'Startup Intelligence'],
    tags: ['producthunt', 'startups', 'launches', 'tech'],
    rating: 4.3,
    totalRuns: 11200,
    inputSchema: {
      type: 'object',
      properties: {
        dateRange: { type: 'string', title: 'Date Range', enum: ['today', 'week', 'month'], default: 'week' },
        category: { type: 'string', title: 'Category Filter' },
        maxProducts: { type: 'number', title: 'Max Products', default: 100 },
      },
      required: [],
    },
  },
  // ── Business Intel ──────────────────────────────────────────────────────────
  {
    name: 'Crunchbase Company Extractor',
    slug: 'crunchbase-company-extractor',
    description:
      'Extract company profiles from Crunchbase including funding rounds, investors, team size, and key executives.',
    categories: ['Business Intelligence', 'Lead Generation'],
    tags: ['crunchbase', 'startups', 'funding', 'investors'],
    rating: 4.6,
    totalRuns: 14500,
    inputSchema: {
      type: 'object',
      properties: {
        companyUrls: { type: 'array', title: 'Crunchbase Company URLs', items: { type: 'string' } },
        includeInvestors: { type: 'boolean', title: 'Include Investor Data', default: true },
        includeFunding: { type: 'boolean', title: 'Include Funding Rounds', default: true },
      },
      required: ['companyUrls'],
    },
  },
  {
    name: 'AngelList Talent Scraper',
    slug: 'angellist-talent-scraper',
    description:
      'Scrape AngelList/Wellfound job postings and candidate profiles for startup recruitment intelligence.',
    categories: ['Jobs', 'Recruitment'],
    tags: ['angellist', 'wellfound', 'startups', 'talent'],
    rating: 4.1,
    totalRuns: 6300,
    inputSchema: {
      type: 'object',
      properties: {
        searchQuery: { type: 'string', title: 'Job Title or Keyword' },
        location: { type: 'string', title: 'Location' },
        remoteOnly: { type: 'boolean', title: 'Remote Only', default: false },
        maxResults: { type: 'number', title: 'Max Results', default: 200 },
      },
      required: ['searchQuery'],
    },
  },
  // ── Review Platforms ────────────────────────────────────────────────────────
  {
    name: 'G2 Reviews Scraper',
    slug: 'g2-reviews-scraper',
    description:
      'Scrape G2 software reviews including rating, reviewer role, company size, pros/cons, and review date.',
    categories: ['Market Research', 'Competitive Intelligence'],
    tags: ['g2', 'reviews', 'saas', 'software'],
    rating: 4.5,
    totalRuns: 13700,
    inputSchema: {
      type: 'object',
      properties: {
        productUrls: { type: 'array', title: 'G2 Product URLs', items: { type: 'string' } },
        maxReviews: { type: 'number', title: 'Max Reviews per Product', default: 200 },
        minRating: { type: 'number', title: 'Min Star Rating', minimum: 1, maximum: 5 },
      },
      required: ['productUrls'],
    },
  },
  {
    name: 'Capterra Reviews Collector',
    slug: 'capterra-reviews-collector',
    description:
      'Collect Capterra software reviews with reviewer details, ratings per category, and full review text.',
    categories: ['Market Research', 'Competitive Intelligence'],
    tags: ['capterra', 'reviews', 'software', 'saas'],
    rating: 4.3,
    totalRuns: 8400,
    inputSchema: {
      type: 'object',
      properties: {
        productUrls: { type: 'array', title: 'Capterra Product URLs', items: { type: 'string' } },
        maxReviews: { type: 'number', title: 'Max Reviews', default: 200 },
        sortBy: { type: 'string', enum: ['most_recent', 'most_helpful', 'highest_rating', 'lowest_rating'], default: 'most_recent' },
      },
      required: ['productUrls'],
    },
  },
  {
    name: 'TrustPilot Reviews Scraper',
    slug: 'trustpilot-reviews-scraper',
    description:
      'Scrape TrustPilot reviews for any company including star ratings, review text, author country, and reply data.',
    categories: ['Market Research', 'Reputation Management'],
    tags: ['trustpilot', 'reviews', 'reputation', 'feedback'],
    rating: 4.6,
    totalRuns: 22400,
    inputSchema: {
      type: 'object',
      properties: {
        companyDomains: { type: 'array', title: 'Company Domains', items: { type: 'string' } },
        maxReviews: { type: 'number', title: 'Max Reviews per Company', default: 500 },
        filterByRating: { type: 'number', title: 'Filter by Star Rating (1-5, 0 for all)', default: 0 },
        language: { type: 'string', title: 'Language Filter', default: 'en' },
      },
      required: ['companyDomains'],
    },
  },
  // ── HR / Jobs ───────────────────────────────────────────────────────────────
  {
    name: 'Glassdoor Reviews Extractor',
    slug: 'glassdoor-reviews-extractor',
    description:
      'Extract Glassdoor company reviews including ratings, pros/cons, role, and CEO approval ratings.',
    categories: ['HR', 'Market Research'],
    tags: ['glassdoor', 'reviews', 'employer-branding', 'hr'],
    rating: 4.4,
    totalRuns: 15800,
    inputSchema: {
      type: 'object',
      properties: {
        companyUrls: { type: 'array', title: 'Glassdoor Company URLs', items: { type: 'string' } },
        maxReviews: { type: 'number', title: 'Max Reviews', default: 300 },
        filterByRating: { type: 'number', title: 'Filter by Rating (1-5)', minimum: 1, maximum: 5 },
      },
      required: ['companyUrls'],
    },
  },
  {
    name: 'Indeed Job Scraper',
    slug: 'indeed-job-scraper',
    description:
      'Scrape job postings from Indeed including title, company, salary, location, and full job description.',
    categories: ['Jobs', 'HR'],
    tags: ['indeed', 'jobs', 'recruitment', 'hiring'],
    rating: 4.5,
    totalRuns: 33600,
    inputSchema: {
      type: 'object',
      properties: {
        jobTitle: { type: 'string', title: 'Job Title or Keywords' },
        location: { type: 'string', title: 'Location' },
        maxJobs: { type: 'number', title: 'Max Jobs', default: 200 },
        remote: { type: 'boolean', title: 'Remote Only', default: false },
        postedWithin: { type: 'string', enum: ['1', '3', '7', '14', '30'], title: 'Posted Within (days)', default: '7' },
      },
      required: ['jobTitle'],
    },
  },
  // ── Facebook ─────────────────────────────────────────────────────────────────
  {
    name: 'Facebook Group Scraper',
    slug: 'facebook-group-scraper',
    description:
      'Scrape posts and member data from public Facebook groups. Exports post text, author, reactions, comments, and timestamps.',
    categories: ['Social Media', 'Research'],
    tags: ['facebook', 'groups', 'community', 'content'],
    rating: 4.2,
    totalRuns: 10400,
    inputSchema: {
      type: 'object',
      properties: {
        groupUrls: { type: 'array', title: 'Facebook Group URLs', items: { type: 'string' } },
        maxPosts: { type: 'number', title: 'Max Posts', default: 200 },
        includeComments: { type: 'boolean', title: 'Include Comments', default: false },
        dateFrom: { type: 'string', title: 'Date From (YYYY-MM-DD)' },
      },
      required: ['groupUrls'],
    },
  },
  // ── TikTok ──────────────────────────────────────────────────────────────────
  {
    name: 'TikTok Profile Scraper',
    slug: 'tiktok-profile-scraper',
    description:
      'Scrape TikTok creator profiles and videos including views, likes, comments, shares, and follower counts.',
    categories: ['Social Media', 'Influencer Marketing'],
    tags: ['tiktok', 'profiles', 'influencer', 'video'],
    rating: 4.3,
    totalRuns: 18200,
    inputSchema: {
      type: 'object',
      properties: {
        usernames: { type: 'array', title: 'TikTok Usernames', items: { type: 'string' } },
        maxVideos: { type: 'number', title: 'Max Videos per Profile', default: 50 },
        includeComments: { type: 'boolean', title: 'Include Top Comments', default: false },
      },
      required: ['usernames'],
    },
  },
  // ── Yelp ────────────────────────────────────────────────────────────────────
  {
    name: 'Yelp Business Scraper',
    slug: 'yelp-business-scraper',
    description:
      'Scrape Yelp business listings and reviews by location and category. Exports contact info, hours, ratings, and review text.',
    categories: ['Local Business', 'Lead Generation'],
    tags: ['yelp', 'local', 'reviews', 'business'],
    rating: 4.5,
    totalRuns: 24700,
    inputSchema: {
      type: 'object',
      properties: {
        searchQuery: { type: 'string', title: 'Search Query (e.g. "pizza")' },
        location: { type: 'string', title: 'Location (city, zip, neighborhood)' },
        maxResults: { type: 'number', title: 'Max Businesses', default: 100 },
        maxReviewsPerBiz: { type: 'number', title: 'Max Reviews per Business', default: 20 },
      },
      required: ['searchQuery', 'location'],
    },
  },
]

async function main() {
  console.log(`Seeding ${actors.length} actors...`)

  // Find or create a system workspace
  const workspace = await prisma.workspace.upsert({
    where: { slug: 'tudumm-official' },
    update: {},
    create: {
      name: 'Tudumm Official',
      slug: 'tudumm-official',
      plan: 'ENTERPRISE',
      creditBalance: 1_000_000,
      execHoursLimit: 99999,
      slots: 100,
    },
  })

  for (const seed of actors) {
    const actor = await prisma.actor.upsert({
      where: { slug: seed.slug },
      update: {
        name: seed.name,
        description: seed.description,
        rating: seed.rating,
        totalRuns: seed.totalRuns,
      },
      create: {
        name: seed.name,
        slug: seed.slug,
        description: seed.description,
        readme: `# ${seed.name}\n\n${seed.description}\n\n## Usage\n\nConfigure the input fields and click Run.`,
        categories: seed.categories,
        tags: seed.tags,
        isPublic: true,
        status: 'PUBLISHED',
        rating: seed.rating,
        ratingCount: Math.floor(seed.totalRuns * 0.02),
        totalRuns: seed.totalRuns,
        latestVersion: '1.0.0',
        workspaceId: workspace.id,
      },
    })

    // Create initial version
    await prisma.actorVersion.upsert({
      where: { actorId_version: { actorId: actor.id, version: '1.0.0' } },
      update: {},
      create: {
        actorId: actor.id,
        version: '1.0.0',
        dockerImage: `public.ecr.aws/tudumm/actors/${seed.slug}:1.0.0`,
        inputSchema: seed.inputSchema,
        changelog: 'Initial release',
        isLatest: true,
      },
    })

    console.log(`  Seeded: ${seed.name}`)
  }

  console.log('\nDone! All actors seeded successfully.')
}

main()
  .catch((err) => {
    console.error('Seed failed:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
