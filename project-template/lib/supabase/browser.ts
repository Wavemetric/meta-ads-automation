'use client'

import { createBrowserClient as createSSRBrowserClient } from '@supabase/ssr'
import type { Database } from './types'

// @supabase/ssr의 createBrowserClient는 SSR 환경에서도 안전하게 동작
export function createBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
  return createSSRBrowserClient<Database>(url, key)
}
