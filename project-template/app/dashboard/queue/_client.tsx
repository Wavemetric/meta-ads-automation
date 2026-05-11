'use client'

import { useEffect, useState, useCallback } from 'react'
import { createBrowserClient } from '@/lib/supabase/browser'
import type { ActionQueue, ProposedChange } from '@/lib/supabase/types'

const SEVERITY_STYLE: Record<string, string> = {
  high:   'bg-red-500/20 text-red-400 border border-red-500/30',
  medium: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  low:    'bg-green-500/20 text-green-400 border border-green-500/30',
}

const STATUS_STYLE: Record<string, string> = {
  pending:  'text-yellow-400',
  approved: 'text-blue-400',
  rejected: 'text-gray-500',
  executed: 'text-green-400',
  failed:   'text-red-400',
}

function fmt(v: number | null | undefined, prefix = '') {
  if (v == null) return '-'
  return `${prefix}${v.toLocaleString('ko-KR')}`
}

export default function QueuePage() {
  const supabase = createBrowserClient()
  const [items, setItems] = useState<ActionQueue[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'pending' | 'all'>('pending')

  const loadItems = useCallback(async () => {
    const q = supabase.from('action_queue').select('*').order('created_at', { ascending: false }).limit(50)
    if (filter === 'pending') q.eq('status', 'pending')
    const { data } = await q
    setItems(data ?? [])
    setLoading(false)
  }, [supabase, filter])

  useEffect(() => {
    loadItems()
    const channel = supabase
      .channel('queue-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'action_queue' }, loadItems)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase, loadItems])

  async function handleApprove(id: string) {
    await fetch(`/api/actions/approve/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approved_by: 'dashboard' }),
    })
    loadItems()
  }

  async function handleReject(id: string) {
    const note = prompt('거절 사유 (선택)')
    await fetch(`/api/actions/reject/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note }),
    })
    loadItems()
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">승인 대기 큐</h1>
        <div className="flex gap-2">
          {(['pending', 'all'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
                filter === f ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {f === 'pending' ? '대기 중' : '전체'}
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="text-gray-500 text-sm">불러오는 중...</p>}

      {!loading && items.length === 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg px-6 py-12 text-center">
          <p className="text-gray-500 text-sm">승인 대기 항목이 없습니다</p>
        </div>
      )}

      <div className="space-y-3">
        {items.map(item => {
          const change = item.proposed_change as unknown as ProposedChange
          return (
            <div key={item.id} className="bg-gray-900 border border-gray-800 rounded-lg p-5">
              <div className="flex items-start gap-3">
                <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${SEVERITY_STYLE[item.severity] ?? ''}`}>
                  {item.severity.toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-white truncate">{item.campaign_name ?? item.campaign_id}</p>
                    {change.is_midnight_rule && (
                      <span className="shrink-0 text-xs px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 font-medium">
                        00시 규칙
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{change.reason}</p>
                  <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-500">
                    <span>액션: <span className="text-gray-300">{change.action}</span></span>
                    <span>현재값: <span className="text-gray-300">{fmt(change.current_value)}</span></span>
                    <span>임계값: <span className="text-gray-300">{fmt(change.threshold)}</span></span>
                    {change.proposed_budget != null && (
                      <span>제안 예산: <span className="text-gray-300">{fmt(change.proposed_budget, '₩')}</span></span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 mt-1">{new Date(item.created_at).toLocaleString('ko-KR')}</p>
                </div>
                <span className={`shrink-0 text-xs font-medium ${STATUS_STYLE[item.status] ?? 'text-gray-400'}`}>
                  {item.status}
                </span>
              </div>

              {item.status === 'pending' && (
                <div className="flex gap-2 mt-4 pt-4 border-t border-gray-800">
                  <button
                    onClick={() => handleApprove(item.id)}
                    className="flex-1 text-sm py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
                  >
                    확인 (실행 보류)
                  </button>
                  <button
                    onClick={() => handleReject(item.id)}
                    className="px-4 text-sm py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-md transition-colors"
                  >
                    거절
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
