export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface ApiResponse<T> {
  data: T
  error?: string
  meta?: PaginationMeta
}

export interface ApiError {
  code: string
  message: string
  details?: Record<string, unknown>
}
