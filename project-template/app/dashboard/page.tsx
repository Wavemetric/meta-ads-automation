import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import type { ActionQueue } from '@/lib/supabase/types'

export const revalidate = 0

function getTodayKstUtcIso(): string {
  const nowKst = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
  const todayKstStart = new Date(nowKst.getFullYear(), nowKst.getMonth(), nowKst.getDate())
  return new Date(todayKstStart.getTime() - 9 * 60 * 60 * 1000).toISOString()
}

function cpaStatus(current: number | null, target: number) {
  if (current == null) return { label: '데이터 없음', bg: '#f9fafb', border: '#e5e7eb', color: '#6b7280' }
  if (current <= target) return { label: '목표 달성', bg: '#f0fdf4', border: '#bbf7d0', color: '#16a34a' }
  if (current <= target * 1.2) return { label: '주의', bg: '#fefce8', border: '#fde68a', color: '#ca8a04' }
  return { label: '초과', bg: '#fef2f2', border: '#fecaca', color: '#dc2626' }
}

function cpaColor(current: number | null, target: number) {
  if (current == null) return '#9ca3af'
  if (current <= target) return '#16a34a'
  if (current <= target * 1.2) return '#ca8a04'
  return '#dc2626'
}

type CpaStat = {
  name: string
  target_cpa: number
  current_cpa: number | null
  total_spend: number
  total_conversions: number
  campaign_count: number
}

