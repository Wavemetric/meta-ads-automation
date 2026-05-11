import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/client'

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

  // 확인 처리만 (실행 없음 — 실행 기능은 별도 승인 후 활성화 예정)
  await supabase
    .from('action_queue')
    .update({ status: 'approved', approved_by: approvedBy })
    .eq('id', id)

  return Response.json({ id, result: 'approved' })
}
