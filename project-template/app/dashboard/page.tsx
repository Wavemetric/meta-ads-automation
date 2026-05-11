import { createClient } from '@/lib/supabase/client'

function fmt(n: number | null | undefined, prefix = '', suffix = '') {
  if (n == null) return '-'
  return `${prefix}${n.toLocaleString('ko-KR')}${suffix}`
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

  const latestByCampaign = new Map<string, typeof snapshots[0]>()
  for (const s of snapshots) {
    if (!latestByCampaign.has(s.campaign_id)) latestByCampaign.set(s.campaign_id, s)
  }
  const campaigns = Array.from(latestByCampaign.values())

  const totalSpend = campaigns.reduce((a, c) => a + (c.spend ?? 0), 0)
  const totalConversions = campaigns.reduce((a, c) => a + (c.conversions ?? 0), 0)
  const avgCpa = totalConversions > 0 ? totalSpend / totalConversions : null
  const avgRoas = campaigns.filter(c => c.roas).reduce((a, c, _, arr) => a + (c.roas ?? 0) / arr.length, 0)

  const kpiCards = [
    {
      label: '총 지출',
      value: fmt(totalSpend, '₩'),
      accent: '#3b82f6',
      accentRgb: '59,130,246',
    },
    {
      label: '전환 수',
      value: fmt(totalConversions, '', '건'),
      accent: '#8b5cf6',
      accentRgb: '139,92,246',
    },
    {
      label: '평균 CPA',
      value: fmt(avgCpa ? Math.round(avgCpa) : null, '₩'),
      accent: '#06b6d4',
      accentRgb: '6,182,212',
    },
    {
      label: '평균 ROAS',
      value: avgRoas ? avgRoas.toFixed(2) : '-',
      accent: '#10b981',
      accentRgb: '16,185,129',
    },
  ]

  function severityBadge(severity: string) {
    if (severity === 'high')
      return {
        bg: '#fef2f2',
        border: '#fecaca',
        color: '#dc2626',
      }
    if (severity === 'medium')
      return {
        bg: '#fefce8',
        border: '#fde68a',
        color: '#ca8a04',
      }
    return {
      bg: '#f0fdf4',
      border: '#bbf7d0',
      color: '#16a34a',
    }
  }

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

      {/* Campaign table */}
      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        }}
      >
        <div
          className="px-6 py-4 flex items-center justify-between"
          style={{ borderBottom: '1px solid #e5e7eb' }}
        >
          <h2 className="text-sm font-semibold" style={{ color: '#111827' }}>
            캠페인 성과
          </h2>
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{
              background: '#eff6ff',
              color: '#3b82f6',
              border: '1px solid #bfdbfe',
            }}
          >
            {campaigns.length}개 캠페인
          </span>
        </div>

        {campaigns.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm" style={{ color: '#9ca3af' }}>
              데이터 없음 — Cron 수집 후 표시됩니다
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                  {['캠페인', '지출', '전환', 'CPA', 'CTR', 'ROAS'].map(h => (
                    <th
                      key={h}
                      className="px-5 py-3 text-left text-xs font-medium"
                      style={{ color: '#6b7280', background: '#f9fafb' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c, i) => (
                  <tr
                    key={c.campaign_id}
                    style={{
                      borderBottom: i < campaigns.length - 1 ? '1px solid #f3f4f6' : 'none',
                      background: i % 2 === 1 ? '#f9fafb' : '#ffffff',
                    }}
                    className="transition-colors duration-150"
                  >
                    <td
                      className="px-5 py-3.5 font-medium max-w-[220px] truncate"
                      style={{ color: '#111827' }}
                    >
                      {c.campaign_name}
                    </td>
                    <td className="px-5 py-3.5" style={{ color: '#374151' }}>
                      {fmt(c.spend, '₩')}
                    </td>
                    <td className="px-5 py-3.5" style={{ color: '#374151' }}>
                      {fmt(c.conversions)}
                    </td>
                    <td className="px-5 py-3.5" style={{ color: '#374151' }}>
                      {fmt(c.cpa ? Math.round(c.cpa) : null, '₩')}
                    </td>
                    <td className="px-5 py-3.5" style={{ color: '#374151' }}>
                      {c.ctr != null ? `${c.ctr.toFixed(2)}%` : '-'}
                    </td>
                    <td className="px-5 py-3.5" style={{ color: '#374151' }}>
                      {c.roas != null ? c.roas.toFixed(2) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pending queue preview */}
      {queue.length > 0 && (
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
                승인 대기 ({queue.length}건)
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
            {queue.slice(0, 3).map((item, i) => {
              const change = item.proposed_change as { reason?: string; action?: string }
              const badge = severityBadge(item.severity)
              return (
                <div
                  key={item.id}
                  className="px-6 py-3.5 flex items-center gap-3"
                  style={{
                    borderBottom: i < Math.min(queue.length, 3) - 1
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
