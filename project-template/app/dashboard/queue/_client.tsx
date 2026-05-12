'use client'

import { useEffect, useState, useCallback } from 'react'
import { createBrowserClient } from '@/lib/supabase/browser'
import type { ActionQueue, ProposedChange } from '@/lib/supabase/types'

function getEntityLabel(change: ProposedChange, item: ActionQueue) {
  if (change.adset_name) return { type: '광고 세트', name: change.adset_name }
  if (item.campaign_name) return { type: '캠페인', name: item.campaign_name }
  return { type: '광고', name: item.campaign_id }
}

function getMetricLabel(metric: string) {
  return ({ cpa: 'CPA', roas: 'ROAS', ctr: 'CTR', spend: '일 지출' } as Record<string, string>)[metric] ?? metric.toUpperCase()
}

function getActionShortLabel(action: string): string {
  return ({
    decrease_budget: '예산 감축',
    increase_budget: '예산 증액',
    pause: '캠페인 정지',
    resume: '캠페인 재개',
    replace_creative: '소재 교체',
    set_budget_yesterday: '전일 예산',
    set_budget_yesterday_50pct: '전일 50%',
    set_budget_yesterday_70pct: '전일 70%',
    set_budget_current: '예산 유지',
  } as Record<string, string>)[action] ?? action
}

