import { createClient } from '@/lib/supabase/client'

export const revalidate = 0

const RESULT_STYLE: Record<string, string> = {
  approved: 'bg-blue-50 text-blue-600',
  rejected: 'bg-gray-100 text-gray-500',
  executed: 'bg-green-50 text-green-600',
  failed:   'bg-red-50 text-red-600',
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
    <div className="space-y-5">
      <h1 className="text-xl font-bold" style={{ color: '#111827' }}>실행 이력</h1>

      <div className="bg-white border rounded-lg overflow-hidden" style={{ borderColor: '#e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        {items.length === 0 ? (
          <p className="px-5 py-12 text-sm text-center" style={{ color: '#9ca3af' }}>처리된 이력이 없습니다</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs border-b" style={{ color: '#6b7280', borderColor: '#e5e7eb', background: '#f9fafb' }}>
                {['시간', '캠페인', '조치 내용', '상태', '처리자'].map(h => (
                  <th key={h} className="px-4 py-2 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y" style={{ '--tw-divide-opacity': '1' } as React.CSSProperties}>
              {items.map(item => {
                const change = item.proposed_change as any
                return (
                  <tr key={item.id} className="hover:bg-gray-50" style={{ borderColor: '#f3f4f6' }}>
                    <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: '#9ca3af' }}>
                      {new Date(item.updated_at).toLocaleString('ko-KR')}
                    </td>
                    <td className="px-4 py-3 max-w-[200px] truncate" style={{ color: '#111827' }}>
                      {item.campaign_name ?? item.campaign_id}
                    </td>
                    <td className="px-4 py-3 text-xs max-w-[300px]" style={{ color: '#6b7280' }}>
                      {change?.reason ?? change?.action ?? '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${RESULT_STYLE[item.status] ?? 'bg-gray-100 text-gray-500'}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: '#9ca3af' }}>
                      {item.approved_by ?? '-'}
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
