import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/client'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const note: string = body.note ?? ''

  const supabase = createClient()

  const { error } = await supabase
    .from('action_queue')
    .update({ status: 'rejected', note })
    .eq('id', id)
    .eq('status', 'pending')

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ id, status: 'rejected' })
}
