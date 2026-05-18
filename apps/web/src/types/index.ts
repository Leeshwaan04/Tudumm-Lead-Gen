export type RunStatus = "running" | "succeeded" | "failed" | "aborted" | "queued";
export type ActorStatus = "active" | "deprecated" | "beta";
export type ProxyType = "residential" | "datacenter" | "mobile" | "isp";
export type BillingPlan = "starter" | "growth" | "scale" | "enterprise";
export type ScheduleFrequency = "hourly" | "daily" | "weekly" | "monthly" | "custom";

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  createdAt: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  plan: BillingPlan;
  ownerId: string;
  createdAt: string;
  members: WorkspaceMember[];
}

export interface WorkspaceMember {
  userId: string;
  role: "owner" | "admin" | "member" | "viewer";
  user: User;
}

export interface CreditBalance {
  total: number;
  used: number;
  remaining: number;
  resetDate: string;
  plan: BillingPlan;
}

export interface Run {
  id: string;
  actorId: string;
  actorName: string;
  status: RunStatus;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  creditsUsed: number;
  datasetId?: string;
  itemsScraped?: number;
  error?: string;
  inputPayload: Record<string, unknown>;
}

export interface Actor {
  id: string;
  name: string;
  title: string;
  description: string;
  authorName: string;
  authorUsername: string;
  category: ActorCategory;
  status: ActorStatus;
  version: string;
  pricePerRun: number;
  totalRuns: number;
  rating: number;
  ratingCount: number;
  imageUrl?: string;
  tags: string[];
  isPublic: boolean;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ActorCategory =
  | "social-media"
  | "e-commerce"
  | "search-engines"
  | "maps"
  | "news"
  | "real-estate"
  | "finance"
  | "jobs"
  | "travel"
  | "lead-generation"
  | "ai-tools"
  | "utilities";

export interface Phantom {
  id: string;
  name: string;
  description: string;
  platform: PhantomPlatform;
  category: string;
  icon: string;
  creditsPerRun: number;
  averageDuration: number;
  totalLaunches: number;
  outputFields: string[];
  isPopular: boolean;
  tags: string[];
}

export type PhantomPlatform =
  | "linkedin"
  | "instagram"
  | "twitter"
  | "facebook"
  | "google"
  | "youtube"
  | "tiktok"
  | "github"
  | "reddit";

export interface WorkflowNode {
  id: string;
  type: "trigger" | "action" | "condition" | "transform" | "output";
  label: string;
  description: string;
  actorId?: string;
  config: Record<string, unknown>;
  position: { x: number; y: number };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  condition?: string;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  isActive: boolean;
  lastRunAt?: string;
  totalRuns: number;
  createdAt: string;
  updatedAt: string;
}

export interface Dataset {
  id: string;
  name: string;
  actorRunId?: string;
  actorName?: string;
  itemCount: number;
  sizeBytes: number;
  createdAt: string;
  updatedAt: string;
  fields: string[];
  format: "json" | "csv" | "xlsx" | "xml";
}

export interface DatasetItem {
  id: string;
  data: Record<string, unknown>;
  createdAt: string;
}

export interface Schedule {
  id: string;
  name: string;
  actorId: string;
  actorName: string;
  cronExpression: string;
  frequency: ScheduleFrequency;
  isActive: boolean;
  nextRunAt: string;
  lastRunAt?: string;
  lastRunStatus?: RunStatus;
  inputPayload: Record<string, unknown>;
  createdAt: string;
}

export interface ProxyConfiguration {
  id: string;
  type: ProxyType;
  country?: string;
  city?: string;
  sessionType: "rotating" | "sticky";
  username: string;
  password: string;
  endpoint: string;
  port: number;
}

export interface ProxyUsage {
  date: string;
  requestCount: number;
  bandwidthBytes: number;
  successRate: number;
  type: ProxyType;
}

export interface Invoice {
  id: string;
  amount: number;
  currency: string;
  status: "paid" | "pending" | "failed";
  issuedAt: string;
  paidAt?: string;
  downloadUrl: string;
  description: string;
}

export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  permissions: ApiKeyPermission[];
  lastUsedAt?: string;
  expiresAt?: string;
  createdAt: string;
  isActive: boolean;
}

export type ApiKeyPermission = "read" | "write" | "delete" | "admin";

export interface UsageDataPoint {
  date: string;
  credits: number;
  runs: number;
  items: number;
}

export interface PlanFeature {
  name: string;
  starter: string | boolean;
  growth: string | boolean;
  scale: string | boolean;
  enterprise: string | boolean;
}
