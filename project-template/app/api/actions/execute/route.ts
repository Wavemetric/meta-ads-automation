import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/client'
import { executeAction } from '@/lib/meta/executor'
import type { ProposedChange } from '@/lib/supabase/types'

export async function POST(req: NextRequest) {
  // Cron Secret 또는 내부 호출 검증
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient()

  const { data: items, error } = await supabase
    .from('action_queue')
    .select('*')
    .eq('status', 'approved')
    .order('created_at', { ascending: true })
    .limit(20)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!items?.length) return Response.json({ executed: 0 })

  const results = []
  for (const item of items) {
    const change = item.proposed_change as unknown as ProposedChange

    const { result, response, error: execError } = await executeAction(item.campaign_id, change)

    await supabase
      .from('action_queue')
      .update({ status: result === 'success' ? 'executed' : 'failed' })
      .eq('id', item.id)

    await supabase.from('execution_log').insert({
      action_queue_id: item.id,
      meta_api_response: response as never,
      result,
      error_message: execError ?? null,
    })

    results.push({ id: item.id, result })
  }

  return Response.json({ executed: results.length, results })
}
