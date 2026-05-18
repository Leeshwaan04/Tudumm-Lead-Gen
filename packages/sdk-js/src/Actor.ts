import axios from 'axios'

export interface ActorLogger {
  debug(message: string, meta?: Record<string, unknown>): void
  info(message: string, meta?: Record<string, unknown>): void
  warn(message: string, meta?: Record<string, unknown>): void
  error(message: string, meta?: Record<string, unknown>): void
}

export abstract class Actor<TInput = Record<string, unknown>, TOutput = Record<string, unknown>> {
  protected readonly log: ActorLogger
  private readonly apiUrl: string
  private readonly datasetId: string | undefined
  private readonly kvStoreId: string | undefined
  private readonly http = axios.create({
    headers: { Authorization: `Bearer ${process.env.TUDUMM_TOKEN}` },
  })

  constructor() {
    this.apiUrl = process.env.TUDUMM_API_URL ?? 'https://api.tudumm.io'
    this.datasetId = process.env.TUDUMM_DEFAULT_DATASET_ID
    this.kvStoreId = process.env.TUDUMM_DEFAULT_KV_STORE_ID
    this.log = this.createLogger()
  }

  abstract run(input: TInput): Promise<TOutput>

  protected async pushData(items: Record<string, unknown>[]): Promise<void> {
    if (!this.datasetId) throw new Error('No default dataset configured')
    await this.http.post(`${this.apiUrl}/storage/datasets/${this.datasetId}/items`, items)
  }

  protected async getValue<T = unknown>(key: string): Promise<T | null> {
    if (!this.kvStoreId) throw new Error('No default KV store configured')
    try {
      const { data } = await this.http.get(`${this.apiUrl}/storage/kv-stores/${this.kvStoreId}/keys/${key}`)
      return data as T
    } catch {
      return null
    }
  }

  protected async setValue(key: string, value: unknown, contentType = 'application/json'): Promise<void> {
    if (!this.kvStoreId) throw new Error('No default KV store configured')
    const body = typeof value === 'string' ? value : JSON.stringify(value)
    await this.http.put(
      `${this.apiUrl}/storage/kv-stores/${this.kvStoreId}/keys/${key}`,
      body,
      { headers: { 'Content-Type': contentType } },
    )
  }

  private createLogger(): ActorLogger {
    const emit = (level: string, message: string, meta?: Record<string, unknown>) => {
      const entry = JSON.stringify({ timestamp: new Date().toISOString(), level, message, ...meta })
      console.log(entry)
    }
    return {
      debug: (msg, meta) => emit('DEBUG', msg, meta),
      info: (msg, meta) => emit('INFO', msg, meta),
      warn: (msg, meta) => emit('WARN', msg, meta),
      error: (msg, meta) => emit('ERROR', msg, meta),
    }
  }

  static async main<TInput, TOutput>(ActorClass: new () => Actor<TInput, TOutput>): Promise<void> {
    const input = JSON.parse(process.env.TUDUMM_INPUT ?? '{}') as TInput
    const actor = new ActorClass()
    try {
      const output = await actor.run(input)
      console.log(JSON.stringify({ __tudumm_output: output }))
      process.exit(0)
    } catch (err) {
      console.error(JSON.stringify({ __tudumm_error: String(err) }))
      process.exit(1)
    }
  }
}