function getActionColor(action: string): { color: string; bg: string; border: string } {
  if (['pause', 'decrease_budget', 'set_budget_yesterday_50pct', 'set_budget_yesterday_70pct'].includes(action))
    return { color: '#dc2626', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)' }
  if (['resume', 'increase_budget'].includes(action))
    return { color: '#059669', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)' }
  return { color: '#6366f1', bg: 'rgba(99,102,241,0.08)', border: 'rgba(99,102,241,0.2)' }
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
    case 'pause':                        return `해당 ${t}을 즉시 중단하십시오`
    case 'resume':                       return `해당 ${t}을 재개하십시오`
    case 'decrease_budget':              return `해당 ${t}의 예산을 줄이십시오`
    case 'increase_budget':              return `해당 ${t}의 예산을 늘리십시오`
    case 'replace_creative':             return `소재를 교체하십시오`
    case 'set_budget_current':           return `현재 예산을 그대로 유지하십시오`
    case 'set_budget_yesterday':         return `전일 예산과 동일하게 설정하십시오`
    case 'set_budget_yesterday_50pct':   return `전일 예산의 50%로 줄이십시오`
    case 'set_budget_yesterday_70pct':   return `전일 예산의 70%로 줄이십시오`
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
  pending:  { color: '#d97706', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.3)' },
  approved: { color: '#2563eb', bg: 'rgba(99,102,241,0.08)', border: 'rgba(99,102,241,0.2)' },
  rejected: { color: '#71717a', bg: '#f4f4f5',               border: '#e4e4e7' },
  executed: { color: '#059669', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.25)' },
  failed:   { color: '#dc2626', bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.25)' },
}
const STATUS_LABEL: Record<string, string> = {
  pending: '대기', approved: '승인됨', rejected: '거절됨', executed: '실행됨', failed: '실패',
}

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
  const isBudgetAction = BUDGET_ACTIONS.has(change.action)
  const isToggleAction = TOGGLE_ACTIONS.has(change.action)
  const ruleName = change.rule_name ?? change.reason?.match(/^\[([^\]]+)\]/)?.[1] ?? null
  const actionColor = getActionColor(change.action)

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: '#ffffff',
        boxShadow: '0 0 0 1px rgba(0,0,0,0.05), 0 2px 8px rgba(0,0,0,0.05), 0 8px 24px rgba(0,0,0,0.04)',
      }}
    >
      {/* ① 뱃지 스트립 — 맥락 정보, 작게 */}
      <div className="px-4 pt-3 pb-0 flex items-center gap-1.5">
        <span
          className="text-xs font-semibold px-1.5 py-0.5 rounded-full"
          style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1' }}
        >
          {entity.type}
        </span>
        {change.is_midnight_rule && (
          <span
            className="text-xs px-1.5 py-0.5 rounded-full"
            style={{ background: 'rgba(99,102,241,0.06)', color: '#818cf8' }}
          >
            자정
          </span>
        )}
        <div className="flex-1" />
        <span
          className="text-xs px-2 py-0.5 rounded-full font-semibold"
          style={{ background: 'rgba(245,158,11,0.1)', color: '#d97706' }}
        >
          검토 필요
        </span>
      </div>

      {/* ② 캠페인명 — 가장 먼저 눈에 들어오는 PRIMARY 정보 */}
      <div className="px-4 pt-2 pb-3">
        <p
          className="font-black truncate"
          style={{ fontSize: '17px', color: '#0f0f11', letterSpacing: '-0.01em', lineHeight: 1.3 }}
        >
          {entity.name}
        </p>
      </div>

      {/* ③ 본문: 2열 — 감지된 상태 / 추천 조치 */}
      <div className="px-4 pb-4 grid grid-cols-2 gap-3">
        {/* 왼쪽: 현재 수치 — 핵심 숫자를 크게 */}
        <div
          className="rounded-lg p-3"
          style={{
            background: over ? 'rgba(239,68,68,0.04)' : 'rgba(16,185,129,0.04)',
            border: `1px solid ${over ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)'}`,
          }}
        >
          <p className="text-xs mb-1.5" style={{ color: '#a1a1aa' }}>{getMetricLabel(change.metric)}</p>
          <p
            className="font-black"
            style={{
              fontSize: '22px',
              color: over ? '#dc2626' : '#059669',
              letterSpacing: '-0.03em',
              lineHeight: 1,
            }}
          >
            {fmtMetric(change.metric, change.current_value)}
          </p>
          <p className="text-xs mt-2" style={{ color: '#a1a1aa' }}>
            목표 {fmtMetric(change.metric, change.threshold)}
          </p>
        </div>

        {/* 오른쪽: 추천 조치 */}
        <div className="rounded-lg p-3" style={{ background: '#f9f9f9', border: '1px solid #f0f0f0' }}>
          <p className="text-xs mb-1.5" style={{ color: '#a1a1aa' }}>추천 조치</p>
          <span
            className="text-sm font-black px-2.5 py-1 rounded-lg inline-block"
            style={{
              background: actionColor.bg,
              border: `1px solid ${actionColor.border}`,
              color: actionColor.color,
              letterSpacing: '-0.01em',
            }}
          >
            {getActionShortLabel(change.action)}
          </span>

          {isBudgetAction && change.proposed_budget != null && (
            <p
              className="font-black mt-2"
              style={{ fontSize: '16px', color: '#059669', letterSpacing: '-0.02em' }}
            >
              ₩{Math.round(change.proposed_budget).toLocaleString('ko-KR')}
            </p>
          )}

          {isToggleAction && (
            <div className="flex items-center gap-1.5 mt-2">
              <span
                className="text-xs font-bold px-2 py-0.5 rounded"
                style={{ background: '#ebebeb', color: '#71717a' }}
              >
                {change.action === 'pause' ? '실행 중' : '정지됨'}
              </span>
              <span className="text-xs" style={{ color: '#d4d4d8' }}>→</span>
              <span
                className="text-xs font-bold px-2 py-0.5 rounded"
                style={{
                  background: change.action === 'pause' ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                  color: change.action === 'pause' ? '#dc2626' : '#059669',
                }}
              >
                {change.action === 'pause' ? '정지' : '재개'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ④ 푸터 */}
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{ borderTop: '1px solid #f4f4f5' }}
      >
        <div className="flex items-center gap-2">
          {/* [적용규칙] 호버 툴팁 */}
          {ruleName && (
            <div className="relative group">
              <span
                className="text-xs px-2 py-0.5 rounded cursor-default select-none"
                style={{ background: '#f4f4f5', color: '#a1a1aa', border: '1px solid #e4e4e7' }}
              >
                적용규칙
              </span>
              <div
                className="absolute bottom-full left-0 mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none"
                style={{ zIndex: 20 }}
              >
                <div
                  className="text-xs font-semibold whitespace-nowrap px-2.5 py-1.5 rounded-lg"
                  style={{
                    background: '#18181b',
                    color: '#e4e4e7',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                  }}
                >
                  {ruleName}
                </div>
              </div>
            </div>
          )}
          <span className="text-xs" style={{ color: '#d4d4d8' }}>{fmtDate(item.created_at)} KST</span>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => onReject(item.id)}
            className="text-sm px-4 py-2 rounded-xl font-semibold transition-all duration-200"
            style={{
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.2)',
              color: '#dc2626',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.14)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.08)' }}
          >
            거절
          </button>
          <button
            onClick={() => onApprove(item.id)}
            className="text-sm px-5 py-2 rounded-xl font-semibold transition-all duration-200"
            style={{
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: '#ffffff',
              boxShadow: '0 2px 8px rgba(99,102,241,0.35)',
            }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLButtonElement
              el.style.boxShadow = '0 4px 12px rgba(99,102,241,0.5)'
              el.style.transform = 'translateY(-1px)'
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLButtonElement
              el.style.boxShadow = '0 2px 8px rgba(99,102,241,0.35)'
              el.style.transform = 'translateY(0)'
            }}
          >
            승인
          </button>
        </div>
      </div>
    </div>
  )
}

