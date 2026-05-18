export interface PhantomDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
  platform: string;
  inputSchema: any;
  outputSchema: any;
  estimatedRunTime: string;
  creditsPerRun: number;
  tags: string[];
  icon: string;
}

export const LINKEDIN_PHANTOMS: PhantomDefinition[] = [
  {
    id: 'li-profile-scraper',
    name: 'LinkedIn Profile Scraper',
    description: 'Extract all data from LinkedIn profiles including work experience, education, and skills.',
    category: 'Scraping',
    platform: 'LinkedIn',
    creditsPerRun: 1,
    estimatedRunTime: '30s',
    tags: ['leads', 'data-extraction'],
    icon: 'linkedin',
    inputSchema: {
      type: 'object',
      properties: {
        profileUrls: { type: 'array', items: { type: 'string' } },
        maxProfiles: { type: 'number', default: 10 }
      },
      required: ['profileUrls']
    },
    outputSchema: {}
  },
  {
    id: 'li-auto-connect',
    name: 'LinkedIn Auto-Connect',
    description: 'Automatically send personalized connection requests to a list of profiles.',
    category: 'Automation',
    platform: 'LinkedIn',
    creditsPerRun: 2,
    estimatedRunTime: '1m',
    tags: ['outreach', 'growth'],
    icon: 'linkedin',
    inputSchema: {
      type: 'object',
      properties: {
        profileUrls: { type: 'array', items: { type: 'string' } },
        message: { type: 'string' }
      },
      required: ['profileUrls']
    },
    outputSchema: {}
  }
];

export const INSTAGRAM_PHANTOMS: PhantomDefinition[] = [
  {
    id: 'ig-follower-collector',
    name: 'Instagram Follower Collector',
    description: 'Collect followers from any Instagram account.',
    category: 'Scraping',
    platform: 'Instagram',
    creditsPerRun: 1,
    estimatedRunTime: '45s',
    tags: ['marketing', 'audience'],
    icon: 'instagram',
    inputSchema: {
      type: 'object',
      properties: {
        accountUrl: { type: 'string' },
        maxFollowers: { type: 'number', default: 100 }
      },
      required: ['accountUrl']
    },
    outputSchema: {}
  }
];

export const ALL_PHANTOMS = [...LINKEDIN_PHANTOMS, ...INSTAGRAM_PHANTOMS];
