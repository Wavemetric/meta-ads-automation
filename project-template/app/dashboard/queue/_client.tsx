'use client'

import { useEffect, useState, useCallback } from 'react'
import { createBrowserClient } from '@/lib/supabase/browser'
import type { ActionQueue, ProposedChange } from '@/lib/supabase/types'

const SEVERITY_STYLE: Record<string, { bg: string; border: string; color: string; glow: string }> = {
  high:   { bg: '#fef2f2', border: '#fecaca', color: '#dc2626', glow: 'none' },
  medium: { bg: '#fefce8', border: '#fde68a', color: '#ca8a04', glow: 'none' },
  low:    { bg: '#f0fdf4', border: '#bbf7d0', color: '#16a34a', glow: 'none' },
}

const STATUS_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  pending:  { color: '#ca8a04', bg: '#fefce8', border: '#fde68a' },
  approved: { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  rejected: { color: '#6b7280', bg: '#f3f4f6', border: '#e5e7eb' },
  executed: { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  failed:   { color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#111827' }}>
            승인 대기 큐
          </h1>
          <p className="text-sm mt-1" style={{ color: '#6b7280' }}>
            실행 전 검토가 필요한 액션 목록
          </p>
        </div>

        {/* Filter tabs */}
        <div
          className="flex gap-1 p-1 rounded-lg"
          style={{ background: '#f3f4f6', border: '1px solid #e5e7eb' }}
        >
          {(['pending', 'all'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="text-xs px-3 py-1.5 rounded-md font-medium transition-all duration-150"
              style={filter === f ? {
                background: '#3b82f6',
                color: '#fff',
                boxShadow: '0 1px 3px rgba(59,130,246,0.3)',
              } : {
                color: '#6b7280',
              }}
            >
              {f === 'pending' ? '대기 중' : '전체'}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-2 py-4" style={{ color: '#9ca3af' }}>
          <div
            className="w-3 h-3 rounded-full animate-pulse"
            style={{ background: '#3b82f6' }}
          />
          <span className="text-sm">불러오는 중...</span>
        </div>
      )}

      {/* Empty state */}
      {!loading && items.length === 0 && (
        <div
          className="rounded-xl px-6 py-16 text-center"
          style={{
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          }}
        >
          <div
            className="w-10 h-10 rounded-full mx-auto mb-3 flex items-center justify-center"
            style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}
          >
            <span style={{ color: '#16a34a', fontSize: '18px' }}>✓</span>
          </div>
          <p className="text-sm font-medium" style={{ color: '#374151' }}>
            승인 대기 항목이 없습니다
          </p>
          <p className="text-xs mt-1" style={{ color: '#9ca3af' }}>
            규칙이 위반되면 이곳에 표시됩니다
          </p>
        </div>
      )}

      {/* Items */}
      <div className="space-y-3">
        {items.map(item => {
          const change = item.proposed_change as unknown as ProposedChange
          const sev = SEVERITY_STYLE[item.severity] ?? SEVERITY_STYLE.low
          const stat = STATUS_STYLE[item.status] ?? STATUS_STYLE.pending
          return (
            <div
              key={item.id}
              className="rounded-xl p-5 transition-all duration-200"
              style={{
                background: '#ffffff',
                border: '1px solid #e5e7eb',
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              }}
            >
              <div className="flex items-start gap-3">
                {/* Severity badge */}
                <span
                  className="shrink-0 text-xs px-2.5 py-1 rounded-full font-semibold mt-0.5"
                  style={{
                    background: sev.bg,
                    border: `1px solid ${sev.border}`,
                    color: sev.color,
                  }}
                >
                  {item.severity.toUpperCase()}
                </span>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold truncate" style={{ color: '#111827' }}>
                      {item.campaign_name ?? item.campaign_id}
                    </p>
                    {change.is_midnight_rule && (
                      <span
                        className="shrink-0 text-xs px-1.5 py-0.5 rounded font-medium"
                        style={{
                          background: '#eef2ff',
                          border: '1px solid #c7d2fe',
                          color: '#6366f1',
                        }}
                      >
                        00시 규칙
                      </span>
                    )}
                  </div>

                  <p className="text-xs mt-1" style={{ color: '#6b7280' }}>
                    {change.reason}
                  </p>

                  {/* Metrics row */}
                  <div
                    className="flex flex-wrap gap-3 mt-3 px-3 py-2 rounded-lg"
                    style={{ background: '#f9fafb', border: '1px solid #e5e7eb' }}
                  >
                    <div>
                      <span className="text-xs" style={{ color: '#9ca3af' }}>액션</span>
                      <p className="text-xs font-medium mt-0.5" style={{ color: '#2563eb' }}>{change.action}</p>
                    </div>
                    <div
                      className="w-px self-stretch"
                      style={{ background: '#e5e7eb' }}
                    />
                    <div>
                      <span className="text-xs" style={{ color: '#9ca3af' }}>현재값</span>
                      <p className="text-xs font-medium mt-0.5" style={{ color: '#374151' }}>
                        {fmt(change.current_value)}
                      </p>
                    </div>
                    <div
                      className="w-px self-stretch"
                      style={{ background: '#e5e7eb' }}
                    />
                    <div>
                      <span className="text-xs" style={{ color: '#9ca3af' }}>임계값</span>
                      <p className="text-xs font-medium mt-0.5" style={{ color: '#374151' }}>
                        {fmt(change.threshold)}
                      </p>
                    </div>
                    {change.proposed_budget != null && (
                      <>
                        <div
                          className="w-px self-stretch"
                          style={{ background: '#e5e7eb' }}
                        />
                        <div>
                          <span className="text-xs" style={{ color: '#9ca3af' }}>제안 예산</span>
                          <p className="text-xs font-medium mt-0.5" style={{ color: '#16a34a' }}>
                            {fmt(change.proposed_budget, '₩')}
                          </p>
                        </div>
                      </>
                    )}
                  </div>

                  <p className="text-xs mt-2" style={{ color: '#9ca3af' }}>
                    {new Date(item.created_at).toLocaleString('ko-KR')}
                  </p>
                </div>

                {/* Status badge */}
                <span
                  className="shrink-0 text-xs px-2.5 py-1 rounded-full font-medium"
                  style={{
                    background: stat.bg,
                    border: `1px solid ${stat.border}`,
                    color: stat.color,
                  }}
                >
                  {item.status}
                </span>
              </div>

              {/* Action buttons */}
              {item.status === 'pending' && (
                <div
                  className="flex gap-2 mt-4 pt-4"
                  style={{ borderTop: '1px solid #e5e7eb' }}
                >
                  <button
                    onClick={() => handleApprove(item.id)}
                    className="flex-1 text-sm py-2 rounded-lg font-medium transition-all duration-150"
                    style={{
                      background: '#3b82f6',
                      color: '#fff',
                      boxShadow: '0 1px 3px rgba(59,130,246,0.3)',
                    }}
                  >
                    확인 (실행 보류)
                  </button>
                  <button
                    onClick={() => handleReject(item.id)}
                    className="px-5 text-sm py-2 rounded-lg font-medium transition-all duration-150"
                    style={{
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      color: '#dc2626',
                    }}
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