function HistoryRow({ item }: { item: ActionQueue }) {
  const change = item.proposed_change as unknown as ProposedChange
  const entity = getEntityLabel(change, item)
  const stat = STATUS_STYLE[item.status] ?? STATUS_STYLE.approved

  return (
    <div
      className="px-5 py-4 flex items-start gap-3 rounded-xl transition-all duration-200"
      style={{
        background: '#ffffff',
        boxShadow: '0 0 0 1px rgba(0,0,0,0.04), 0 1px 4px rgba(0,0,0,0.04)',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 1px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.06)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 1px rgba(0,0,0,0.04), 0 1px 4px rgba(0,0,0,0.04)' }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1' }}
          >
            {entity.type}
          </span>
          <p className="text-sm font-semibold truncate" style={{ color: '#0f0f11' }}>{entity.name}</p>
        </div>
        <p className="text-xs mt-1.5 leading-relaxed" style={{ color: '#71717a' }}>
          {getStatusSentence(change)} — {getActionSentence(change, entity.type)}
        </p>
        <p className="text-xs mt-1" style={{ color: '#d4d4d8' }}>
          {fmtDate(item.created_at)} KST
          {item.approved_by ? ` · ${item.approved_by}` : ''}
        </p>
      </div>
      <span
        className="shrink-0 text-xs px-2.5 py-1 rounded-full font-semibold"
        style={{ background: stat.bg, border: `1px solid ${stat.border}`, color: stat.color }}
      >
        {STATUS_LABEL[item.status] ?? item.status}
      </span>
    </div>
  )
}

const BUDGET_ACTIONS = new Set(['decrease_budget', 'increase_budget', 'set_budget_yesterday', 'set_budget_yesterday_50pct', 'set_budget_yesterday_70pct', 'replace_creative'])
const TOGGLE_ACTIONS = new Set(['pause', 'resume'])
const SKIP_ACTIONS   = new Set(['set_budget_current'])

type MainTab = 'budget' | 'toggle' | 'history'

