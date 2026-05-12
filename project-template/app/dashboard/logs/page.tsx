import { createClient } from '@/lib/supabase/client'

export const revalidate = 0

const STATUS_STYLE: Record<string, { color: string; bg: string; border: string; label: string }> = {
  approved: { color: '#2563eb', bg: 'rgba(99,102,241,0.08)',  border: 'rgba(99,102,241,0.2)',   label: '승인됨' },
  rejected: { color: '#71717a', bg: '#f4f4f5',                border: '#e4e4e7',                label: '거절됨' },
  executed: { color: '#059669', bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.25)', label: '실행됨' },
  failed:   { color: '#dc2626', bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.25)',  label: '실패'   },
}

export default async function LogsPage() {
  let items: any[] = []
  try {
    const supabase = createClient()
    const { data } = await supabase
      .from('action_queue')
      .select('*')
      .not('status', 'eq', 'pending')
      .order('updated_at', { ascending: false })
      .limit(100)
    items = data ?? []
  } catch {
    // Supabase 미연결 시 빈 화면
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-black" style={{ fontSize: '26px', color: '#0f0f11', letterSpacing: '-0.02em' }}>
          실행 이력
        </h1>
        <p className="text-sm mt-1" style={{ color: '#a1a1aa' }}>처리된 최근 100건</p>
      </div>

      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: '#ffffff',
          boxShadow: '0 0 0 1px rgba(0,0,0,0.05), 0 2px 8px rgba(0,0,0,0.05), 0 8px 24px rgba(0,0,0,0.04)',
        }}
      >
        {items.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <div
              className="w-12 h-12 rounded-2xl mx-auto mb-4 flex items-center justify-center"
              style={{ background: '#f4f4f5' }}
            >
              <span style={{ fontSize: '20px' }}>📋</span>
            </div>
            <p className="text-sm font-semibold" style={{ color: '#3f3f46' }}>처리된 이력이 없습니다</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid #f4f4f5', background: '#fafafa' }}>
                {['시간', '캠페인', '조치 내용', '상태', '처리자'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: '#a1a1aa' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => {
                const change = item.proposed_change as any
                const stat = STATUS_STYLE[item.status]
                return (
                  <tr
                    key={item.id}
                    className="transition-colors duration-150 hover:bg-gray-50"
                    style={{ borderBottom: i < items.length - 1 ? '1px solid #f4f4f5' : 'none' }}
                  >
                    <td className="px-5 py-3.5 text-xs whitespace-nowrap font-medium" style={{ color: '#a1a1aa' }}>
                      {new Date(item.updated_at).toLocaleString('ko-KR')}
                    </td>
                    <td className="px-5 py-3.5 max-w-[200px] truncate font-semibold" style={{ color: '#0f0f11' }}>
                      {item.campaign_name ?? item.campaign_id}
                    </td>
                    <td className="px-5 py-3.5 text-xs max-w-[300px]" style={{ color: '#71717a' }}>
                      {change?.reason ?? change?.action ?? '-'}
                    </td>
                    <td className="px-5 py-3.5">
                      {stat ? (
                        <span
                          className="text-xs px-2.5 py-1 rounded-full font-semibold"
                          style={{ background: stat.bg, border: `1px solid ${stat.border}`, color: stat.color }}
                        >
                          {stat.label}
                        </span>
                      ) : (
                        <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background: '#f4f4f5', color: '#71717a' }}>
                          {item.status}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-xs font-medium" style={{ color: '#a1a1aa' }}>
                      {item.approved_by ?? '–'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
