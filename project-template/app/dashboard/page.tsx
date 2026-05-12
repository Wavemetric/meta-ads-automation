import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export const revalidate = 0

function getTodayKstUtcIso(): string {
  const nowKst = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
  const start = new Date(nowKst.getFullYear(), nowKst.getMonth(), nowKst.getDate())
  return new Date(start.getTime() - 9 * 60 * 60 * 1000).toISOString()
}

function cpaStatus(current: number | null, target: number | null) {
  if (current == null || target == null)
    return { label: '목표 미설정', bg: '#f9fafb', border: '#e5e7eb', color: '#9ca3af', barColor: '#d1d5db' }
  if (current <= target)
    return { label: '목표 달성', bg: '#f0fdf4', border: '#bbf7d0', color: '#16a34a', barColor: '#22c55e' }
  if (current <= target * 1.2)
    return { label: '주의', bg: '#fefce8', border: '#fde68a', color: '#ca8a04', barColor: '#f59e0b' }
  return { label: '초과', bg: '#fef2f2', border: '#fecaca', color: '#dc2626', barColor: '#ef4444' }
}

type CampaignGroup = {
  groupName: string
  groupType: 'promotion' | 'product' | 'campaign'
  targetCpa: number | null
  currentCpa: number | null
  totalSpend: number
  totalConversions: number
  campaignCount: number
  sampleCampaignId: string
}

