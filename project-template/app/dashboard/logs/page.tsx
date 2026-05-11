import { createClient } from '@/lib/supabase/client'

export const revalidate = 0

const RESULT_STYLE: Record<string, string> = {
  approved: 'bg-blue-500/20 text-blue-400',
  rejected: 'bg-gray-700 text-gray-400',
  executed: 'bg-green-500/20 text-green-400',
  failed:   'bg-red-500/20 text-red-400',
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
      <h1 className="text-xl font-bold text-white">실행 이력</h1>

      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        {items.length === 0 ? (
          <p className="px-5 py-12 text-sm text-gray-500 text-center">처리된 이력이 없습니다</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-800">
                {['시간', '캠페인', '조치 내용', '상태', '처리자'].map(h => (
                  <th key={h} className="px-4 py-2 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {items.map(item => {
                const change = item.proposed_change as any
                return (
                  <tr key={item.id} className="hover:bg-gray-800/50">
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {new Date(item.updated_at).toLocaleString('ko-KR')}
                    </td>
                    <td className="px-4 py-3 text-gray-200 max-w-[200px] truncate">
                      {item.campaign_name ?? item.campaign_id}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs max-w-[300px]">
                      {change?.reason ?? change?.action ?? '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${RESULT_STYLE[item.status] ?? 'bg-gray-700 text-gray-400'}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
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
