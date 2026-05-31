import { parse } from 'csv-parse'
import { Readable } from 'stream'

export async function parseCsvStream(file: File): Promise<Record<string, string>[]> {
  const records: Record<string, string>[] = []
  
  // @ts-ignore
  const nodeStream = Readable.fromWeb(file.stream())
  
  const parser = nodeStream.pipe(parse({
    columns: (headers) => headers.map((h: string) => h.trim().toLowerCase()),
    skip_empty_lines: true,
    bom: true,
    relax_quotes: true,
    relax_column_count: true,
  }))

  for await (const record of parser) {
    const row: Record<string, string> = {}
    for (const key in record) {
      row[key] = (record[key] ?? '').trim()
    }
    records.push(row)
  }
  return records
}
