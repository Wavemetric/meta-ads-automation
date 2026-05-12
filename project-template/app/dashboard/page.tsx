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
    return { label: '목표 미설정', bg: '#f9fafb', border: 'rgba(0,0,0,0.06)', color: '#a1a1aa', barColor: '#e4e4e7', gradient: 'linear-gradient(90deg, #e4e4e7, #d4d4d8)' }
  if (current <= target)
    return { label: '목표 달성', bg: '#f0fdf9', border: '#6ee7b7', color: '#059669', barColor: '#10b981', gradient: 'linear-gradient(90deg, #10b981, #34d399)' }
  if (current <= target * 1.2)
    return { label: '주의', bg: '#fffbeb', border: '#fcd34d', color: '#d97706', barColor: '#f59e0b', gradient: 'linear-gradient(90deg, #f59e0b, #fbbf24)' }
  return { label: '초과', bg: '#fff1f2', border: '#fca5a5', color: '#dc2626', barColor: '#ef4444', gradient: 'linear-gradient(90deg, #ef4444, #f87171)' }
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
  const typeBg = g.groupType === 'promotion'
    ? { bg: 'rgba(99,102,241,0.1)', color: '#6366f1' }
    : g.groupType === 'product'
    ? { bg: 'rgba(139,92,246,0.1)', color: '#7c3aed' }
    : { bg: 'rgba(113,113,122,0.1)', color: '#71717a' }

  const metaUrl = accountId
    ? `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${accountId}&selected_campaign_ids=${g.sampleCampaignId}`
    : 'https://adsmanager.facebook.com/'

  return (
    <div
      className="cpa-card bg-white rounded-xl flex flex-col overflow-hidden"
      style={{
        boxShadow: '0 0 0 1px rgba(0,0,0,0.05), 0 2px 8px rgba(0,0,0,0.05), 0 8px 24px rgba(0,0,0,0.04)',
      }}
    >
      {/* 상단 그라디언트 띠 */}
      <div className="h-1.5" style={{ background: status.gradient }} />

      <div className="p-5 flex flex-col gap-4 flex-1">
        {/* 그룹명 + 뱃지 */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ background: typeBg.bg, color: typeBg.color }}
            >
              {typeLabel}
            </span>
            <p className="text-sm font-bold mt-1.5 leading-snug" style={{ color: '#0f0f11' }}>
              {g.groupName}
            </p>
          </div>
          <span
            className="shrink-0 text-xs px-2.5 py-1 rounded-full font-semibold"
            style={{
              background: status.bg,
              border: `1px solid ${status.border}`,
              color: status.color,
              whiteSpace: 'nowrap',
            }}
          >
            {status.label}
          </span>
        </div>

        {/* 핵심 지표 */}
        <div>
          <div className="flex items-end justify-between mb-3">
            <div>
              <p className="text-xs font-medium mb-1.5" style={{ color: '#a1a1aa' }}>현재 CPA</p>
              <p
                className="font-black leading-none"
                style={{
                  fontSize: '32px',
                  color: g.currentCpa != null ? status.color : '#d4d4d8',
                  letterSpacing: '-0.02em',
                }}
              >
                {g.currentCpa != null
                  ? `₩${Math.round(g.currentCpa).toLocaleString('ko-KR')}`
                  : '–'}
              </p>
            </div>
            {g.targetCpa != null && (
              <div className="text-right">
                <p className="text-xs font-medium mb-1.5" style={{ color: '#a1a1aa' }}>목표 CPA</p>
                <p className="text-lg font-bold" style={{ color: '#71717a' }}>
                  ₩{g.targetCpa.toLocaleString('ko-KR')}
                </p>
              </div>
            )}
          </div>

          {g.targetCpa != null && (
            <div>
              <div
                className="relative h-2 rounded-full overflow-hidden"
                style={{ background: '#f4f4f5' }}
              >
                {ratio != null && (
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(ratio, 100)}%`,
                      background: status.gradient,
                      transition: 'width 600ms cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                  />
                )}
              </div>
              {ratio != null && g.targetCpa != null && g.currentCpa != null && (
                <p className="text-xs mt-1.5 text-right font-semibold" style={{ color: status.color }}>
                  {g.currentCpa > g.targetCpa
                    ? `목표 대비 ₩${Math.round(g.currentCpa - g.targetCpa).toLocaleString('ko-KR')} 초과 (${Math.round(ratio - 100)}%)`
                    : `목표 대비 ₩${Math.round(g.targetCpa - g.currentCpa).toLocaleString('ko-KR')} 준수 (${Math.round(100 - ratio)}%)`
                  }
                </p>
              )}
            </div>
          )}
        </div>

        {/* 보조 지표 */}
        <div
          className="grid grid-cols-3 gap-2 pt-3"
          style={{ borderTop: '1px solid #f4f4f5' }}
        >
          <div>
            <p className="text-xs" style={{ color: '#a1a1aa' }}>지출</p>
            <p className="text-xs font-bold mt-0.5" style={{ color: '#3f3f46' }}>
              ₩{Math.round(g.totalSpend / 1000).toLocaleString('ko-KR')}k
            </p>
          </div>
          <div>
            <p className="text-xs" style={{ color: '#a1a1aa' }}>전환</p>
            <p className="text-xs font-bold mt-0.5" style={{ color: '#3f3f46' }}>{g.totalConversions}건</p>
          </div>
          <div>
            <p className="text-xs" style={{ color: '#a1a1aa' }}>세트</p>
            <p className="text-xs font-bold mt-0.5" style={{ color: '#3f3f46' }}>{g.campaignCount}개</p>
          </div>
        </div>
      </div>

      {/* 메타 바로가기 */}
      <a
        href={metaUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="meta-link flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium"
        style={{
          borderTop: '1px solid #f4f4f5',
          color: '#a1a1aa',
        }}
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

  const latestMap = new Map<string, NonNullable<typeof snapshotsRes.data>[number]>()
  for (const s of snapshotsRes.data ?? []) {
    const key = s.adset_name ?? s.campaign_name ?? s.campaign_id
    if (!latestMap.has(key)) latestMap.set(key, s)
  }
  const latest = Array.from(latestMap.values())

  const products = productRes.data ?? []
  const promotions = promotionRes.data ?? []

  const groupMap = new Map<string, CampaignGroup>()

  for (const s of latest) {
    if ((s.spend ?? 0) === 0) continue

    const name = (s.campaign_name ?? '').toLowerCase()
    let matched = false

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
          <h1
            className="font-black"
            style={{ fontSize: '26px', color: '#0f0f11', letterSpacing: '-0.02em' }}
          >
            대시보드
          </h1>
          <p className="text-sm mt-1" style={{ color: '#a1a1aa' }}>
            라이브 캠페인 {groups.length}개 · 5분마다 자동 갱신
          </p>
        </div>
        {pendingCount > 0 && (
          <Link
            href="/dashboard/queue"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
            style={{
              background: 'rgba(245,158,11,0.1)',
              border: '1px solid rgba(245,158,11,0.3)',
              color: '#d97706',
              boxShadow: '0 0 0 0 rgba(245,158,11,0)',
            }}
          >
            <span style={{ fontSize: '7px', color: '#f59e0b', animation: 'pulse 2s infinite' }}>●</span>
            승인 대기 {pendingCount}건 →
          </Link>
        )}
      </div>

      {/* 오늘 활동 요약 */}
      <div
        className="rounded-xl p-5 flex items-center gap-8"
        style={{
          background: '#ffffff',
          boxShadow: '0 0 0 1px rgba(0,0,0,0.05), 0 2px 8px rgba(0,0,0,0.04)',
        }}
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#a1a1aa' }}>승인 대기</p>
          <div className="flex items-baseline gap-1.5 mt-1.5">
            <p
              className="font-black"
              style={{
                fontSize: '36px',
                color: pendingCount > 0 ? '#d97706' : '#0f0f11',
                letterSpacing: '-0.03em',
                lineHeight: 1,
              }}
            >
              {pendingCount}
            </p>
            <span className="text-sm font-medium" style={{ color: '#a1a1aa' }}>건</span>
          </div>
        </div>
        <div className="w-px self-stretch" style={{ background: '#f4f4f5' }} />
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#a1a1aa' }}>오늘 처리 완료</p>
          <div className="flex items-baseline gap-1.5 mt-1.5">
            <p
              className="font-black"
              style={{
                fontSize: '36px',
                color: '#0f0f11',
                letterSpacing: '-0.03em',
                lineHeight: 1,
              }}
            >
              {todayDone}
            </p>
            <span className="text-sm font-medium" style={{ color: '#a1a1aa' }}>건</span>
          </div>
        </div>
      </div>

      {/* 캠페인 카드 그리드 */}
      {groups.length === 0 ? (
        <div
          className="rounded-xl px-6 py-20 text-center"
          style={{
            background: '#ffffff',
            boxShadow: '0 0 0 1px rgba(0,0,0,0.05), 0 2px 8px rgba(0,0,0,0.04)',
          }}
        >
          <div
            className="w-12 h-12 rounded-2xl mx-auto mb-4 flex items-center justify-center"
            style={{ background: '#f4f4f5' }}
          >
            <span style={{ fontSize: '20px' }}>📊</span>
          </div>
          <p className="text-sm font-semibold" style={{ color: '#3f3f46' }}>현재 라이브 중인 캠페인이 없습니다</p>
          <p className="text-xs mt-1" style={{ color: '#a1a1aa' }}>5분마다 자동으로 수집됩니다</p>
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
