export type ProxyType = 'RESIDENTIAL' | 'DATACENTER' | 'ISP' | 'MOBILE'

export interface ProxyConfig {
  type: ProxyType
  country?: string
  city?: string
  sticky?: boolean
  targetDomain?: string
}

export interface ProxyPoolStats {
  type: ProxyType
  count: number
  avgSuccessRate: number
  avgLatencyMs: number
  availableCountries: string[]
}

export interface ProxySession {
  id: string
  proxyType: ProxyType
  ip: string
  country: string
  city?: string
  stickyUntil?: string
}
