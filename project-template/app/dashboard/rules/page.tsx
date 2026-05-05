'use client'
import dynamic from 'next/dynamic'

// SSR 비활성화 — Supabase 클라이언트는 브라우저에서만 초기화
const RulesContent = dynamic(() => import('./_client'), { ssr: false })

export default function RulesPage() {
  return <RulesContent />
}
