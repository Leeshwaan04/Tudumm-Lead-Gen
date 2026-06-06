/**
 * AI-assisted extraction — turn arbitrary page text into structured rows from a
 * plain-English instruction, via Groq. Shared by the Web Scraper actor and the
 * scrape-web workflow node. Returns [] on any failure (caller falls back).
 */
export async function aiExtract(text: string, prompt: string): Promise<Record<string, unknown>[]> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey || !text || !prompt) return []
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 2048,
        temperature: 0.1,
        messages: [
          { role: 'system', content: 'You extract structured data from web page text. Respond with ONLY a JSON array of objects (no prose, no markdown). Use consistent keys; include a "website" or "domain" key when a company URL is present.' },
          { role: 'user', content: `From the page content below, extract: ${prompt}\nReturn a JSON array of objects.\n\nPAGE CONTENT:\n${text.slice(0, 12000)}` },
        ],
      }),
      signal: AbortSignal.timeout(30000),
    })
    if (!res.ok) return []
    const data = await res.json()
    const raw: string = data.choices?.[0]?.message?.content ?? '[]'
    const arr = JSON.parse(raw.match(/\[[\s\S]*\]/)?.[0] ?? '[]')
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}
