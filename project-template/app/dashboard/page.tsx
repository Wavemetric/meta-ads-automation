import { createClient } from '@/lib/supabase/client'
import type { ProductTargetCpa, ActionQueue } from '@/lib/supabase/types'

function fmt(n: number | null | undefined, prefix = '', suffix = '') {
  if (n == null) return '-'
  return `${prefix}${n.toLocaleString('ko-KR')}${suffix}`
}

export const revalidate = 0

// KST 오늘 자정을 UTC ISO 문자열로 반환
function getTodayKstUtcIso(): string {
  const nowKst = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
  const todayKstStart = new Date(nowKst.getFullYear(), nowKst.getMonth(), nowKst.getDate())
  return new Date(todayKstStart.getTime() - 9 * 60 * 60 * 1000).toISOString()
}

// captured_at을 KST 문자열로 포매팅
function fmtKst(isoStr: string | null | undefined): string {
  if (!isoStr) return '-'
  const d = new Date(isoStr)
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
  const y = kst.getUTCFullYear()
  const mo = String(kst.getUTCMonth() + 1).padStart(2, '0')
  const day = String(kst.getUTCDate()).padStart(2, '0')
  const h = String(kst.getUTCHours()).padStart(2, '0')
  const min = String(kst.getUTCMinutes()).padStart(2, '0')
  return `${y}-${mo}-${day} ${h}:${min} KST`
}

type ProductStatus = '정상' | '주의' | '위험' | '데이터없음'

function getProductStatus(currentCpa: number | null, targetCpa: number): ProductStatus {
  if (currentCpa == null) return '데이터없음'
  if (currentCpa <= targetCpa) return '정상'
  if (currentCpa <= targetCpa * 1.2) return '주의'
  return '위험'
}

const STATUS_STYLES: Record<ProductStatus, { bg: string; border: string; color: string; dot: string }> = {
  '정상': { bg: '#f0fdf4', border: '#bbf7d0', color: '#16a34a', dot: '#22c55e' },
  '주의': { bg: '#fefce8', border: '#fde68a', color: '#ca8a04', dot: '#f59e0b' },
  '위험': { bg: '#fef2f2', border: '#fecaca', color: '#dc2626', dot: '#ef4444' },
  '데이터없음': { bg: '#f9fafb', border: '#e5e7eb', color: '#6b7280', dot: '#d1d5db' },
}

const STATUS_EMOJI: Record<ProductStatus, string> = {
  '정상': '🟢',
  '주의': '🟡',
  '위험': '🔴',
  '데이터없음': '⬜',
}

function severityBadge(severity: string) {
  if (severity === 'high')
    return { bg: '#fef2f2', border: '#fecaca', color: '#dc2626' }
  if (severity === 'medium')
    return { bg: '#fefce8', border: '#fde68a', color: '#ca8a04' }
  return { bg: '#f0fdf4', border: '#bbf7d0', color: '#16a34a' }
}

