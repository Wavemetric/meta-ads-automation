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
        bg: 'rgba(239,68,68,0.1)',
        border: 'rgba(239,68,68,0.25)',
        color: '#f87171',
        glow: '0 0 8px rgba(239,68,68,0.2)',
      }
    if (severity === 'medium')
      return {
        bg: 'rgba(234,179,8,0.1)',
        border: 'rgba(234,179,8,0.25)',
        color: '#fbbf24',
        glow: '0 0 8px rgba(234,179,8,0.2)',
      }
    return {
      bg: 'rgba(16,185,129,0.1)',
      border: 'rgba(16,185,129,0.25)',
      color: '#34d399',
      glow: '0 0 8px rgba(16,185,129,0.2)',
    }
  }

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h1
          className="text-2xl font-bold"
          style={{
            background: 'linear-gradient(90deg, #fff 60%, rgba(255,255,255,0.5))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          KPI 모니터링
        </h1>
        <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
          실시간 광고 성과 대시보드
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpiCards.map(({ label, value, accent, accentRgb }) => (
          <div
            key={label}
            className="rounded-xl p-5 transition-all duration-200"
            style={{
              background: `linear-gradient(135deg, rgba(${accentRgb},0.06) 0%, rgba(17,17,24,0.8) 100%)`,
              border: `1px solid rgba(${accentRgb},0.18)`,
              backdropFilter: 'blur(12px)',
            }}
          >
            <p className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {label}
            </p>
            <p
              className="text-2xl font-bold mt-2 tracking-tight"
              style={{
                background: `linear-gradient(135deg, #fff 40%, ${accent})`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Campaign table */}
      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: 'rgba(17,17,24,0.6)',
          border: '1px solid rgba(255,255,255,0.07)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div
          className="px-6 py-4 flex items-center justify-between"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <h2 className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.8)' }}>
            캠페인 성과
          </h2>
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{
              background: 'rgba(59,130,246,0.1)',
              color: '#60a5fa',
              border: '1px solid rgba(59,130,246,0.2)',
            }}
          >
            {campaigns.length}개 캠페인
          </span>
        </div>

        {campaigns.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.2)' }}>
              데이터 없음 — Cron 수집 후 표시됩니다
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {['캠페인', '지출', '전환', 'CPA', 'CTR', 'ROAS'].map(h => (
                    <th
                      key={h}
                      className="px-5 py-3 text-left text-xs font-medium"
                      style={{ color: 'rgba(255,255,255,0.3)' }}
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
                      borderBottom: i < campaigns.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    }}
                    className="transition-colors duration-150 hover:bg-white/[0.02]"
                  >
                    <td
                      className="px-5 py-3.5 font-medium max-w-[220px] truncate"
                      style={{ color: 'rgba(255,255,255,0.85)' }}
                    >
                      {c.campaign_name}
                    </td>
                    <td className="px-5 py-3.5" style={{ color: 'rgba(255,255,255,0.55)' }}>
                      {fmt(c.spend, '₩')}
                    </td>
                    <td className="px-5 py-3.5" style={{ color: 'rgba(255,255,255,0.55)' }}>
                      {fmt(c.conversions)}
                    </td>
                    <td className="px-5 py-3.5" style={{ color: 'rgba(255,255,255,0.55)' }}>
                      {fmt(c.cpa ? Math.round(c.cpa) : null, '₩')}
                    </td>
                    <td className="px-5 py-3.5" style={{ color: 'rgba(255,255,255,0.55)' }}>
                      {c.ctr != null ? `${c.ctr.toFixed(2)}%` : '-'}
                    </td>
                    <td className="px-5 py-3.5" style={{ color: 'rgba(255,255,255,0.55)' }}>
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
            background: 'rgba(17,17,24,0.6)',
            border: '1px solid rgba(234,179,8,0.15)',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 0 20px rgba(234,179,8,0.04)',
          }}
        >
          <div
            className="px-6 py-4 flex items-center justify-between"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div className="flex items-center gap-2">
              <span
                className="w-1.5 h-1.5 rounded-full inline-block"
                style={{ background: '#fbbf24', boxShadow: '0 0 6px rgba(251,191,36,0.7)' }}
              />
              <h2 className="text-sm font-semibold" style={{ color: '#fbbf24' }}>
                승인 대기 ({queue.length}건)
              </h2>
            </div>
            <a
              href="/dashboard/queue"
              className="text-xs transition-colors duration-150"
              style={{ color: '#60a5fa' }}
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
                      ? '1px solid rgba(255,255,255,0.04)'
                      : 'none',
                  }}
                >
                  <span
                    className="shrink-0 text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{
                      background: badge.bg,
                      border: `1px solid ${badge.border}`,
                      color: badge.color,
                      boxShadow: badge.glow,
                    }}
                  >
                    {item.severity}
                  </span>
                  <span className="text-sm truncate" style={{ color: 'rgba(255,255,255,0.7)' }}>
                    {item.campaign_name}
                  </span>
                  <span className="text-xs ml-auto shrink-0" style={{ color: 'rgba(255,255,255,0.3)' }}>
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
