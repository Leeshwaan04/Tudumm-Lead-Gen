export type QueueItemStatus = 'PENDING' | 'RUNNING' | 'HANDLED' | 'FAILED'

export interface Dataset {
  id: string
  workspaceId: string
  name: string
  itemCount: number
  sizeBytes: number
  createdAt: string
}

export interface DatasetItem {
  [key: string]: unknown
}

export interface KVStore {
  id: string
  workspaceId: string
  name: string
  itemCount: number
  sizeBytes: number
  createdAt: string
}

export interface RequestQueue {
  id: string
  workspaceId: string
  name: string
  pendingCount: number
  handledCount: number
  createdAt: string
}

export interface RequestQueueItem {
  id: string
  queueId: string
  url: string
  uniqueKey: string
  status: QueueItemStatus
  retries: number
  addedAt: string
}
