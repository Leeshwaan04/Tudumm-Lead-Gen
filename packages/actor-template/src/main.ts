import { Actor } from '@tudumm/sdk'

interface Input {
  startUrl: string
  maxResults?: number
  proxy?: {
    type?: 'RESIDENTIAL' | 'DATACENTER' | 'ISP' | 'NONE'
    country?: string
  }
}

interface Output {
  itemsScraped: number
  startedAt: string
  finishedAt: string
}

class MyActor extends Actor<Input, Output> {
  async run(input: Input): Promise<Output> {
    const startedAt = new Date().toISOString()
    const maxResults = input.maxResults ?? 100

    this.log.info('Starting actor', { url: input.startUrl, maxResults })

    // Your scraping logic goes here.
    // Use this.pushData() to save results to a dataset.
    // Use this.getValue() / this.setValue() for state persistence.

    const results: Record<string, unknown>[] = []

    for (let i = 0; i < Math.min(maxResults, 5); i++) {
      results.push({
        index: i,
        url: input.startUrl,
        scrapedAt: new Date().toISOString(),
        data: { example: `Item ${i}` },
      })
    }

    await this.pushData(results)
    this.log.info('Done', { itemsScraped: results.length })

    return {
      itemsScraped: results.length,
      startedAt,
      finishedAt: new Date().toISOString(),
    }
  }
}

Actor.main(MyActor)
