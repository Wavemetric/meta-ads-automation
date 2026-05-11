'use client'

import { useEffect, useState, useCallback } from 'react'
import { createBrowserClient } from '@/lib/supabase/browser'
import type { ActionQueue, ProposedChange } from '@/lib/supabase/types'

const SEVERITY_STYLE: Record<string, { bg: string; border: string; color: string; glow: string }> = {
  high:   { bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.25)',  color: '#f87171', glow: '0 0 10px rgba(239,68,68,0.2)' },
  medium: { bg: 'rgba(234,179,8,0.1)',  border: 'rgba(234,179,8,0.25)',  color: '#fbbf24', glow: '0 0 10px rgba(234,179,8,0.2)' },
  low:    { bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.25)', color: '#34d399', glow: '0 0 10px rgba(16,185,129,0.15)' },
}

const STATUS_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  pending:  { color: '#fbbf24', bg: 'rgba(234,179,8,0.08)',   border: 'rgba(234,179,8,0.2)' },
  approved: { color: '#60a5fa', bg: 'rgba(59,130,246,0.08)',  border: 'rgba(59,130,246,0.2)' },
  rejected: { color: 'rgba(255,255,255,0.3)', bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.1)' },
  executed: { color: '#34d399', bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.2)' },
  failed:   { color: '#f87171', bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.2)' },
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
          <h1
            className="text-2xl font-bold"
            style={{
              background: 'linear-gradient(90deg, #fff 60%, rgba(255,255,255,0.5))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            승인 대기 큐
          </h1>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
            실행 전 검토가 필요한 액션 목록
          </p>
        </div>

        {/* Filter tabs */}
        <div
          className="flex gap-1 p-1 rounded-lg"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          {(['pending', 'all'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="text-xs px-3 py-1.5 rounded-md font-medium transition-all duration-150"
              style={filter === f ? {
                background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                color: '#fff',
                boxShadow: '0 0 10px rgba(59,130,246,0.2)',
              } : {
                color: 'rgba(255,255,255,0.4)',
              }}
            >
              {f === 'pending' ? '대기 중' : '전체'}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-2 py-4" style={{ color: 'rgba(255,255,255,0.25)' }}>
          <div
            className="w-3 h-3 rounded-full animate-pulse"
            style={{ background: 'rgba(59,130,246,0.5)' }}
          />
          <span className="text-sm">불러오는 중...</span>
        </div>
      )}

      {/* Empty state */}
      {!loading && items.length === 0 && (
        <div
          className="rounded-xl px-6 py-16 text-center"
          style={{
            background: 'rgba(17,17,24,0.6)',
            border: '1px solid rgba(255,255,255,0.06)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <div
            className="w-10 h-10 rounded-full mx-auto mb-3 flex items-center justify-center"
            style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}
          >
            <span style={{ color: '#34d399', fontSize: '18px' }}>✓</span>
          </div>
          <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>
            승인 대기 항목이 없습니다
          </p>
          <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.2)' }}>
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
                background: 'rgba(17,17,24,0.7)',
                border: `1px solid rgba(255,255,255,0.07)`,
                backdropFilter: 'blur(12px)',
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
                    boxShadow: sev.glow,
                  }}
                >
                  {item.severity.toUpperCase()}
                </span>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold truncate" style={{ color: 'rgba(255,255,255,0.9)' }}>
                      {item.campaign_name ?? item.campaign_id}
                    </p>
                    {change.is_midnight_rule && (
                      <span
                        className="shrink-0 text-xs px-1.5 py-0.5 rounded font-medium"
                        style={{
                          background: 'rgba(99,102,241,0.15)',
                          border: '1px solid rgba(99,102,241,0.25)',
                          color: '#a5b4fc',
                          boxShadow: '0 0 6px rgba(99,102,241,0.15)',
                        }}
                      >
                        00시 규칙
                      </span>
                    )}
                  </div>

                  <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
                    {change.reason}
                  </p>

                  {/* Metrics row */}
                  <div
                    className="flex flex-wrap gap-3 mt-3 px-3 py-2 rounded-lg"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
                  >
                    <div>
                      <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>액션</span>
                      <p className="text-xs font-medium mt-0.5" style={{ color: '#60a5fa' }}>{change.action}</p>
                    </div>
                    <div
                      className="w-px self-stretch"
                      style={{ background: 'rgba(255,255,255,0.06)' }}
                    />
                    <div>
                      <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>현재값</span>
                      <p className="text-xs font-medium mt-0.5" style={{ color: 'rgba(255,255,255,0.7)' }}>
                        {fmt(change.current_value)}
                      </p>
                    </div>
                    <div
                      className="w-px self-stretch"
                      style={{ background: 'rgba(255,255,255,0.06)' }}
                    />
                    <div>
                      <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>임계값</span>
                      <p className="text-xs font-medium mt-0.5" style={{ color: 'rgba(255,255,255,0.7)' }}>
                        {fmt(change.threshold)}
                      </p>
                    </div>
                    {change.proposed_budget != null && (
                      <>
                        <div
                          className="w-px self-stretch"
                          style={{ background: 'rgba(255,255,255,0.06)' }}
                        />
                        <div>
                          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>제안 예산</span>
                          <p className="text-xs font-medium mt-0.5" style={{ color: '#34d399' }}>
                            {fmt(change.proposed_budget, '₩')}
                          </p>
                        </div>
                      </>
                    )}
                  </div>

                  <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.2)' }}>
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
                  style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <button
                    onClick={() => handleApprove(item.id)}
                    className="flex-1 text-sm py-2 rounded-lg font-medium transition-all duration-150"
                    style={{
                      background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                      color: '#fff',
                      boxShadow: '0 0 16px rgba(59,130,246,0.2)',
                    }}
                  >
                    확인 (실행 보류)
                  </button>
                  <button
                    onClick={() => handleReject(item.id)}
                    className="px-5 text-sm py-2 rounded-lg font-medium transition-all duration-150"
                    style={{
                      background: 'rgba(239,68,68,0.08)',
                      border: '1px solid rgba(239,68,68,0.2)',
                      color: '#f87171',
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
