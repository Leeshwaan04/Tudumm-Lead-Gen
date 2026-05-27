import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  const workspaceId = (session as any)?.workspaceId
  if (!workspaceId) return new Response('Unauthorized', { status: 401 })

  const { id } = await params
  const run = await prisma.run.findFirst({ where: { id, workspaceId } })
  if (!run) return new Response('Not found', { status: 404 })

  const encoder = new TextEncoder()
  let closed = false

  const stream = new ReadableStream({
    async start(controller) {
      let lastTimestamp: Date | undefined

      const send = (data: unknown) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch {}
      }

      const poll = async () => {
        if (closed) return

        try {
          const logs = await prisma.runLog.findMany({
            where: {
              runId: id,
              ...(lastTimestamp ? { timestamp: { gt: lastTimestamp } } : {}),
            },
            orderBy: { timestamp: 'asc' },
          })

          for (const log of logs) {
            send({ type: 'log', data: log })
            lastTimestamp = log.timestamp
          }

          const current = await prisma.run.findUnique({ where: { id } })
          if (current) {
            send({ type: 'status', status: current.status })
            if (['SUCCEEDED', 'FAILED', 'CANCELLED'].includes(current.status)) {
              send({ type: 'done', status: current.status })
              controller.close()
              closed = true
              return
            }
          }
        } catch (e) {
          send({ type: 'error', message: String(e) })
        }

        if (!closed) setTimeout(poll, 1000)
      }

      await poll()
    },
    cancel() {
      closed = true
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
