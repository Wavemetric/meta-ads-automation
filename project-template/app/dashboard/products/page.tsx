import { createClient } from '@/lib/supabase/client'

export const revalidate = 0

function cpaColor(current: number | null, target: number) {
  if (current == null) return '#9ca3af'
  if (current <= target) return '#16a34a'
  if (current <= target * 1.2) return '#ca8a04'
  return '#dc2626'
}

function cpaStatus(current: number | null, target: number) {
  if (current == null) return { label: '데이터 없음', bg: '#f9fafb', border: '#e5e7eb', color: '#6b7280' }
  if (current <= target) return { label: '목표 달성', bg: '#f0fdf4', border: '#bbf7d0', color: '#16a34a' }
  if (current <= target * 1.2) return { label: '주의', bg: '#fefce8', border: '#fde68a', color: '#ca8a04' }
  return { label: '초과', bg: '#fef2f2', border: '#fecaca', color: '#dc2626' }
}

type Stat = {
  name: string
  target_cpa: number
  current_cpa: number | null
  total_spend: number
  total_conversions: number
  campaign_count: number
}

function StatCard({ s }: { s: Stat }) {
  const status = cpaStatus(s.current_cpa, s.target_cpa)
  const ratio = s.current_cpa != null ? (s.current_cpa / s.target_cpa) * 100 : null
  const color = cpaColor(s.current_cpa, s.target_cpa)
  return (
    <div
      className="bg-white rounded-xl p-4 flex flex-col gap-3"
      style={{ border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
    >
      {/* 이름 + 상태 */}
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-sm font-semibold leading-tight" style={{ color: '#111827' }}>{s.name}</h2>
        <span
          className="text-xs px-2 py-0.5 rounded-full shrink-0 font-medium"
          style={{ background: status.bg, border: `1px solid ${status.border}`, color: status.color }}
        >
          {status.label}
        </span>
      </div>

      {/* 현재 CPA + 목표 대비 % */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs mb-0.5" style={{ color: '#9ca3af' }}>현재 CPA</p>
          <p className="text-2xl font-bold" style={{ color }}>
            {s.current_cpa != null ? `₩${Math.round(s.current_cpa).toLocaleString('ko-KR')}` : '-'}
          </p>
        </div>
        {ratio != null && (
          <p className="text-lg font-bold" style={{ color }}>
            {Math.round(ratio)}%
          </p>
        )}
      </div>

      {/* 진행 바 */}
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

      {/* 보조 지표 */}
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

export default async function ProductsPage() {
  const supabase = createClient()

  const [{ data: productCpas }, { data: promotionCpas }, { data: snapshots }] = await Promise.all([
    supabase.from('product_target_cpas').select('*').eq('is_active', true).order('product_name'),
    supabase.from('promotion_target_cpas').select('*').eq('is_active', true).order('promotion_name'),
    supabase
      .from('campaigns_snapshot')
      .select('campaign_name, adset_name, spend, conversions, cpa')
      .order('captured_at', { ascending: false })
      .limit(500),
  ])

  // 광고세트 기준 최신 스냅샷만 유지
  const latestMap = new Map<string, NonNullable<typeof snapshots>[number]>()
  for (const s of snapshots ?? []) {
    const key = s.adset_name ?? s.campaign_name ?? ''
    if (!latestMap.has(key)) latestMap.set(key, s)
  }
  const latest = Array.from(latestMap.values())

  // 제품별 집계 — 라이브 중인 것만 (캠페인 매칭 있고 지출 > 0)
  const productStats: Stat[] = (productCpas ?? [])
    .map(p => {
      const matched = latest.filter(s =>
        (s.campaign_name ?? '').toLowerCase().includes(p.product_name.toLowerCase())
      )
      const totalSpend = matched.reduce((sum, s) => sum + (s.spend ?? 0), 0)
      const totalConversions = matched.reduce((sum, s) => sum + (s.conversions ?? 0), 0)
      const currentCpa = totalConversions > 0 ? totalSpend / totalConversions : null
      return {
        name: p.product_name,
        target_cpa: p.target_cpa,
        current_cpa: currentCpa,
        total_spend: totalSpend,
        total_conversions: totalConversions,
        campaign_count: matched.length,
      }
    })
    .filter(p => p.campaign_count > 0 && p.total_spend > 0)

  // 프로모션별 집계 — 라이브 중인 것만
  const promotionStats: Stat[] = (promotionCpas ?? [])
    .map(p => {
      const matched = latest.filter(s =>
        (s.campaign_name ?? '').toLowerCase().includes(p.promotion_name.toLowerCase())
      )
      const totalSpend = matched.reduce((sum, s) => sum + (s.spend ?? 0), 0)
      const totalConversions = matched.reduce((sum, s) => sum + (s.conversions ?? 0), 0)
      const currentCpa = totalConversions > 0 ? totalSpend / totalConversions : null
      return {
        name: p.promotion_name,
        target_cpa: p.target_cpa,
        current_cpa: currentCpa,
        total_spend: totalSpend,
        total_conversions: totalConversions,
        campaign_count: matched.length,
      }
    })
    .filter(p => p.campaign_count > 0 && p.total_spend > 0)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold" style={{ color: '#111827' }}>제품 · 프로모션 CPA 현황</h1>
        <p className="text-xs mt-1" style={{ color: '#9ca3af' }}>
          라이브 중인 캠페인만 표시 / 1시간마다 자동 갱신
        </p>
      </div>

      {/* 제품별 */}
      <section>
        <h2 className="text-sm font-semibold mb-3" style={{ color: '#374151' }}>상품별 CPA</h2>
        {productStats.length === 0 ? (
          <div
            className="rounded-xl px-6 py-10 text-center"
            style={{ background: '#ffffff', border: '1px solid #e5e7eb' }}
          >
            <p className="text-sm" style={{ color: '#9ca3af' }}>현재 라이브 중인 상품 캠페인이 없습니다</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {productStats.map(s => <StatCard key={s.name} s={s} />)}
          </div>
        )}
      </section>

      {/* 프로모션별 */}
      <section>
        <h2 className="text-sm font-semibold mb-3" style={{ color: '#374151' }}>프로모션별 CPA</h2>
        {promotionStats.length === 0 ? (
          <div
            className="rounded-xl px-6 py-10 text-center"
            style={{ background: '#ffffff', border: '1px solid #e5e7eb' }}
          >
            <p className="text-sm" style={{ color: '#9ca3af' }}>
              {(promotionCpas ?? []).length === 0
                ? '목표 설정 탭에서 프로모션을 추가해보세요'
                : '현재 라이브 중인 프로모션 캠페인이 없습니다'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {promotionStats.map(s => <StatCard key={s.name} s={s} />)}
          </div>
        )}
      </section>
    </div>
  )
}
