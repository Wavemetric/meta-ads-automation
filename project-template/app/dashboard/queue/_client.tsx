'use client'

import { useEffect, useState, useCallback } from 'react'
import { createBrowserClient } from '@/lib/supabase/browser'
import type { ActionQueue, ProposedChange } from '@/lib/supabase/types'

// ─── 헬퍼 ───────────────────────────────────────────────────────────────────

function getEntityLabel(change: ProposedChange, item: ActionQueue) {
  if (change.adset_name) return { type: '광고 세트', name: change.adset_name }
  if (item.campaign_name) return { type: '캠페인', name: item.campaign_name }
  return { type: '광고', name: item.campaign_id }
}

function getMetricLabel(metric: string) {
  return ({ cpa: 'CPA', roas: 'ROAS', ctr: 'CTR', spend: '일 지출' } as Record<string, string>)[metric] ?? metric.toUpperCase()
}

function fmtMetric(metric: string, value: number) {
  if (['cpa', 'spend'].includes(metric)) return `₩${Math.round(value).toLocaleString('ko-KR')}`
  if (metric === 'roas') return `${(value * 100).toFixed(0)}%`
  if (metric === 'ctr') return `${value.toFixed(2)}%`
  return Math.round(value).toLocaleString('ko-KR')
}

function getStatusSentence(change: ProposedChange) {
  const label = getMetricLabel(change.metric)
  const curr = fmtMetric(change.metric, change.current_value)
  const thr = fmtMetric(change.metric, change.threshold)
  const diffPct = Math.abs(Math.round(((change.current_value - change.threshold) / change.threshold) * 100))

  if (change.current_value > change.threshold) {
    if (['cpa', 'spend'].includes(change.metric))
      return `현재 ${label}가 ${curr}으로, 목표 ${thr} 대비 ${diffPct}% 초과했습니다`
    return `현재 ${label}가 ${curr}으로 기준치 ${thr}를 초과했습니다`
  } else {
    if (change.metric === 'cpa')
      return `현재 ${label}가 ${curr}으로, 목표 ${thr} 이하로 양호합니다`
    if (change.metric === 'roas')
      return `현재 ${label}가 ${curr}으로, 목표 ${thr}에 미달합니다`
    return `현재 ${label}가 ${curr}으로 기준치 ${thr} 이하입니다`
  }
}

function getActionSentence(change: ProposedChange, entityType: string) {
  const t = entityType
  switch (change.action) {
    case 'pause':                    return `해당 ${t}을 즉시 중단하십시오`
    case 'resume':                   return `해당 ${t}을 재개하십시오`
    case 'decrease_budget':          return `해당 ${t}의 예산을 줄이십시오`
    case 'increase_budget':          return `해당 ${t}의 예산을 늘리십시오`
    case 'replace_creative':         return `소재를 교체하십시오`
    case 'set_budget_current':       return `현재 예산을 그대로 유지하십시오`
    case 'set_budget_yesterday':     return `전일 예산과 동일하게 설정하십시오`
    case 'set_budget_yesterday_50pct': return `전일 예산의 50%로 줄이십시오`
    case 'set_budget_yesterday_70pct': return `전일 예산의 70%로 줄이십시오`
    default: return `조치를 실행하십시오`
  }
}

function isOverThreshold(change: ProposedChange) {
  return change.current_value > change.threshold
}

function fmtDate(iso: string) {
  const d = new Date(iso)
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
  return `${String(kst.getUTCMonth() + 1).padStart(2, '0')}.${String(kst.getUTCDate()).padStart(2, '0')} ${String(kst.getUTCHours()).padStart(2, '0')}:${String(kst.getUTCMinutes()).padStart(2, '0')}`
}