function CpaCard({ g, accountId }: { g: CampaignGroup; accountId: string }) {
  const status = cpaStatus(g.currentCpa, g.targetCpa)
  const ratio = g.currentCpa != null && g.targetCpa != null
    ? (g.currentCpa / g.targetCpa) * 100
    : null

  const typeLabel = g.groupType === 'promotion' ? '프로모션' : g.groupType === 'product' ? '상품' : '캠페인'
  const metaUrl = accountId
    ? `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${accountId}&selected_campaign_ids=${g.sampleCampaignId}`
    : 'https://adsmanager.facebook.com/'

  return (
    <div
      className="bg-white rounded-xl flex flex-col overflow-hidden"
      style={{ border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
    >
      {/* 상단 색 띠 */}
      <div className="h-1" style={{ background: status.barColor }} />

      <div className="p-5 flex flex-col gap-4 flex-1">
        {/* 그룹명 + 뱃지 */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <span
              className="text-xs font-medium px-1.5 py-0.5 rounded"
              style={{ background: g.groupType === 'promotion' ? '#f0f9ff' : '#f5f3ff', color: g.groupType === 'promotion' ? '#0284c7' : '#7c3aed' }}
            >
              {typeLabel}
            </span>
            <p className="text-sm font-bold mt-1 leading-snug" style={{ color: '#111827' }}>
              {g.groupName}
            </p>
          </div>
          <span
            className="shrink-0 text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ background: status.bg, border: `1px solid ${status.border}`, color: status.color }}
          >
            {status.label}
          </span>
        </div>

        {/* 핵심 지표: 현재 CPA + 목표 CPA */}
        <div>
          <div className="flex items-end justify-between mb-3">
            <div>
              <p className="text-xs font-medium mb-1" style={{ color: '#9ca3af' }}>현재 CPA</p>
              <p
                className="text-3xl font-bold leading-none"
                style={{ color: g.currentCpa != null ? status.color : '#d1d5db' }}
              >
                {g.currentCpa != null
                  ? `₩${Math.round(g.currentCpa).toLocaleString('ko-KR')}`
                  : '-'}
              </p>
            </div>
            {g.targetCpa != null && (
              <div className="text-right">
                <p className="text-xs font-medium mb-1" style={{ color: '#9ca3af' }}>목표 CPA</p>
                <p className="text-lg font-semibold" style={{ color: '#6b7280' }}>
                  ₩{g.targetCpa.toLocaleString('ko-KR')}
                </p>
              </div>
            )}
          </div>

          {/* CPA 바 */}
          {g.targetCpa != null && (
            <div>
              <div className="relative h-2 rounded-full overflow-hidden" style={{ background: '#f3f4f6' }}>
                {ratio != null && (
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(ratio, 100)}%`,
                      background: status.barColor,
                    }}
                  />
                )}
                {/* 목표 마커 (100%) */}
                <div
                  className="absolute top-0 bottom-0 w-0.5"
                  style={{ left: '100%', transform: 'translateX(-1px)', background: '#6b7280', opacity: 0.3 }}
                />
              </div>
              {ratio != null && (
                <p className="text-xs mt-1 text-right font-medium" style={{ color: status.color }}>
                  목표 대비 {Math.round(ratio)}%
                </p>
              )}
            </div>
          )}
        </div>

        {/* 보조 지표 */}
        <div className="grid grid-cols-3 gap-2 pt-3" style={{ borderTop: '1px solid #f3f4f6' }}>
          <div>
            <p className="text-xs" style={{ color: '#9ca3af' }}>지출</p>
            <p className="text-xs font-semibold mt-0.5" style={{ color: '#374151' }}>
              ₩{Math.round(g.totalSpend / 1000).toLocaleString('ko-KR')}k
            </p>
          </div>
          <div>
            <p className="text-xs" style={{ color: '#9ca3af' }}>전환</p>
            <p className="text-xs font-semibold mt-0.5" style={{ color: '#374151' }}>{g.totalConversions}건</p>
          </div>
          <div>
            <p className="text-xs" style={{ color: '#9ca3af' }}>세트</p>
            <p className="text-xs font-semibold mt-0.5" style={{ color: '#374151' }}>{g.campaignCount}개</p>
          </div>
        </div>
      </div>

      {/* 메타 바로가기 */}
      <a
        href={metaUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors hover:bg-gray-50"
        style={{ borderTop: '1px solid #f3f4f6', color: '#6b7280' }}
      >
        메타 광고 관리자에서 보기
        <span style={{ fontSize: '10px' }}>↗</span>
      </a>
    </div>
  )
}

export default async function DashboardPage() {
  const supabase = createClient()
  const todayIso = getTodayKstUtcIso()

  const accountId = (process.env.META_AD_ACCOUNT_IDS ?? '')
    .split(',')[0]
    .replace('act_', '')
    .trim()

  const [snapshotsRes, productRes, promotionRes, pendingRes, todayQueueRes] = await Promise.all([
    supabase
      .from('campaigns_snapshot')
      .select('campaign_id, campaign_name, adset_name, spend, conversions')
      .order('captured_at', { ascending: false })
      .limit(500),
    supabase.from('product_target_cpas').select('product_name, target_cpa').eq('is_active', true),
    supabase.from('promotion_target_cpas').select('promotion_name, target_cpa').eq('is_active', true),
    supabase.from('action_queue').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('action_queue').select('status').gte('created_at', todayIso),
  ])

  // 광고세트/캠페인별 최신 스냅샷만 유지
  const latestMap = new Map<string, NonNullable<typeof snapshotsRes.data>[number]>()
  for (const s of snapshotsRes.data ?? []) {
    const key = s.adset_name ?? s.campaign_name ?? s.campaign_id
    if (!latestMap.has(key)) latestMap.set(key, s)
  }
  const latest = Array.from(latestMap.values())

  const products = productRes.data ?? []
  const promotions = promotionRes.data ?? []

  // 그룹 집계: 프로모션 → 제품 → 캠페인명 순으로 매칭
  const groupMap = new Map<string, CampaignGroup>()

  for (const s of latest) {
    if ((s.spend ?? 0) === 0) continue // 지출 없으면 라이브 아님

    const name = (s.campaign_name ?? '').toLowerCase()
    let matched = false

    // 1. 프로모션 매칭 우선
    for (const p of promotions) {
      if (name.includes(p.promotion_name.toLowerCase())) {
        const key = `promo::${p.promotion_name}`
        if (!groupMap.has(key)) {
          groupMap.set(key, {
            groupName: p.promotion_name,
            groupType: 'promotion',
            targetCpa: p.target_cpa,
            currentCpa: null,
            totalSpend: 0,
            totalConversions: 0,
            campaignCount: 0,
            sampleCampaignId: s.campaign_id,
          })
        }
        const g = groupMap.get(key)!
        g.totalSpend += s.spend ?? 0
        g.totalConversions += s.conversions ?? 0
        g.campaignCount++
        matched = true
        break
      }
    }

    if (matched) continue

    // 2. 제품 매칭
    for (const p of products) {
      if (name.includes(p.product_name.toLowerCase())) {
        const key = `prod::${p.product_name}`
        if (!groupMap.has(key)) {
          groupMap.set(key, {
            groupName: p.product_name,
            groupType: 'product',
            targetCpa: p.target_cpa,
            currentCpa: null,
            totalSpend: 0,
            totalConversions: 0,
            campaignCount: 0,
            sampleCampaignId: s.campaign_id,
          })
        }
        const g = groupMap.get(key)!
        g.totalSpend += s.spend ?? 0
        g.totalConversions += s.conversions ?? 0
        g.campaignCount++
        matched = true
        break
      }
    }

    if (matched) continue

    // 3. 매칭 없으면 캠페인명으로 단독 표시
    const key = `camp::${s.campaign_id}`
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        groupName: s.campaign_name ?? s.campaign_id,
        groupType: 'campaign',
        targetCpa: null,
        currentCpa: null,
        totalSpend: 0,
        totalConversions: 0,
        campaignCount: 0,
        sampleCampaignId: s.campaign_id,
      })
    }
    const g = groupMap.get(key)!
    g.totalSpend += s.spend ?? 0
    g.totalConversions += s.conversions ?? 0
    g.campaignCount++
  }

  // 현재 CPA 계산 + 정렬 (초과 → 주의 → 달성 → 목표없음)
  const groups: CampaignGroup[] = Array.from(groupMap.values())
    .map(g => ({
      ...g,
      currentCpa: g.totalConversions > 0 ? g.totalSpend / g.totalConversions : null,
    }))
    .sort((a, b) => {
      const score = (g: CampaignGroup) => {
        if (g.currentCpa == null || g.targetCpa == null) return 3
        if (g.currentCpa > g.targetCpa * 1.2) return 0
        if (g.currentCpa > g.targetCpa) return 1
        return 2
      }
      return score(a) - score(b)
    })

  const pendingCount = pendingRes.count ?? 0
  const todayDone = (todayQueueRes.data ?? []).filter(q =>
    ['approved', 'rejected', 'executed', 'failed'].includes(q.status)
  ).length

  return (
    <div className="space-y-8">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#111827' }}>대시보드</h1>
          <p className="text-sm mt-1" style={{ color: '#6b7280' }}>
            라이브 캠페인 {groups.length}개 · 5분마다 자동 갱신
          </p>
        </div>
        {pendingCount > 0 && (
          <Link
            href="/dashboard/queue"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
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
          <p className="text-xs font-medium" style={{ color: '#9ca3af' }}>승인 대기</p>
          <p className="text-3xl font-bold mt-1" style={{ color: pendingCount > 0 ? '#ca8a04' : '#111827' }}>
            {pendingCount}
            <span className="text-sm font-normal ml-1" style={{ color: '#9ca3af' }}>건</span>
          </p>
        </div>
        <div className="w-px self-stretch" style={{ background: '#e5e7eb' }} />
        <div>
          <p className="text-xs font-medium" style={{ color: '#9ca3af' }}>오늘 처리 완료</p>
          <p className="text-3xl font-bold mt-1" style={{ color: '#111827' }}>
            {todayDone}
            <span className="text-sm font-normal ml-1" style={{ color: '#9ca3af' }}>건</span>
          </p>
        </div>
      </div>

      {/* 캠페인 카드 그리드 */}
      {groups.length === 0 ? (
        <div
          className="rounded-xl px-6 py-16 text-center"
          style={{ background: '#ffffff', border: '1px solid #e5e7eb' }}
        >
          <p className="text-sm" style={{ color: '#9ca3af' }}>현재 라이브 중인 캠페인이 없습니다</p>
          <p className="text-xs mt-1" style={{ color: '#c4c9d4' }}>5분마다 자동으로 수집됩니다</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {groups.map(g => (
            <CpaCard key={`${g.groupType}::${g.groupName}`} g={g} accountId={accountId} />
          ))}
        </div>
      )}
    </div>
  )
}