function CpaCard({ s }: { s: CpaStat }) {
  const status = cpaStatus(s.current_cpa, s.target_cpa)
  const ratio = s.current_cpa != null ? (s.current_cpa / s.target_cpa) * 100 : null
  const color = cpaColor(s.current_cpa, s.target_cpa)
  return (
    <div
      className="bg-white rounded-xl p-4 flex flex-col gap-3"
      style={{ border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold" style={{ color: '#111827' }}>{s.name}</p>
        <span
          className="text-xs px-2 py-0.5 rounded-full shrink-0 font-medium"
          style={{ background: status.bg, border: `1px solid ${status.border}`, color: status.color }}
        >
          {status.label}
        </span>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs mb-0.5" style={{ color: '#9ca3af' }}>현재 CPA</p>
          <p className="text-2xl font-bold" style={{ color }}>
            {s.current_cpa != null ? `₩${Math.round(s.current_cpa).toLocaleString('ko-KR')}` : '-'}
          </p>
        </div>
        {ratio != null && (
          <p className="text-lg font-bold" style={{ color }}>{Math.round(ratio)}%</p>
        )}
      </div>
      <div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#f3f4f6' }}>
          {ratio != null && (
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(ratio, 100)}%`,
                background: ratio <= 100 ? '#22c55e' : ratio <= 120 ? '#f59e0b' : '#ef4444',
              }}
            />
          )}
        </div>
        <div className="flex justify-between text-xs mt-1" style={{ color: '#d1d5db' }}>
          <span>0</span>
          <span>목표 ₩{s.target_cpa.toLocaleString('ko-KR')}</span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 pt-1" style={{ borderTop: '1px solid #f3f4f6' }}>
        <div>
          <p className="text-xs" style={{ color: '#9ca3af' }}>지출</p>
          <p className="text-xs font-medium mt-0.5" style={{ color: '#374151' }}>
            ₩{Math.round(s.total_spend / 1000).toLocaleString('ko-KR')}k
          </p>
        </div>
        <div>
          <p className="text-xs" style={{ color: '#9ca3af' }}>전환</p>
          <p className="text-xs font-medium mt-0.5" style={{ color: '#374151' }}>{s.total_conversions}건</p>
        </div>
        <div>
          <p className="text-xs" style={{ color: '#9ca3af' }}>세트</p>
          <p className="text-xs font-medium mt-0.5" style={{ color: '#374151' }}>{s.campaign_count}개</p>
        </div>
      </div>
    </div>
  )
}

function buildStats(
  targets: { name: string; target_cpa: number }[],
  latest: { campaign_name: string | null; spend: number | null; conversions: number | null }[]
): CpaStat[] {
  return targets
    .map(t => {
      const matched = latest.filter(s =>
        (s.campaign_name ?? '').toLowerCase().includes(t.name.toLowerCase())
      )
      const totalSpend = matched.reduce((sum, s) => sum + (s.spend ?? 0), 0)
      const totalConversions = matched.reduce((sum, s) => sum + (s.conversions ?? 0), 0)
      return {
        name: t.name,
        target_cpa: t.target_cpa,
        current_cpa: totalConversions > 0 ? totalSpend / totalConversions : null,
        total_spend: totalSpend,
        total_conversions: totalConversions,
        campaign_count: matched.length,
      }
    })
    .filter(s => s.campaign_count > 0 && s.total_spend > 0)
}

export default async function DashboardPage() {
  const supabase = createClient()
  const todayIso = getTodayKstUtcIso()

  const [snapshotsRes, productRes, promotionRes, pendingRes, todayQueueRes] = await Promise.all([
    supabase
      .from('campaigns_snapshot')
      .select('campaign_name, adset_name, spend, conversions')
      .order('captured_at', { ascending: false })
      .limit(500),
    supabase.from('product_target_cpas').select('product_name, target_cpa').eq('is_active', true),
    supabase.from('promotion_target_cpas').select('promotion_name, target_cpa').eq('is_active', true),
    supabase.from('action_queue').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase
      .from('action_queue')
      .select('status')
      .gte('created_at', todayIso),
  ])

  // 광고세트 기준 최신 스냅샷만 유지
  const latestMap = new Map<string, NonNullable<typeof snapshotsRes.data>[number]>()
  for (const s of snapshotsRes.data ?? []) {
    const key = s.adset_name ?? s.campaign_name ?? ''
    if (!latestMap.has(key)) latestMap.set(key, s)
  }
  const latest = Array.from(latestMap.values())

  const productStats = buildStats(
    (productRes.data ?? []).map(p => ({ name: p.product_name, target_cpa: p.target_cpa })),
    latest
  )
  const promotionStats = buildStats(
    (promotionRes.data ?? []).map(p => ({ name: p.promotion_name, target_cpa: p.target_cpa })),
    latest
  )

  const pendingCount = pendingRes.count ?? 0
  const todayQueue = todayQueueRes.data ?? []
  const todayDone = todayQueue.filter(q =>
    ['approved', 'rejected', 'executed', 'failed'].includes(q.status)
  ).length

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#111827' }}>대시보드</h1>
          <p className="text-sm mt-1" style={{ color: '#6b7280' }}>실시간 광고 성과 현황</p>
        </div>
        {pendingCount > 0 && (
          <Link
            href="/dashboard/queue"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ background: '#fefce8', border: '1px solid #fde68a', color: '#ca8a04' }}
          >
            <span style={{ fontSize: '8px', color: '#f59e0b' }}>●</span>
            승인 대기 {pendingCount}건 →
          </Link>
        )}
      </div>

      {/* 오늘 활동 요약 */}
      <div
        className="rounded-xl p-5 flex items-center gap-6"
        style={{ background: '#ffffff', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
      >
        <div>
          <p className="text-xs font-medium" style={{ color: '#9ca3af' }}>오늘 승인 대기</p>
          <p className="text-3xl font-bold mt-1" style={{ color: pendingCount > 0 ? '#ca8a04' : '#111827' }}>
            {pendingCount}<span className="text-sm font-normal ml-1" style={{ color: '#9ca3af' }}>건</span>
          </p>
        </div>
        <div className="w-px self-stretch" style={{ background: '#e5e7eb' }} />
        <div>
          <p className="text-xs font-medium" style={{ color: '#9ca3af' }}>오늘 처리 완료</p>
          <p className="text-3xl font-bold mt-1" style={{ color: '#111827' }}>
            {todayDone}<span className="text-sm font-normal ml-1" style={{ color: '#9ca3af' }}>건</span>
          </p>
        </div>
      </div>

      {/* 상품별 CPA */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold" style={{ color: '#374151' }}>상품별 CPA</h2>
          <span className="text-xs" style={{ color: '#9ca3af' }}>라이브 캠페인만 표시</span>
        </div>
        {productStats.length === 0 ? (
          <div
            className="rounded-xl px-6 py-10 text-center"
            style={{ background: '#ffffff', border: '1px solid #e5e7eb' }}
          >
            <p className="text-sm" style={{ color: '#9ca3af' }}>현재 라이브 중인 상품 캠페인이 없습니다</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {productStats.map(s => <CpaCard key={s.name} s={s} />)}
          </div>
        )}
      </section>

      {/* 프로모션별 CPA */}
      {((promotionRes.data ?? []).length > 0) && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold" style={{ color: '#374151' }}>프로모션별 CPA</h2>
            <span className="text-xs" style={{ color: '#9ca3af' }}>라이브 캠페인만 표시</span>
          </div>
          {promotionStats.length === 0 ? (
            <div
              className="rounded-xl px-6 py-10 text-center"
              style={{ background: '#ffffff', border: '1px solid #e5e7eb' }}
            >
              <p className="text-sm" style={{ color: '#9ca3af' }}>현재 라이브 중인 프로모션 캠페인이 없습니다</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {promotionStats.map(s => <CpaCard key={s.name} s={s} />)}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
