import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from './types'

// 서버 사이드 전용 (Service Role Key — RLS 우회)
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
  return createSupabaseClient<Database>(url, key)
}
