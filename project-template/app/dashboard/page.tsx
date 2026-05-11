import { createClient } from '@/lib/supabase/client'

function fmt(n: number | null | undefined, prefix = '', suffix = '') {
  if (n == null) return '-'
  return `${prefix}${n.toLocaleString('ko-KR')}${suffix}`
}

function badge(severity: string) {
  if (severity === 'high') return 'bg-red-500/20 text-red-400'
  if (severity === 'medium') return 'bg-yellow-500/20 text-yellow-400'
  return 'bg-green-500/20 text-green-400'
}

export const revalidate = 0

export default async function DashboardPage() {
  let snapshots: any[] = []
  let queue: any[] = []

  try {
    const supabase = createClient()
    const [snapshotsRes, queueRes] = await Promise.all([
      supabase
        .from('campaigns_snapshot')
        .select('*')
        .order('captured_at', { ascending: false })
        .limit(200),
      supabase
        .from('action_queue')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(10),
    ])
    snapshots = snapshotsRes.data ?? []
    queue = queueRes.data ?? []
  } catch {
    // Supabase 미연결 시 빈 데이터로 UI 표시
  }

  // 캠페인별 최신 스냅샷
  const latestByCampaign = new Map<string, typeof snapshots[0]>()
  for (const s of snapshots) {
    if (!latestByCampaign.has(s.campaign_id)) latestByCampaign.set(s.campaign_id, s)
  }
  const campaigns = Array.from(latestByCampaign.values())

  const totalSpend = campaigns.reduce((a, c) => a + (c.spend ?? 0), 0)
  const totalConversions = campaigns.reduce((a, c) => a + (c.conversions ?? 0), 0)
  const avgCpa = totalConversions > 0 ? totalSpend / totalConversions : null
  const avgRoas = campaigns.filter(c => c.roas).reduce((a, c, _, arr) => a + (c.roas ?? 0) / arr.length, 0)

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-white">KPI 모니터링</h1>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: '총 지출', value: fmt(totalSpend, '₩') },
          { label: '전환 수', value: fmt(totalConversions, '', '건') },
          { label: '평균 CPA', value: fmt(avgCpa ? Math.round(avgCpa) : null, '₩') },
          { label: '평균 ROAS', value: avgRoas ? avgRoas.toFixed(2) : '-' },
        ].map(({ label, value }) => (
          <div key={label} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <p className="text-xs text-gray-500">{label}</p>
            <p className="text-2xl font-bold text-white mt-1">{value}</p>
          </div>
        ))}
      </div>

      {/* 캠페인 테이블 */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-gray-200">캠페인 성과</h2>
        </div>
        {campaigns.length === 0 ? (
          <p className="px-5 py-8 text-sm text-gray-500 text-center">데이터 없음 — Cron 수집 후 표시됩니다</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-800">
                  {['캠페인', '지출', '전환', 'CPA', 'CTR', 'ROAS'].map(h => (
                    <th key={h} className="px-4 py-2 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {campaigns.map(c => (
                  <tr key={c.campaign_id} className="hover:bg-gray-800/50">
                    <td className="px-4 py-3 text-gray-200 max-w-[200px] truncate">{c.campaign_name}</td>
                    <td className="px-4 py-3 text-gray-300">{fmt(c.spend, '₩')}</td>
                    <td className="px-4 py-3 text-gray-300">{fmt(c.conversions)}</td>
                    <td className="px-4 py-3 text-gray-300">{fmt(c.cpa ? Math.round(c.cpa) : null, '₩')}</td>
                    <td className="px-4 py-3 text-gray-300">{c.ctr != null ? `${c.ctr.toFixed(2)}%` : '-'}</td>
                    <td className="px-4 py-3 text-gray-300">{c.roas != null ? c.roas.toFixed(2) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 승인 대기 미리보기 */}
      {queue.length > 0 && (
        <div className="bg-gray-900 border border-yellow-800/50 rounded-lg overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-yellow-400">승인 대기 ({queue.length}건)</h2>
            <a href="/dashboard/queue" className="text-xs text-blue-400 hover:underline">전체 보기</a>
          </div>
          <div className="divide-y divide-gray-800">
            {queue.slice(0, 3).map(item => {
              const change = item.proposed_change as { reason?: string; action?: string }
              return (
                <div key={item.id} className="px-5 py-3 flex items-center gap-3">
                  <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${badge(item.severity)}`}>
                    {item.severity}
                  </span>
                  <span className="text-sm text-gray-300 truncate">{item.campaign_name}</span>
                  <span className="text-xs text-gray-500 ml-auto shrink-0">{change.action}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
