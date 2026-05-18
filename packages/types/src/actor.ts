export type ActorStatus = 'DRAFT' | 'PUBLISHED' | 'DEPRECATED'

export interface JSONSchemaProperty {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  title?: string
  description?: string
  default?: unknown
  enum?: unknown[]
  items?: JSONSchemaProperty
  properties?: Record<string, JSONSchemaProperty>
  minimum?: number
  maximum?: number
  minLength?: number
  maxLength?: number
}

export interface JSONSchema {
  $schema?: string
  type: 'object'
  title?: string
  description?: string
  properties: Record<string, JSONSchemaProperty>
  required?: string[]
}

export interface Actor {
  id: string
  name: string
  slug: string
  description: string
  readme: string
  categories: string[]
  tags: string[]
  isPublic: boolean
  status: ActorStatus
  iconUrl?: string
  totalRuns: number
  rating: number
  ratingCount: number
  author: {
    id: string
    name: string
    username: string
    avatarUrl?: string
  }
  latestVersion?: string
  createdAt: string
  updatedAt: string
}

export interface ActorVersion {
  id: string
  actorId: string
  version: string
  dockerImage: string
  inputSchema: JSONSchema
  changelog?: string
  isLatest: boolean
  publishedAt: string
}

export interface ActorInputSchema {
  title: string
  description?: string
  type: 'object'
  properties: Record<string, JSONSchemaProperty>
  required: string[]
}
