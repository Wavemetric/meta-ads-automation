'use client'

import { useEffect, useState, useCallback } from 'react'
import { createBrowserClient } from '@/lib/supabase/browser'
import type { ActionQueue, ProposedChange, CampaignsSnapshot } from '@/lib/supabase/types'

const RECENT_WINDOW_HOURS = 2

type RecentTrend = {
  // 최근 N시간 윈도 안에 누적된 증분 기반 지표
  spend: number
  conversions: number
  cpa: number | null
  clicks: number
  impressions: number
  ctr: number | null
  revenue: number
  roas: number | null
  fromIso: string  // 윈도 시작 시점 스냅샷 captured_at
  toIso: string    // 윈도 끝 시점 스냅샷 captured_at
}

function computeRecentTrend(snapshots: CampaignsSnapshot[]): RecentTrend | null {
  if (snapshots.length < 2) return null
  // captured_at 오름차순
  const sorted = [...snapshots].sort((a, b) => a.captured_at.localeCompare(b.captured_at))
  const latest = sorted[sorted.length - 1]
  const latestTs = new Date(latest.captured_at).getTime()
  const windowStart = latestTs - RECENT_WINDOW_HOURS * 3600 * 1000
  // 윈도 시작점 이전(또는 동일)에 가장 가까운 스냅샷을 base로
  let base: CampaignsSnapshot | null = null
  for (const s of sorted) {
    const ts = new Date(s.captured_at).getTime()
    if (ts <= windowStart) base = s
    else break
  }
  // 윈도가 자정을 가로지르면 누적값이 리셋되어 delta가 음수가 됨 → 신호 무시
  if (!base) return null
  const dSpend = latest.spend - base.spend
  if (dSpend < 0) return null
  const dConv = latest.conversions - base.conversions
  const dClicks = latest.clicks - base.clicks
  const dImpr = latest.impressions - base.impressions
  const dRev = latest.revenue - base.revenue
  return {
    spend: dSpend,
    conversions: dConv,
    cpa: dConv > 0 ? dSpend / dConv : null,
    clicks: dClicks,
    impressions: dImpr,
    ctr: dImpr > 0 ? (dClicks / dImpr) * 100 : null,
    revenue: dRev,
    roas: dSpend > 0 ? dRev / dSpend : null,
    fromIso: base.captured_at,
    toIso: latest.captured_at,
  }
}

function getRecentMetricValue(metric: string, trend: RecentTrend): number | null {
  switch (metric) {
    case 'cpa':   return trend.cpa
    case 'roas':  return trend.roas
    case 'ctr':   return trend.ctr
    case 'spend': return trend.spend
    default:      return null
  }
}

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

function fmtBudget(v: number | null | undefined) {
  if (v == null) return '–'
  return `₩${Math.round(v).toLocaleString('ko-KR')}`
}

function getStatusLabel(status: string | null | undefined): string {
  if (!status) return '알 수 없음'
  const s = status.toUpperCase()
  if (s === 'ACTIVE') return '실행 중'
  if (s === 'PAUSED') return '정지됨'
  if (s.includes('PAUSED')) return '정지됨'
  if (s.includes('ACTIVE')) return '실행 중'
  return status
}