export default async function DashboardPage() {
  let snapshots: any[] = []
  let pendingQueue: ActionQueue[] = []
  let todayQueue: ActionQueue[] = []
  let productTargets: ProductTargetCpa[] = []

  const todayKstUtcIso = getTodayKstUtcIso()

  try {
    const supabase = createClient()
    const [snapshotsRes, pendingRes, todayRes, targetsRes] = await Promise.all([
      supabase
        .from('campaigns_snapshot')
        .select('*')
        .gte('captured_at', todayKstUtcIso)
        .order('captured_at', { ascending: false })
        .limit(500),
      supabase
        .from('action_queue')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('action_queue')
        .select('*')
        .gte('created_at', todayKstUtcIso)
        .order('created_at', { ascending: false }),
      supabase
        .from('product_target_cpas')
        .select('*')
        .eq('is_active', true)
        .order('product_name'),
    ])
    snapshots = snapshotsRes.data ?? []
    pendingQueue = (pendingRes.data ?? []) as ActionQueue[]
    todayQueue = (todayRes.data ?? []) as ActionQueue[]
    productTargets = (targetsRes.data ?? []) as ProductTargetCpa[]
  } catch {
    // Supabase 미연결 시 빈 데이터로 UI 표시
  }

  // 캠페인별 최신 스냅샷
  const latestByCampaign = new Map<string, typeof snapshots[0]>()
  for (const s of snapshots) {
    if (!latestByCampaign.has(s.campaign_id)) latestByCampaign.set(s.campaign_id, s)
  }
  const campaigns = Array.from(latestByCampaign.values())

  // KPI 집계
  const totalSpend = campaigns.reduce((a, c) => a + (c.spend ?? 0), 0)
  const totalConversions = campaigns.reduce((a, c) => a + (c.conversions ?? 0), 0)
  const avgCpa = totalConversions > 0 ? totalSpend / totalConversions : null
  const roasCampaigns = campaigns.filter(c => c.roas != null && c.roas > 0)
  const avgRoas = roasCampaigns.length > 0
    ? roasCampaigns.reduce((a, c) => a + (c.roas ?? 0), 0) / roasCampaigns.length
    : null

  // 마지막 수집 시각
  const lastCapturedAt = snapshots.length > 0 ? snapshots[0].captured_at : null

  const kpiCards = [
    {
      label: '총 지출',
      value: fmt(Math.round(totalSpend), '₩'),
      accent: '#3b82f6',
    },
    {
      label: '전환 수',
      value: fmt(totalConversions, '', '건'),
      accent: '#8b5cf6',
    },
    {
      label: '평균 CPA',
      value: fmt(avgCpa ? Math.round(avgCpa) : null, '₩'),
      accent: '#06b6d4',
    },
    {
      label: '평균 ROAS',
      value: avgRoas != null ? `${(avgRoas * 100).toFixed(0)}%` : '-',
      accent: '#10b981',
    },
  ]

  // 제품별 신호등
  const productSignals = productTargets.map(product => {
    // 이 제품명이 포함된 캠페인 스냅샷 필터
    const matched = campaigns.filter(c =>
      (c.campaign_name ?? '').includes(product.product_name)
    )
    const productSpend = matched.reduce((a: number, c: any) => a + (c.spend ?? 0), 0)
    const productConversions = matched.reduce((a: number, c: any) => a + (c.conversions ?? 0), 0)
    const currentCpa = productConversions > 0 ? productSpend / productConversions : null
    const status = getProductStatus(currentCpa, product.target_cpa)

    // 이 제품의 pending 큐 건수
    const pendingCount = pendingQueue.filter(q =>
      (q.campaign_name ?? '').includes(product.product_name)
    ).length

    return { product, currentCpa, status, pendingCount }
  })

  // 오늘 활동 집계
  const todayTotal = todayQueue.length
  const todayPending = todayQueue.filter(q => q.status === 'pending').length
  const todayDone = todayQueue.filter(q =>
    ['approved', 'rejected', 'executed', 'failed'].includes(q.status)
  ).length

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#111827' }}>
          KPI 모니터링
        </h1>
        <p className="text-sm mt-1" style={{ color: '#6b7280' }}>
          실시간 광고 성과 대시보드
        </p>
      </div>

      {/* KPI Cards */}
      <div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {kpiCards.map(({ label, value, accent }) => (
            <div
              key={label}
              className="rounded-xl p-5 transition-all duration-200"
              style={{
                background: '#ffffff',
                borderTop: `4px solid ${accent}`,
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              }}
            >
              <p className="text-xs font-medium" style={{ color: '#6b7280' }}>
                {label}
              </p>
              <p className="text-2xl font-bold mt-2 tracking-tight" style={{ color: '#111827' }}>
                {value}
              </p>
            </div>
          ))}
        </div>
        <p className="text-xs mt-2" style={{ color: '#9ca3af' }}>
          마지막 수집: {fmtKst(lastCapturedAt)}
        </p>
      </div>

      {/* 오늘 시스템 활동 */}
      <div
        className="rounded-xl p-5"
        style={{
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        }}
      >
        <h2 className="text-sm font-semibold mb-3" style={{ color: '#111827' }}>
          오늘 시스템 활동
        </h2>
        <div className="flex gap-3 flex-wrap">
          {[
            { label: '총 감지', value: todayTotal, color: '#374151', bg: '#f3f4f6', border: '#e5e7eb' },
            { label: '승인 대기', value: todayPending, color: '#ca8a04', bg: '#fefce8', border: '#fde68a' },
            { label: '처리 완료', value: todayDone, color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
          ].map(chip => (
            <div
              key={chip.label}
              className="flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium"
              style={{
                background: chip.bg,
                border: `1px solid ${chip.border}`,
                color: chip.color,
              }}
            >
              <span className="font-bold">{chip.value}건</span>
              <span className="font-normal" style={{ color: chip.color, opacity: 0.75 }}>{chip.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 제품별 상태 신호등 */}
      <div>
        <h2 className="text-sm font-semibold mb-3" style={{ color: '#111827' }}>
          제품별 상태 신호등
        </h2>
        {productSignals.length === 0 ? (
          <div
            className="rounded-xl px-6 py-12 text-center"
            style={{
              background: '#ffffff',
              border: '1px solid #e5e7eb',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            }}
          >
            <p className="text-sm" style={{ color: '#9ca3af' }}>
              등록된 제품 목표 CPA가 없습니다 — product_target_cpas 테이블에 추가해주세요
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {productSignals.map(({ product, currentCpa, status, pendingCount }) => {
              const style = STATUS_STYLES[status]
              return (
                <div
                  key={product.id}
                  className="rounded-xl p-5"
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                  }}
                >
                  {/* 제품명 + 뱃지 */}
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-bold truncate mr-2" style={{ color: '#111827' }}>
                      {product.product_name}
                    </p>
                    <span
                      className="shrink-0 text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{
                        background: style.bg,
                        border: `1px solid ${style.border}`,
                        color: style.color,
                      }}
                    >
                      {STATUS_EMOJI[status]} {status}
                    </span>
                  </div>

                  {/* 현재 CPA */}
                  <p
                    className="text-2xl font-bold tracking-tight"
                    style={{ color: status === '데이터없음' ? '#9ca3af' : style.color }}
                  >
                    {currentCpa != null ? `₩${Math.round(currentCpa).toLocaleString('ko-KR')}` : '-'}
                  </p>

                  {/* 목표 CPA + pending 건수 */}
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs" style={{ color: '#6b7280' }}>
                      목표 ₩{product.target_cpa.toLocaleString('ko-KR')}
                    </p>
                    {pendingCount > 0 && (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{
                          background: '#fefce8',
                          border: '1px solid #fde68a',
                          color: '#ca8a04',
                        }}
                      >
                        대기 {pendingCount}건
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Pending queue preview */}
      {pendingQueue.length > 0 && (
        <div
          className="rounded-xl overflow-hidden"
          style={{
            background: '#ffffff',
            border: '1px solid #fde68a',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          }}
        >
          <div
            className="px-6 py-4 flex items-center justify-between"
            style={{ borderBottom: '1px solid #e5e7eb' }}
          >
            <div className="flex items-center gap-2">
              <span
                className="w-1.5 h-1.5 rounded-full inline-block"
                style={{ background: '#f59e0b' }}
              />
              <h2 className="text-sm font-semibold" style={{ color: '#92400e' }}>
                승인 대기 ({pendingQueue.length}건)
              </h2>
            </div>
            <a
              href="/dashboard/queue"
              className="text-xs transition-colors duration-150"
              style={{ color: '#3b82f6' }}
            >
              전체 보기 →
            </a>
          </div>

          <div>
            {pendingQueue.slice(0, 3).map((item, i) => {
              const change = item.proposed_change as { reason?: string; action?: string }
              const badge = severityBadge(item.severity)
              return (
                <div
                  key={item.id}
                  className="px-6 py-3.5 flex items-center gap-3"
                  style={{
                    borderBottom:
                      i < Math.min(pendingQueue.length, 3) - 1
                        ? '1px solid #f3f4f6'
                        : 'none',
                  }}
                >
                  <span
                    className="shrink-0 text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{
                      background: badge.bg,
                      border: `1px solid ${badge.border}`,
                      color: badge.color,
                    }}
                  >
                    {item.severity}
                  </span>
                  <span className="text-sm truncate" style={{ color: '#374151' }}>
                    {item.campaign_name}
                  </span>
                  <span className="text-xs ml-auto shrink-0" style={{ color: '#9ca3af' }}>
                    {change.action}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
