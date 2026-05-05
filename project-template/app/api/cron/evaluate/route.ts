import { NextRequest } from 'next/server'
import { runRuleEngine } from '@/lib/rules/engine'

function verifyCronSecret(req: NextRequest) {
  return req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`
}

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runRuleEngine()
    return Response.json({ ...result, timestamp: new Date().toISOString() })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[cron/evaluate]', message)
    return Response.json({ error: message }, { status: 500 })
  }
}
