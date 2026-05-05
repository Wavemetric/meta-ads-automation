'use client'
import dynamic from 'next/dynamic'

// SSR 비활성화 — Supabase Realtime은 브라우저에서만 동작
const QueueContent = dynamic(() => import('./_client'), { ssr: false })

export default function QueuePage() {
  return <QueueContent />
}