const STATUS_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  pending:  { color: '#ca8a04', bg: '#fefce8', border: '#fde68a' },
  approved: { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  rejected: { color: '#6b7280', bg: '#f3f4f6', border: '#e5e7eb' },
  executed: { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  failed:   { color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
}
const STATUS_LABEL: Record<string, string> = {
  pending: '대기', approved: '승인됨', rejected: '거절됨', executed: '실행됨', failed: '실패',
}

// ─── 승인 대기 카드 ─────────────────────────────────────────────────────────

function PendingCard({
  item,
  onApprove,
  onReject,
}: {
  item: ActionQueue
  onApprove: (id: string) => void
  onReject: (id: string) => void
}) {
  const change = item.proposed_change as unknown as ProposedChange
  const entity = getEntityLabel(change, item)
  const over = isOverThreshold(change)
  const isBudgetAction = ['decrease_budget', 'increase_budget', 'set_budget_yesterday',
    'set_budget_yesterday_50pct', 'set_budget_yesterday_70pct', 'set_budget_current'].includes(change.action)
  const isToggleAction = change.action === 'pause' || change.action === 'resume'

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: '#ffffff', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
    >
      {/* 헤더 */}
      <div
        className="px-5 py-3 flex items-center justify-between gap-3"
        style={{ background: '#f9fafb', borderBottom: '1px solid #f3f4f6' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="text-xs font-medium px-2 py-0.5 rounded shrink-0"
            style={{ background: '#e0e7ff', color: '#4f46e5' }}
          >
            {entity.type}
          </span>
          <p className="text-sm font-semibold truncate" style={{ color: '#111827' }}>{entity.name}</p>
          {change.is_midnight_rule && (
            <span
              className="text-xs px-1.5 py-0.5 rounded font-medium shrink-0"
              style={{ background: '#eef2ff', border: '1px solid #c7d2fe', color: '#6366f1' }}
            >
              자정 규칙
            </span>
          )}
        </div>
        <span
          className="shrink-0 text-xs px-2.5 py-1 rounded-full font-medium"
          style={{ background: '#fefce8', border: '1px solid #fde68a', color: '#ca8a04' }}
        >
          검토 필요
        </span>
      </div>

      <div className="p-5 space-y-5">
        {/* 감지된 상태 */}
        <div>
          <p className="text-xs font-semibold mb-2" style={{ color: '#9ca3af' }}>감지된 상태</p>
          <p className="text-sm leading-relaxed" style={{ color: '#374151' }}>
            {getStatusSentence(change)}
          </p>

          {/* 목표 → 현재 비교 */}
          <div
            className="flex items-center gap-4 mt-3 px-4 py-3 rounded-lg"
            style={{ background: '#f9fafb', border: '1px solid #e5e7eb' }}
          >
            <div className="text-center">
              <p className="text-xs mb-1" style={{ color: '#9ca3af' }}>목표</p>
              <p className="text-sm font-bold" style={{ color: '#6b7280' }}>
                {fmtMetric(change.metric, change.threshold)}
              </p>
            </div>
            <div className="flex-1 flex items-center">
              <div className="flex-1 h-px" style={{ background: '#d1d5db' }} />
              <span className="mx-2 text-sm" style={{ color: '#9ca3af' }}>→</span>
              <div
                className="flex-1 h-px"
                style={{ background: over ? '#f87171' : '#4ade80' }}
              />
            </div>
            <div className="text-center">
              <p className="text-xs mb-1" style={{ color: '#9ca3af' }}>현재</p>
              <p className="text-sm font-bold" style={{ color: over ? '#dc2626' : '#16a34a' }}>
                {fmtMetric(change.metric, change.current_value)}
              </p>
            </div>
          </div>
        </div>

        {/* 추천 조치 */}
        <div>
          <p className="text-xs font-semibold mb-2" style={{ color: '#9ca3af' }}>
            추천 조치{' '}
            <span style={{ fontWeight: 400, color: '#d1d5db' }}>(규칙 기반)</span>
          </p>
          <p className="text-sm leading-relaxed" style={{ color: '#374151' }}>
            {getActionSentence(change, entity.type)}
          </p>

          {/* 현재 → 변경 (예산 액션) */}
          {isBudgetAction && change.proposed_budget != null && (
            <div
              className="flex items-center gap-4 mt-3 px-4 py-3 rounded-lg"
              style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}
            >
              <div className="text-center">
                <p className="text-xs mb-1" style={{ color: '#9ca3af' }}>현재</p>
                <p className="text-sm font-bold" style={{ color: '#6b7280' }}>실행 중</p>
              </div>
              <div className="flex-1 flex items-center">
                <div className="flex-1 h-px" style={{ background: '#d1d5db' }} />
                <span className="mx-2 text-sm" style={{ color: '#9ca3af' }}>→</span>
                <div className="flex-1 h-px" style={{ background: '#4ade80' }} />
              </div>
              <div className="text-center">
                <p className="text-xs mb-1" style={{ color: '#9ca3af' }}>제안 예산</p>
                <p className="text-sm font-bold" style={{ color: '#16a34a' }}>
                  ₩{Math.round(change.proposed_budget).toLocaleString('ko-KR')}
                </p>
              </div>
            </div>
          )}

          {/* 현재 → 변경 (정지/재개 액션) */}
          {isToggleAction && (
            <div
              className="flex items-center gap-4 mt-3 px-4 py-3 rounded-lg"
              style={{ background: change.action === 'pause' ? '#fef2f2' : '#f0fdf4', border: `1px solid ${change.action === 'pause' ? '#fecaca' : '#bbf7d0'}` }}
            >
              <div className="text-center">
                <p className="text-xs mb-1" style={{ color: '#9ca3af' }}>현재</p>
                <p className="text-sm font-bold" style={{ color: '#6b7280' }}>
                  {change.action === 'pause' ? '실행 중' : '정지됨'}
                </p>
              </div>
              <div className="flex-1 flex items-center">
                <div className="flex-1 h-px" style={{ background: '#d1d5db' }} />
                <span className="mx-2 text-sm" style={{ color: '#9ca3af' }}>→</span>
                <div
                  className="flex-1 h-px"
                  style={{ background: change.action === 'pause' ? '#f87171' : '#4ade80' }}
                />
              </div>
              <div className="text-center">
                <p className="text-xs mb-1" style={{ color: '#9ca3af' }}>변경</p>
                <p
                  className="text-sm font-bold"
                  style={{ color: change.action === 'pause' ? '#dc2626' : '#16a34a' }}
                >
                  {change.action === 'pause' ? '정지' : '재개'}
                </p>
              </div>
            </div>
          )}
        </div>

        <p className="text-xs" style={{ color: '#c4c9d4' }}>{fmtDate(item.created_at)} KST</p>
      </div>

      {/* 액션 버튼 */}
      <div
        className="px-5 py-3 flex justify-end gap-2"
        style={{ borderTop: '1px solid #f3f4f6' }}
      >
        <button
          onClick={() => onReject(item.id)}
          className="text-sm px-4 py-2 rounded-lg font-medium transition-colors"
          style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }}
        >
          거절
        </button>
        <button
          onClick={() => onApprove(item.id)}
          className="text-sm px-4 py-2 rounded-lg font-medium transition-colors"
          style={{ background: '#2563eb', color: '#ffffff' }}
        >
          승인
        </button>
      </div>
    </div>
  )
}

