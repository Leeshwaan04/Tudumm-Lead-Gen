import { AxiosInstance } from 'axios'
import type { Run, RunLog, PaginatedItems } from '../types'

export class RunClient {
  constructor(private readonly http: AxiosInstance) {}

  async get(runId: string): Promise<Run> {
    const { data } = await this.http.get(`/runs/${runId}`)
    return data
  }

  async list(options: { actorId?: string; status?: string; page?: number; limit?: number } = {}): Promise<PaginatedItems<Run>> {
    const { data } = await this.http.get('/runs', { params: options })
    return data
  }

  async cancel(runId: string): Promise<void> {
    await this.http.delete(`/runs/${runId}`)
  }

  async getLogs(runId: string): Promise<RunLog[]> {
    const { data } = await this.http.get(`/runs/${runId}/logs`)
    return data.data
  }

  async waitForFinish(
    runId: string,
    options: { timeoutSecs?: number; pollIntervalMs?: number } = {},
  ): Promise<Run> {
    const { timeoutSecs = 300, pollIntervalMs = 2000 } = options
    const deadline = Date.now() + timeoutSecs * 1000

    while (Date.now() < deadline) {
      const run = await this.get(runId)
      if (['SUCCEEDED', 'FAILED', 'CANCELLED', 'TIMEOUT'].includes(run.status)) {
        return run
      }
      await sleep(pollIntervalMs)
    }
    throw new Error(`Run ${runId} did not finish within ${timeoutSecs}s`)
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
