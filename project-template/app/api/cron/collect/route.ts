import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/client'
import { fetchAllAccountInsights, fetchAllAdsetMeta } from '@/lib/meta/client'
import { normalizeInsight, indexAdsetMeta } from '@/lib/meta/collector'

function verifyCronSecret(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  return authHeader === `Bearer ${process.env.CRON_SECRET}`
}

export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const [insights, adsetMetas] = await Promise.all([
      fetchAllAccountInsights('today'),
      fetchAllAdsetMeta(),
    ])
    const metaByAdset = indexAdsetMeta(adsetMetas)
    const rows = insights.map(i => normalizeInsight(i, metaByAdset.get(i.adset_id)))

    if (rows.length === 0) {
      return Response.json({ collected: 0, message: 'No insights returned from Meta API' })
    }

    const supabase = createClient()
    const { error } = await supabase.from('campaigns_snapshot').insert(rows)
    if (error) throw error

    return Response.json({
      collected: rows.length,
      timestamp: new Date().toISOString(),
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[cron/collect]', message)
    return Response.json({ error: message }, { status: 500 })
  }
}
