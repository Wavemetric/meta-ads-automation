import { createClient } from '@/lib/supabase/client'

export const revalidate = 0

function cpaColor(current: number | null, target: number) {
  if (current == null) return 'text-gray-400'
  if (current <= target) return 'text-green-600'
  if (current <= target * 1.2) return 'text-yellow-600'
  return 'text-red-600'
}

function cpaStatus(current: number | null, target: number) {
  if (current == null) return { label: '데이터 없음', bg: 'bg-gray-100 text-gray-500' }
  if (current <= target) return { label: '목표 달성', bg: 'bg-green-50 text-green-600' }
  if (current <= target * 1.2) return { label: '주의', bg: 'bg-yellow-50 text-yellow-600' }
  return { label: '초과', bg: 'bg-red-50 text-red-600' }
}

export default async function ProductsPage() {
  const supabase = createClient()

  const [{ data: productCpas }, { data: snapshots }] = await Promise.all([
    supabase.from('product_target_cpas').select('*').eq('is_active', true).order('product_name'),
    supabase
      .from('campaigns_snapshot')
      .select('campaign_name, adset_name, spend, conversions, cpa')
      .order('captured_at', { ascending: false })
      .limit(500),
  ])

  // 캠페인명 기준 최신 스냅샷만 유지
  const latestMap = new Map<string, typeof snapshots extends (infer T)[] | null ? T : never>()
  for (const s of snapshots ?? []) {
    const key = s.adset_name ?? s.campaign_name ?? ''
    if (!latestMap.has(key)) latestMap.set(key, s)
  }
  const latest = Array.from(latestMap.values())

  // 제품별 집계
  const productStats = (productCpas ?? []).map(p => {
    const matched = latest.filter(s =>
      (s.campaign_name ?? '').toLowerCase().includes(p.product_name.toLowerCase())
    )
    const totalSpend = matched.reduce((sum, s) => sum + (s.spend ?? 0), 0)
    const totalConversions = matched.reduce((sum, s) => sum + (s.conversions ?? 0), 0)
    const currentCpa = totalConversions > 0 ? totalSpend / totalConversions : null

    return {
      product_name: p.product_name,
      target_cpa: p.target_cpa,
      current_cpa: currentCpa,
      total_spend: totalSpend,
      total_conversions: totalConversions,
      campaign_count: matched.length,
    }
  })

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold" style={{ color: '#111827' }}>제품별 CPA 현황</h1>

      <div className="grid grid-cols-3 gap-4">
        {productStats.length === 0 ? (
          <p className="col-span-3 text-sm text-center py-12" style={{ color: '#9ca3af' }}>제품 목표 CPA 데이터가 없습니다</p>
        ) : (
          productStats.map(p => {
            const status = cpaStatus(p.current_cpa, p.target_cpa)
            const ratio = p.current_cpa != null ? (p.current_cpa / p.target_cpa) * 100 : null
            return (
              <div key={p.product_name} className="bg-white border rounded-xl p-4 flex flex-col gap-3" style={{ borderColor: '#e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                {/* 제품명 + 상태 */}
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-sm font-semibold leading-tight" style={{ color: '#111827' }}>{p.product_name}</h2>
                  <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${status.bg}`}>{status.label}</span>
                </div>

                {/* 현재 CPA 큰 숫자 + 목표 대비 % */}
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-xs mb-0.5" style={{ color: '#9ca3af' }}>현재 CPA</p>
                    <p className={`text-2xl font-bold ${cpaColor(p.current_cpa, p.target_cpa)}`}>
                      {p.current_cpa != null ? `₩${Math.round(p.current_cpa).toLocaleString('ko-KR')}` : '-'}
                    </p>
                  </div>
                  {ratio != null && (
                    <p className={`text-lg font-bold ${cpaColor(p.current_cpa, p.target_cpa)}`}>
                      {Math.round(ratio)}%
                    </p>
                  )}
                </div>

                {/* 진행 바 */}
                <div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#f3f4f6' }}>
                    {ratio != null && (
                      <div
                        className={`h-full rounded-full ${ratio <= 100 ? 'bg-green-500' : ratio <= 120 ? 'bg-yellow-500' : 'bg-red-500'}`}
                        style={{ width: `${Math.min(ratio, 100)}%` }}
                      />
                    )}
                  </div>
                  <div className="flex justify-between text-xs mt-1" style={{ color: '#c4c9d4' }}>
                    <span>0</span>
                    <span>목표 ₩{p.target_cpa.toLocaleString('ko-KR')}</span>
                  </div>
                </div>

                {/* 보조 지표 */}
                <div className="grid grid-cols-3 gap-2 pt-1" style={{ borderTop: '1px solid #f3f4f6' }}>
                  <div>
                    <p className="text-xs" style={{ color: '#9ca3af' }}>지출</p>
                    <p className="text-xs font-medium mt-0.5" style={{ color: '#374151' }}>
                      ₩{Math.round(p.total_spend / 1000)}k
                    </p>
                  </div>
                  <div>
                    <p className="text-xs" style={{ color: '#9ca3af' }}>전환</p>
                    <p className="text-xs font-medium mt-0.5" style={{ color: '#374151' }}>{p.total_conversions}건</p>
                  </div>
                  <div>
                    <p className="text-xs" style={{ color: '#9ca3af' }}>세트</p>
                    <p className="text-xs font-medium mt-0.5" style={{ color: '#374151' }}>{p.campaign_count}개</p>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      <p className="text-xs" style={{ color: '#9ca3af' }}>오늘 수집된 데이터 기준 / 1시간마다 자동 갱신</p>
    </div>
  )
}
