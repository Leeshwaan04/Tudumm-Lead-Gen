import { AxiosInstance } from 'axios'
import type { Actor, Run, ListActorsOptions, RunOptions, PaginatedItems } from '../types'

export class ActorClient {
  constructor(private readonly http: AxiosInstance) {}

  async list(options: ListActorsOptions = {}): Promise<PaginatedItems<Actor>> {
    const { data } = await this.http.get('/actors', { params: options })
    return data
  }

  async get(actorId: string): Promise<Actor> {
    const { data } = await this.http.get(`/actors/${actorId}`)
    return data
  }

  async run(actorId: string, input: Record<string, unknown> = {}, options: RunOptions = {}): Promise<Run> {
    const { data } = await this.http.post(`/actors/${actorId}/run`, { input, ...options })
    return data
  }

  async call(
    actorId: string,
    input: Record<string, unknown> = {},
    options: RunOptions & { timeoutSecs?: number } = {},
  ): Promise<Run> {
    const run = await this.run(actorId, input, options)
    return this.http
      .get(`/runs/${run.id}/wait`, {
        params: { timeoutSecs: options.timeoutSecs ?? 300 },
        timeout: (options.timeoutSecs ?? 300) * 1000 + 5000,
      })
      .then((r) => r.data)
  }

  async publish(manifest: Record<string, unknown>): Promise<{ id: string; version: string }> {
    const { data } = await this.http.post('/actors', manifest)
    return data
  }
}
