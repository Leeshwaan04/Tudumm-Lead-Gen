import { AxiosInstance } from 'axios'
import type { Dataset, PaginatedItems } from '../types'

export class DatasetClient {
  constructor(private readonly http: AxiosInstance) {}

  async get(datasetId: string): Promise<Dataset> {
    const { data } = await this.http.get(`/storage/datasets/${datasetId}`)
    return data
  }

  async list(): Promise<Dataset[]> {
    const { data } = await this.http.get('/storage/datasets')
    return data.data
  }

  async create(name: string): Promise<Dataset> {
    const { data } = await this.http.post('/storage/datasets', { name })
    return data
  }

  async pushItems(datasetId: string, items: Record<string, unknown>[]): Promise<{ pushed: number }> {
    const { data } = await this.http.post(`/storage/datasets/${datasetId}/items`, items)
    return data
  }

  async getItems<T = Record<string, unknown>>(
    datasetId: string,
    options: { page?: number; limit?: number } = {},
  ): Promise<PaginatedItems<T>> {
    const { data } = await this.http.get(`/storage/datasets/${datasetId}/items`, { params: options })
    return data
  }

  async export(datasetId: string, format: 'json' | 'csv' | 'ndjson' = 'json'): Promise<Buffer> {
    const { data } = await this.http.get(`/storage/datasets/${datasetId}/export`, {
      params: { format },
      responseType: 'arraybuffer',
    })
    return Buffer.from(data)
  }
}
