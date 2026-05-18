import axios, { AxiosInstance } from 'axios'
import { ActorClient } from './clients/ActorClient'
import { DatasetClient } from './clients/DatasetClient'
import { RunClient } from './clients/RunClient'
import { ProxyClient } from './clients/ProxyClient'
import type { TudummClientConfig } from './types'

export class TudummClient {
  readonly actors: ActorClient
  readonly datasets: DatasetClient
  readonly runs: RunClient
  readonly proxy: ProxyClient

  private readonly http: AxiosInstance

  constructor(config: TudummClientConfig) {
    this.http = axios.create({
      baseURL: config.baseUrl ?? 'https://api.tudumm.io',
      timeout: config.timeout ?? 30_000,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
    })

    this.http.interceptors.response.use(
      (res) => res,
      (err) => {
        const message = err.response?.data?.error ?? err.message
        throw new TudummError(message, err.response?.status)
      },
    )

    this.actors = new ActorClient(this.http)
    this.datasets = new DatasetClient(this.http)
    this.runs = new RunClient(this.http)
    this.proxy = new ProxyClient(this.http)
  }
}

export class TudummError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message)
    this.name = 'TudummError'
  }
}
