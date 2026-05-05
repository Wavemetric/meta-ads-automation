import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/client'
import { executeAction } from '@/lib/meta/executor'
import type { ProposedChange } from '@/lib/supabase/types'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const approvedBy: string = body.approved_by ?? 'dashboard'

  const supabase = createClient()

  const { data: item, error } = await supabase
    .from('action_queue')
    .select('*')
    .eq('id', id)
    .eq('status', 'pending')
    .single()

  if (error || !item) {
    return Response.json({ error: 'Queue item not found or already processed' }, { status: 404 })
  }

  // 승인 처리
  await supabase
    .from('action_queue')
    .update({ status: 'approved', approved_by: approvedBy })
    .eq('id', id)

  // 즉시 실행
  const change = item.proposed_change as unknown as ProposedChange
  const { result, response, error: execError } = await executeAction(item.campaign_id, change)

  await supabase
    .from('action_queue')
    .update({ status: result === 'success' ? 'executed' : 'failed' })
    .eq('id', id)

  await supabase.from('execution_log').insert({
    action_queue_id: id,
    meta_api_response: response as never,
    result,
    error_message: execError ?? null,
  })

  return Response.json({ id, result, error: execError })
}