// ─── 이력 카드 (간소화) ─────────────────────────────────────────────────────

function HistoryRow({ item }: { item: ActionQueue }) {
  const change = item.proposed_change as unknown as ProposedChange
  const entity = getEntityLabel(change, item)
  const stat = STATUS_STYLE[item.status] ?? STATUS_STYLE.approved

  return (
    <div
      className="px-5 py-4 flex items-start gap-3 rounded-xl"
      style={{ background: '#ffffff', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium px-1.5 py-0.5 rounded" style={{ background: '#e0e7ff', color: '#4f46e5' }}>
            {entity.type}
          </span>
          <p className="text-sm font-medium truncate" style={{ color: '#111827' }}>{entity.name}</p>
        </div>
        <p className="text-xs mt-1.5 leading-relaxed" style={{ color: '#6b7280' }}>
          {getStatusSentence(change)} — {getActionSentence(change, entity.type)}
        </p>
        <p className="text-xs mt-1" style={{ color: '#c4c9d4' }}>
          {fmtDate(item.created_at)} KST
          {item.approved_by ? ` · ${item.approved_by}` : ''}
        </p>
      </div>
      <span
        className="shrink-0 text-xs px-2.5 py-1 rounded-full font-medium"
        style={{ background: stat.bg, border: `1px solid ${stat.border}`, color: stat.color }}
      >
        {STATUS_LABEL[item.status] ?? item.status}
      </span>
    </div>
  )
}

// ─── 메인 컴포넌트 ──────────────────────────────────────────────────────────

export default function QueuePage() {
  const supabase = createBrowserClient()
  const [items, setItems] = useState<ActionQueue[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'pending' | 'history'>('pending')

  const loadItems = useCallback(async () => {
    setLoading(true)
    const q = supabase.from('action_queue').select('*').order('created_at', { ascending: false }).limit(100)
    if (tab === 'pending') {
      q.eq('status', 'pending')
    } else {
      q.in('status', ['approved', 'rejected', 'executed', 'failed'])
    }
    const { data } = await q
    setItems(data ?? [])
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

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#111827' }}>최적화 실행</h1>
        <p className="text-sm mt-1" style={{ color: '#6b7280' }}>
          {tab === 'pending' ? '검토 후 승인하면 조치 완료로 처리됩니다' : '처리된 조치 이력입니다'}
        </p>
      </div>

      {/* 탭 */}
      <div
        className="flex gap-1 p-1 rounded-lg w-fit"
        style={{ background: '#f3f4f6', border: '1px solid #e5e7eb' }}
      >
        {([['pending', '승인 대기'], ['history', '실행 이력']] as const).map(([v, label]) => (
          <button
            key={v}
            onClick={() => setTab(v)}
            className="text-sm px-4 py-2 rounded-md font-medium transition-all duration-150"
            style={tab === v
              ? { background: '#ffffff', color: '#111827', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
              : { color: '#6b7280' }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 로딩 */}
      {loading && (
        <div className="flex items-center gap-2 py-4" style={{ color: '#9ca3af' }}>
          <div className="w-3 h-3 rounded-full animate-pulse" style={{ background: '#3b82f6' }} />
          <span className="text-sm">불러오는 중...</span>
        </div>
      )}

      {/* 빈 상태 */}
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
            {tab === 'pending' ? '규칙 조건에 맞는 캠페인이 감지되면 여기에 표시됩니다' : '처리된 조치가 여기에 표시됩니다'}
          </p>
        </div>
      )}

      {/* 목록 */}
      <div className="space-y-4">
        {tab === 'pending'
          ? items.map(item => (
              <PendingCard
                key={item.id}
                item={item}
                onApprove={handleApprove}
                onReject={handleReject}
              />
            ))
          : items.map(item => <HistoryRow key={item.id} item={item} />)
        }
      </div>
    </div>
  )
}
