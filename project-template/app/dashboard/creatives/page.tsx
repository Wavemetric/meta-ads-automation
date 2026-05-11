import { createClient } from '@/lib/supabase/client'

export const revalidate = 0

function fatigueColor(score: number) {
  if (score >= 70) return 'text-red-400'
  if (score >= 40) return 'text-yellow-400'
  return 'text-green-400'
}

export default async function CreativesPage() {
  let creatives: any[] | null = null
  try {
    const supabase = createClient()
    const { data } = await supabase
      .from('creatives')
      .select('*')
      .order('fatigue_score', { ascending: false })
      .limit(100)
    creatives = data
  } catch {
    // Supabase 미연결 시 빈 화면 표시
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-white">소재 성과 트래킹</h1>

      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        {!creatives?.length ? (
          <p className="px-5 py-8 text-sm text-gray-500 text-center">
            소재 데이터가 없습니다 — 수집 후 표시됩니다
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-800">
                {['소재명', '타입', 'CTR', 'CPM', '지출', '피로도', '상태'].map(h => (
                  <th key={h} className="px-4 py-2 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {creatives.map(c => (
                <tr key={c.id} className={`hover:bg-gray-800/50 ${!c.is_active ? 'opacity-40' : ''}`}>
                  <td className="px-4 py-3 text-gray-200 max-w-[180px] truncate">{c.name ?? c.creative_id}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{c.type ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-300">{c.ctr != null ? `${c.ctr.toFixed(2)}%` : '-'}</td>
                  <td className="px-4 py-3 text-gray-300">{c.cpm != null ? `₩${c.cpm.toLocaleString('ko-KR')}` : '-'}</td>
                  <td className="px-4 py-3 text-gray-300">{c.spend != null ? `₩${c.spend.toLocaleString('ko-KR')}` : '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`font-bold ${fatigueColor(c.fatigue_score)}`}>{c.fatigue_score}</span>
                    <span className="text-gray-600 text-xs"> /100</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${c.is_active ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-gray-500'}`}>
                      {c.is_active ? '활성' : '비활성'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {creatives && creatives.length > 0 && (
        <p className="text-xs text-gray-600">
          피로도 70 이상 소재는 교체 검토가 필요합니다. (frequency &gt; 3.5 또는 CTR 전주 대비 30% 하락)
        </p>
      )}
    </div>
  )
}
