import { Client as MinioClient } from 'minio'

export const STORAGE_BUCKET = process.env.MINIO_BUCKET ?? 'tudumm'

let _client: MinioClient | null = null

export function getStorageClient(): MinioClient {
  if (!_client) {
    _client = new MinioClient({
      endPoint: process.env.MINIO_ENDPOINT ?? 'localhost',
      port: parseInt(process.env.MINIO_PORT ?? '9000'),
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY ?? 'minioadmin',
      secretKey: process.env.MINIO_SECRET_KEY ?? 'minioadmin',
    })
  }
  return _client
}

/**
 * Upload JSON data to MinIO and return the object key.
 */
export async function uploadJSON(key: string, data: unknown): Promise<string> {
  const client = getStorageClient()
  const body = JSON.stringify(data)
  const buf = Buffer.from(body, 'utf-8')

  await ensureBucket(client)
  await client.putObject(STORAGE_BUCKET, key, buf, buf.length, { 'Content-Type': 'application/json' })
  return key
}

/**
 * Download and parse JSON from MinIO.
 */
export async function downloadJSON<T = unknown>(key: string): Promise<T> {
  const client = getStorageClient()
  const stream = await client.getObject(STORAGE_BUCKET, key)
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(Buffer.from(chunk))
  return JSON.parse(Buffer.concat(chunks).toString('utf-8')) as T
}

async function ensureBucket(client: MinioClient): Promise<void> {
  try {
    const exists = await client.bucketExists(STORAGE_BUCKET)
    if (!exists) await client.makeBucket(STORAGE_BUCKET, 'us-east-1')
  } catch {}
}
