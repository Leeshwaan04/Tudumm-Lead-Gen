// Minimal RFC-4180 CSV parser. Handles quoted fields, embedded commas/newlines, and "" escapes.
// Returns an array of row objects keyed by lowercased header names.

export function parseCsv(text: string): Record<string, string>[] {
  const rows = parseRows(text)
  if (rows.length === 0) return []
  const headers = rows[0]!.map(h => h.trim().toLowerCase())
  return rows.slice(1).map(values => {
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = (values[i] ?? '').trim() })
    return row
  })
}

function parseRows(text: string): string[][] {
  // Normalize line endings
  const src = text.replace(/\r\n?/g, '\n')
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0

  while (i < src.length) {
    const ch = src[i]

    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i += 2; continue }
        inQuotes = false; i++; continue
      }
      field += ch; i++; continue
    }

    if (ch === '"') { inQuotes = true; i++; continue }
    if (ch === ',') { row.push(field); field = ''; i++; continue }
    if (ch === '\n') {
      row.push(field); field = ''
      if (row.length > 1 || row[0] !== '') rows.push(row)
      row = []; i++; continue
    }
    field += ch; i++
  }

  if (field !== '' || row.length > 0) {
    row.push(field)
    if (row.length > 1 || row[0] !== '') rows.push(row)
  }

  return rows
}