function PendingCard({
  item,
  onApprove,
  onReject,
  selected,
  onToggleSelect,
  trend,
}: {
  item: ActionQueue
  onApprove: (id: string) => void
  onReject: (id: string) => void
  selected: boolean
  onToggleSelect: (id: string) => void
  trend: RecentTrend | null
}) {
  const change = item.proposed_change as unknown as ProposedChange
  const entity = getEntityLabel(change, item)
  const over = isOverThreshold(change)
  const isBudgetAction = BUDGET_ACTIONS.has(change.action)
  const isToggleAction = TOGGLE_ACTIONS.has(change.action)
  const ruleName = change.rule_name ?? change.reason?.match(/^\[([^\]]+)\]/)?.[1] ?? null
  const ruleDescription = change.rule_description ?? null
  const actionColor = getActionColor(change.action)
  const currentStatus = change.current_status ?? null
  const recentValue = trend ? getRecentMetricValue(change.metric, trend) : null
  // CPA/spend는 높을수록 나쁨, ROAS/CTR은 낮을수록 나쁨
  const highIsBad = ['cpa', 'spend'].includes(change.metric)
  const recentWorse = recentValue != null && (
    (highIsBad && recentValue > change.current_value) ||
    (!highIsBad && recentValue < change.current_value)
  )

  return (
    <div
      className="rounded-xl overflow-hidden transition-shadow"
      style={{
        background: '#ffffff',
        boxShadow: selected
          ? '0 0 0 2px #6366f1, 0 2px 8px rgba(99,102,241,0.2), 0 8px 24px rgba(99,102,241,0.1)'
          : '0 0 0 1px rgba(0,0,0,0.05), 0 2px 8px rgba(0,0,0,0.05), 0 8px 24px rgba(0,0,0,0.04)',
      }}
    >
      {/* ① 뱃지 스트립 — 맥락 정보, 작게 */}
      <div className="px-4 pt-3 pb-0 flex items-center gap-1.5">
        <label
          className="flex items-center cursor-pointer select-none mr-1"
          onClick={e => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(item.id)}
            className="cursor-pointer"
            style={{ width: '14px', height: '14px', accentColor: '#6366f1' }}
          />
        </label>
        <span
          className="text-xs font-semibold px-1.5 py-0.5 rounded-full"
          style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1' }}
        >
          {entity.type}
        </span>
        {/* 토글 액션이 아닌 경우(예산 조치 등)에도 현재 광고 상태를 작은 뱃지로 노출 */}
        {!isToggleAction && currentStatus && (
          <span
            className="text-xs px-1.5 py-0.5 rounded-full"
            style={{
              background: getStatusLabel(currentStatus) === '실행 중' ? 'rgba(16,185,129,0.08)' : '#f4f4f5',
              color: getStatusLabel(currentStatus) === '실행 중' ? '#059669' : '#71717a',
            }}
          >
            {getStatusLabel(currentStatus)}
          </span>
        )}
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
            {change.target_cpa_source && change.target_cpa_matched_name && (
              <span className="ml-1" style={{ color: '#c4c4c8' }}>
                ({change.target_cpa_source === 'promotion' ? '프로모션' : '상품'} · {change.target_cpa_matched_name})
              </span>
            )}
          </p>
          {/* 최근 N시간 윈도의 동일 지표 — 트렌드 비교 */}
          {recentValue != null && (
            <p
              className="text-xs mt-1.5 font-semibold"
              style={{ color: recentWorse ? '#dc2626' : '#71717a' }}
              title={trend ? `${trend.fromIso.slice(11,16)} → ${trend.toIso.slice(11,16)} (KST)` : undefined}
            >
              최근 {RECENT_WINDOW_HOURS}h {fmtMetric(change.metric, recentValue)}
              {recentWorse && <span className="ml-1">▲ 악화</span>}
            </p>
          )}
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
            <div className="mt-2 flex items-baseline gap-1.5 flex-wrap">
              <span
                className="font-bold"
                style={{ fontSize: '13px', color: '#71717a', letterSpacing: '-0.01em' }}
              >
                {fmtBudget(change.current_budget)}
              </span>
              <span style={{ fontSize: '11px', color: '#d4d4d8' }}>→</span>
              <span
                className="font-black"
                style={{ fontSize: '16px', color: '#059669', letterSpacing: '-0.02em' }}
              >
                {fmtBudget(change.proposed_budget)}
              </span>
            </div>
          )}

          {isToggleAction && (
            <div className="flex items-center gap-1.5 mt-2">
              <span
                className="text-xs font-bold px-2 py-0.5 rounded"
                style={{ background: '#ebebeb', color: '#71717a' }}
              >
                {getStatusLabel(currentStatus) || (change.action === 'pause' ? '실행 중' : '정지됨')}
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

      {/* ③.5 적용 규칙 — 본문에 직접 노출 */}
      {ruleName && (
        <div
          className="mx-4 mb-3 px-3 py-2 rounded-lg flex items-start gap-2"
          style={{ background: '#fafafa', border: '1px solid #f0f0f0' }}
        >
          <span
            className="text-xs font-bold shrink-0 mt-0.5"
            style={{ color: '#a1a1aa', letterSpacing: '0.02em' }}
          >
            규칙
          </span>
          <div className="min-w-0 flex-1">
            <p
              className="text-xs font-semibold truncate"
              style={{ color: '#3f3f46' }}
              title={ruleName}
            >
              {ruleName}
            </p>
            {ruleDescription && (
              <p
                className="text-xs mt-0.5 leading-relaxed"
                style={{ color: '#a1a1aa' }}
              >
                {ruleDescription}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ④ 푸터 */}
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{ borderTop: '1px solid #f4f4f5' }}
      >
        <span className="text-xs" style={{ color: '#d4d4d8' }}>{fmtDate(item.created_at)} KST</span>

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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const [trends, setTrends] = useState<Map<string, RecentTrend>>(new Map())
  const [productFilter, setProductFilter] = useState<string | null>(null)
  const [filterOptions, setFilterOptions] = useState<{ name: string; kind: 'promotion' | 'product' }[]>([])

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

    // 최근 N시간 + 윈도 기준점 확보를 위해 약간 더 길게 (4시간) 스냅샷 조회
    const adsetIds = Array.from(new Set(
      filteredPending
        .map(i => (i.proposed_change as any)?.adset_id as string | null | undefined)
        .filter((v): v is string => !!v)
    ))
    const trendMap = new Map<string, RecentTrend>()
    if (adsetIds.length > 0) {
      const sinceIso = new Date(Date.now() - (RECENT_WINDOW_HOURS + 2) * 3600 * 1000).toISOString()
      const { data } = await supabase
        .from('campaigns_snapshot')
        .select('*')
        .in('adset_id', adsetIds)
        .gte('captured_at', sinceIso)
        .order('captured_at', { ascending: true })
      const byAdset = new Map<string, CampaignsSnapshot[]>()
      for (const s of (data ?? []) as CampaignsSnapshot[]) {
        if (!s.adset_id) continue
        const arr = byAdset.get(s.adset_id) ?? []
        arr.push(s)
        byAdset.set(s.adset_id, arr)
      }
      for (const [adsetId, snaps] of byAdset) {
        const t = computeRecentTrend(snaps)
        if (t) trendMap.set(adsetId, t)
      }
    }
    setTrends(trendMap)
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

  // 필터 옵션 (활성 상품/프로모션 이름)
  useEffect(() => {
    (async () => {
      const [pr, pm] = await Promise.all([
        supabase.from('product_target_cpas').select('product_name').eq('is_active', true).order('product_name'),
        supabase.from('promotion_target_cpas').select('promotion_name').eq('is_active', true).order('promotion_name'),
      ])
      const opts: { name: string; kind: 'promotion' | 'product' }[] = []
      for (const p of (pm.data ?? []) as { promotion_name: string }[]) opts.push({ name: p.promotion_name, kind: 'promotion' })
      for (const p of (pr.data ?? []) as { product_name: string }[]) opts.push({ name: p.product_name, kind: 'product' })
      setFilterOptions(opts)
    })()
  }, [supabase])

  async function approveOne(id: string) {
    await fetch(`/api/actions/approve/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approved_by: 'dashboard' }),
    })
  }

  async function rejectOne(id: string, note: string | null) {
    await fetch(`/api/actions/reject/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note }),
    })
  }

  async function handleApprove(id: string) {
    await approveOne(id)
    setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n })
    loadItems()
  }

  async function handleReject(id: string) {
    const note = prompt('거절 사유 (선택)')
    await rejectOne(id, note)
    setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n })
    loadItems()
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }

  function changeTab(next: MainTab) {
    setTab(next)
    setSelectedIds(new Set())
  }

  const matchesProductFilter = (item: ActionQueue) => {
    if (!productFilter) return true
    const name = (item.campaign_name ?? '').toLowerCase()
    return name.includes(productFilter.toLowerCase())
  }
  const budgetItems = pending.filter(item =>
    BUDGET_ACTIONS.has((item.proposed_change as any)?.action) && matchesProductFilter(item)
  )
  const toggleItems = pending.filter(item =>
    TOGGLE_ACTIONS.has((item.proposed_change as any)?.action) && matchesProductFilter(item)
  )
  const filteredHistory = history.filter(matchesProductFilter)
  const visibleItems = tab === 'budget' ? budgetItems : tab === 'toggle' ? toggleItems : filteredHistory

  // 현재 보이는 pending 항목들 중 선택된 ID만 추림 (탭 전환 후 잔여 잠금 방지)
  const visiblePendingIds = (tab === 'history' ? [] : visibleItems).map(i => i.id)
  const selectedVisibleIds = visiblePendingIds.filter(id => selectedIds.has(id))
  const allSelected = visiblePendingIds.length > 0 && selectedVisibleIds.length === visiblePendingIds.length

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(prev => {
        const n = new Set(prev)
        for (const id of visiblePendingIds) n.delete(id)
        return n
      })
    } else {
      setSelectedIds(prev => {
        const n = new Set(prev)
        for (const id of visiblePendingIds) n.add(id)
        return n
      })
    }
  }

  async function bulkApprove() {
    if (selectedVisibleIds.length === 0) return
    if (!confirm(`${selectedVisibleIds.length}개 항목을 일괄 승인합니다. 계속할까요?`)) return
    setBulkBusy(true)
    try {
      await Promise.all(selectedVisibleIds.map(id => approveOne(id)))
      setSelectedIds(new Set())
      await loadItems()
    } finally {
      setBulkBusy(false)
    }
  }

  async function bulkReject() {
    if (selectedVisibleIds.length === 0) return
    const note = prompt(`${selectedVisibleIds.length}개 항목을 일괄 거절합니다. 거절 사유 (선택)`)
    if (note === null) return // 취소
    setBulkBusy(true)
    try {
      await Promise.all(selectedVisibleIds.map(id => rejectOne(id, note || null)))
      setSelectedIds(new Set())
      await loadItems()
    } finally {
      setBulkBusy(false)
    }
  }

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

      {/* 탭 + 상품 필터 */}
      <div className="flex items-center gap-3 flex-wrap">
      <div
        className="flex gap-1 p-1 rounded-xl w-fit"
        style={{ background: '#f4f4f5', border: '1px solid #e4e4e7' }}
      >
        {tabConfig.map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => changeTab(key)}
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

      {/* 상품/프로모션 필터 */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold" style={{ color: '#a1a1aa' }}>필터</span>
        <select
          value={productFilter ?? ''}
          onChange={e => { setProductFilter(e.target.value || null); setSelectedIds(new Set()) }}
          className="text-sm px-3 py-1.5 rounded-lg font-medium"
          style={{
            background: '#ffffff',
            border: '1px solid #e4e4e7',
            color: productFilter ? '#0f0f11' : '#71717a',
            outline: 'none',
            minWidth: '180px',
          }}
        >
          <option value="">전체</option>
          {filterOptions.filter(o => o.kind === 'promotion').length > 0 && (
            <optgroup label="프로모션">
              {filterOptions.filter(o => o.kind === 'promotion').map(o => (
                <option key={`pm-${o.name}`} value={o.name}>{o.name}</option>
              ))}
            </optgroup>
          )}
          {filterOptions.filter(o => o.kind === 'product').length > 0 && (
            <optgroup label="상품">
              {filterOptions.filter(o => o.kind === 'product').map(o => (
                <option key={`pr-${o.name}`} value={o.name}>{o.name}</option>
              ))}
            </optgroup>
          )}
        </select>
        {productFilter && (
          <button
            onClick={() => { setProductFilter(null); setSelectedIds(new Set()) }}
            className="text-xs px-2 py-1 rounded-md font-semibold"
            style={{ background: '#f4f4f5', color: '#71717a', border: '1px solid #e4e4e7' }}
          >
            해제
          </button>
        )}
      </div>
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

      {tab !== 'history' && visiblePendingIds.length > 0 && (
        <div
          className="sticky top-0 z-10 flex items-center gap-3 px-4 py-2.5 rounded-xl"
          style={{
            background: selectedVisibleIds.length > 0 ? 'rgba(99,102,241,0.06)' : '#ffffff',
            border: `1px solid ${selectedVisibleIds.length > 0 ? 'rgba(99,102,241,0.2)' : '#e4e4e7'}`,
            backdropFilter: 'blur(8px)',
          }}
        >
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleSelectAll}
              style={{ width: '14px', height: '14px', accentColor: '#6366f1' }}
            />
            <span className="text-xs font-semibold" style={{ color: '#3f3f46' }}>
              {allSelected ? '전체 해제' : '전체 선택'}
            </span>
          </label>

          <div className="flex-1 text-xs" style={{ color: '#71717a' }}>
            {selectedVisibleIds.length > 0
              ? <span className="font-semibold" style={{ color: '#6366f1' }}>{selectedVisibleIds.length}개 선택됨</span>
              : <span>여러 항목을 체크해서 한 번에 처리할 수 있어요</span>}
          </div>

          <button
            onClick={bulkReject}
            disabled={selectedVisibleIds.length === 0 || bulkBusy}
            className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-all duration-150"
            style={{
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.2)',
              color: '#dc2626',
              opacity: selectedVisibleIds.length === 0 || bulkBusy ? 0.4 : 1,
              cursor: selectedVisibleIds.length === 0 || bulkBusy ? 'not-allowed' : 'pointer',
            }}
          >
            선택 거절
          </button>
          <button
            onClick={bulkApprove}
            disabled={selectedVisibleIds.length === 0 || bulkBusy}
            className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-all duration-150"
            style={{
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: '#ffffff',
              boxShadow: '0 1px 4px rgba(99,102,241,0.3)',
              opacity: selectedVisibleIds.length === 0 || bulkBusy ? 0.4 : 1,
              cursor: selectedVisibleIds.length === 0 || bulkBusy ? 'not-allowed' : 'pointer',
            }}
          >
            {bulkBusy ? '처리 중...' : '선택 승인'}
          </button>
        </div>
      )}

      {tab !== 'history' ? (
        <div className="grid grid-cols-2 gap-4">
          {visibleItems.map(item => (
            <PendingCard
              key={item.id}
              item={item}
              onApprove={handleApprove}
              onReject={handleReject}
              selected={selectedIds.has(item.id)}
              onToggleSelect={toggleSelect}
              trend={(() => {
                const adsetId = (item.proposed_change as any)?.adset_id as string | undefined
                return adsetId ? trends.get(adsetId) ?? null : null
              })()}
            />
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
