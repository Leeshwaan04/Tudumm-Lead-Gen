import { AxiosInstance } from 'axios'
import type { ProxyPoolStats, ProxyType } from '../types'

export interface ProxyRequestOptions {
  type?: ProxyType
  country?: string
  city?: string
  sticky?: boolean
}

export interface ProxyResponse {
  status: number
  headers: Record<string, string>
  body: string
  proxyUsed: string
  latencyMs: number
}

export class ProxyClient {
  constructor(private readonly http: AxiosInstance) {}

  async getPool(): Promise<ProxyPoolStats[]> {
    const { data } = await this.http.get('/proxy/pool')
    return data
  }

  async request(
    url: string,
    options: ProxyRequestOptions & { method?: string; headers?: Record<string, string>; body?: string } = {},
  ): Promise<ProxyResponse> {
    const { data } = await this.http.post('/proxy/request', {
      url,
      method: options.method ?? 'GET',
      headers: options.headers,
      body: options.body,
      proxyConfig: {
        type: options.type ?? 'RESIDENTIAL',
        country: options.country,
        city: options.city,
        sticky: options.sticky,
      },
    })
    return data
  }

  async getAvailableCountries(type: ProxyType): Promise<string[]> {
    const { data } = await this.http.get('/proxy/geos', { params: { type } })
    return data.countries
  }
}
