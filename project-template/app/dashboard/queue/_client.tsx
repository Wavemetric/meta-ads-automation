'use client'

import { useEffect, useState, useCallback } from 'react'
import { createBrowserClient } from '@/lib/supabase/browser'
import type { ActionQueue, ProposedChange } from '@/lib/supabase/types'

const STATUS_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  pending:  { color: '#ca8a04', bg: '#fefce8', border: '#fde68a' },
  approved: { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  rejected: { color: '#6b7280', bg: '#f3f4f6', border: '#e5e7eb' },
  executed: { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  failed:   { color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
}

const STATUS_LABEL: Record<string, string> = {
  pending:  '대기',
  approved: '승인됨',
  rejected: '거절됨',
  executed: '실행됨',
  failed:   '실패',
}

function fmt(v: number | null | undefined, prefix = '') {
  if (v == null) return '-'
  return `${prefix}${v.toLocaleString('ko-KR')}`
}

export default function QueuePage() {
  const supabase = createBrowserClient()
  const [items, setItems] = useState<ActionQueue[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'pending' | 'history'>('pending')

  const loadItems = useCallback(async () => {
    setLoading(true)
    if (tab === 'pending') {
      const { data } = await supabase
        .from('action_queue')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(100)
      setItems(data ?? [])
    } else {
      const { data } = await supabase
        .from('action_queue')
        .select('*')
        .in('status', ['approved', 'rejected', 'executed', 'failed'])
        .order('created_at', { ascending: false })
        .limit(100)
      setItems(data ?? [])
    }
    setLoading(false)
  }, [supabase, tab])

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

  function fmtDate(iso: string) {
    const d = new Date(iso)
    const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
    const mo = String(kst.getUTCMonth() + 1).padStart(2, '0')
    const day = String(kst.getUTCDate()).padStart(2, '0')
    const h = String(kst.getUTCHours()).padStart(2, '0')
    const min = String(kst.getUTCMinutes()).padStart(2, '0')
    return `${mo}.${day} ${h}:${min}`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#111827' }}>최적화 실행</h1>
        <p className="text-sm mt-1" style={{ color: '#6b7280' }}>
          {tab === 'pending' ? '실행 전 검토가 필요한 액션 목록' : '처리 완료된 액션 이력'}
        </p>
      </div>

      {/* Tabs */}
      <div
        className="flex gap-1 p-1 rounded-lg w-fit"
        style={{ background: '#f3f4f6', border: '1px solid #e5e7eb' }}
      >
        {([['pending', '승인 대기'], ['history', '실행 이력']] as const).map(([v, label]) => (
          <button
            key={v}
            onClick={() => setTab(v)}
            className="text-sm px-4 py-2 rounded-md font-medium transition-all duration-150"
            style={tab === v ? {
              background: '#ffffff',
              color: '#111827',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            } : { color: '#6b7280' }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-2 py-4" style={{ color: '#9ca3af' }}>
          <div className="w-3 h-3 rounded-full animate-pulse" style={{ background: '#3b82f6' }} />
          <span className="text-sm">불러오는 중...</span>
        </div>
      )}

      {/* Empty state */}
      {!loading && items.length === 0 && (
        <div
          className="rounded-xl px-6 py-16 text-center"
          style={{ background: '#ffffff', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
        >
          <div
            className="w-10 h-10 rounded-full mx-auto mb-3 flex items-center justify-center"
            style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}
          >
            <span style={{ color: '#16a34a', fontSize: '18px' }}>✓</span>
          </div>
          <p className="text-sm font-medium" style={{ color: '#374151' }}>
            {tab === 'pending' ? '승인 대기 항목이 없습니다' : '실행 이력이 없습니다'}
          </p>
          <p className="text-xs mt-1" style={{ color: '#9ca3af' }}>
            {tab === 'pending' ? '규칙이 위반되면 이곳에 표시됩니다' : '처리된 액션이 이곳에 표시됩니다'}
          </p>
        </div>
      )}

      {/* Items */}
      <div className="space-y-3">
        {items.map(item => {
          const change = item.proposed_change as unknown as ProposedChange
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
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold truncate" style={{ color: '#111827' }}>
                      {item.campaign_name ?? item.campaign_id}
                    </p>
                    {change.is_midnight_rule && (
                      <span
                        className="shrink-0 text-xs px-1.5 py-0.5 rounded font-medium"
                        style={{ background: '#eef2ff', border: '1px solid #c7d2fe', color: '#6366f1' }}
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
                    <div className="w-px self-stretch" style={{ background: '#e5e7eb' }} />
                    <div>
                      <span className="text-xs" style={{ color: '#9ca3af' }}>현재값</span>
                      <p className="text-xs font-medium mt-0.5" style={{ color: '#374151' }}>
                        {fmt(change.current_value)}
                      </p>
                    </div>
                    <div className="w-px self-stretch" style={{ background: '#e5e7eb' }} />
                    <div>
                      <span className="text-xs" style={{ color: '#9ca3af' }}>임계값</span>
                      <p className="text-xs font-medium mt-0.5" style={{ color: '#374151' }}>
                        {fmt(change.threshold)}
                      </p>
                    </div>
                    {change.proposed_budget != null && (
                      <>
                        <div className="w-px self-stretch" style={{ background: '#e5e7eb' }} />
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
                    {fmtDate(item.created_at)} KST
                    {item.approved_by && ` · ${item.approved_by}`}
                  </p>
                </div>

                {/* Status badge */}
                <span
                  className="shrink-0 text-xs px-2.5 py-1 rounded-full font-medium"
                  style={{ background: stat.bg, border: `1px solid ${stat.border}`, color: stat.color }}
                >
                  {STATUS_LABEL[item.status] ?? item.status}
                </span>
              </div>

              {/* Action buttons — pending only */}
              {item.status === 'pending' && (
                <div className="flex justify-end gap-2 mt-3">
                  <button
                    onClick={() => handleApprove(item.id)}
                    className="text-xs px-3 py-1.5 rounded-md font-medium transition-colors"
                    style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' }}
                  >
                    확인
                  </button>
                  <button
                    onClick={() => handleReject(item.id)}
                    className="text-xs px-3 py-1.5 rounded-md font-medium transition-colors"
                    style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }}
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