export default function QueuePage() {
  const supabase = createBrowserClient()
  const [pending, setPending] = useState<ActionQueue[]>([])
  const [history, setHistory] = useState<ActionQueue[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<MainTab>('budget')

  const loadItems = useCallback(async () => {
    setLoading(true)
    const [pendingRes, historyRes] = await Promise.all([
      supabase.from('action_queue').select('*').eq('status', 'pending').order('created_at', { ascending: false }).limit(200),
      supabase.from('action_queue').select('*').in('status', ['approved', 'rejected', 'executed', 'failed']).order('created_at', { ascending: false }).limit(100),
    ])
    const filteredPending = (pendingRes.data ?? []).filter(item =>
      !SKIP_ACTIONS.has((item.proposed_change as any)?.action)
    )
    setPending(filteredPending)
    setHistory(historyRes.data ?? [])
    setLoading(false)
  }, [supabase])

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

  const budgetItems = pending.filter(item => BUDGET_ACTIONS.has((item.proposed_change as any)?.action))
  const toggleItems = pending.filter(item => TOGGLE_ACTIONS.has((item.proposed_change as any)?.action))
  const visibleItems = tab === 'budget' ? budgetItems : tab === 'toggle' ? toggleItems : history

  const tabConfig: { key: MainTab; label: string; count?: number }[] = [
    { key: 'budget', label: '예산 조치', count: budgetItems.length },
    { key: 'toggle', label: '온오프 조치', count: toggleItems.length },
    { key: 'history', label: '실행 이력' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-black" style={{ fontSize: '26px', color: '#0f0f11', letterSpacing: '-0.02em' }}>
          최적화 실행
        </h1>
        <p className="text-sm mt-1" style={{ color: '#a1a1aa' }}>
          {tab === 'history' ? '처리된 조치 이력입니다' : '검토 후 승인하면 조치 완료로 처리됩니다'}
        </p>
      </div>

      {/* 탭 */}
      <div
        className="flex gap-1 p-1 rounded-xl w-fit"
        style={{ background: '#f4f4f5', border: '1px solid #e4e4e7' }}
      >
        {tabConfig.map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className="text-sm px-4 py-2 rounded-lg font-semibold transition-all duration-150 flex items-center gap-1.5"
            style={tab === key ? {
              background: '#ffffff',
              color: '#0f0f11',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            } : {
              color: '#a1a1aa',
            }}
          >
            {label}
            {count != null && count > 0 && (
              <span
                className="rounded-full font-bold"
                style={{
                  fontSize: '10px',
                  padding: '1px 6px',
                  background: tab === key ? 'rgba(245,158,11,0.15)' : '#e4e4e7',
                  color: tab === key ? '#d97706' : '#a1a1aa',
                }}
              >
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 로딩 */}
      {loading && (
        <div className="flex items-center gap-2 py-4" style={{ color: '#a1a1aa' }}>
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#6366f1' }} />
          <span className="text-sm">불러오는 중...</span>
        </div>
      )}

      {/* 빈 상태 */}
      {!loading && visibleItems.length === 0 && (
        <div
          className="rounded-2xl px-6 py-20 text-center"
          style={{
            background: '#ffffff',
            boxShadow: '0 0 0 1px rgba(0,0,0,0.05), 0 2px 8px rgba(0,0,0,0.04)',
          }}
        >
          <div
            className="w-12 h-12 rounded-2xl mx-auto mb-4 flex items-center justify-center"
            style={{ background: 'rgba(16,185,129,0.1)' }}
          >
            <span style={{ color: '#10b981', fontSize: '20px' }}>✓</span>
          </div>
          <p className="text-sm font-semibold" style={{ color: '#3f3f46' }}>
            {tab === 'history' ? '실행 이력이 없습니다' : '조치 필요 항목이 없습니다'}
          </p>
          <p className="text-xs mt-1.5" style={{ color: '#a1a1aa' }}>
            {tab === 'history' ? '처리된 조치가 여기에 표시됩니다' : '규칙 조건에 맞는 캠페인이 감지되면 여기에 표시됩니다'}
          </p>
        </div>
      )}

      {tab !== 'history' ? (
        <div className="grid grid-cols-2 gap-4">
          {visibleItems.map(item => (
            <PendingCard key={item.id} item={item} onApprove={handleApprove} onReject={handleReject} />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {visibleItems.map(item => <HistoryRow key={item.id} item={item} />)}
        </div>
      )}
    </div>
  )
}
