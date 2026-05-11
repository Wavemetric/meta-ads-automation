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
      <h1 className="text-xl font-bold" style={{ color: '#111827' }}>소재 성과 트래킹</h1>

      <div className="bg-white border rounded-lg overflow-hidden" style={{ borderColor: '#e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        {!creatives?.length ? (
          <p className="px-5 py-8 text-sm text-center" style={{ color: '#9ca3af' }}>
            소재 데이터가 없습니다 — 수집 후 표시됩니다
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs border-b" style={{ color: '#6b7280', borderColor: '#e5e7eb', background: '#f9fafb' }}>
                {['소재명', '타입', 'CTR', 'CPM', '지출', '피로도', '상태'].map(h => (
                  <th key={h} className="px-4 py-2 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: '#f3f4f6' }}>
              {creatives.map(c => (
                <tr key={c.id} className={`hover:bg-gray-50 ${!c.is_active ? 'opacity-40' : ''}`} style={{ borderColor: '#f3f4f6' }}>
                  <td className="px-4 py-3 max-w-[180px] truncate" style={{ color: '#111827' }}>{c.name ?? c.creative_id}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: '#9ca3af' }}>{c.type ?? '-'}</td>
                  <td className="px-4 py-3" style={{ color: '#374151' }}>{c.ctr != null ? `${c.ctr.toFixed(2)}%` : '-'}</td>
                  <td className="px-4 py-3" style={{ color: '#374151' }}>{c.cpm != null ? `₩${c.cpm.toLocaleString('ko-KR')}` : '-'}</td>
                  <td className="px-4 py-3" style={{ color: '#374151' }}>{c.spend != null ? `₩${c.spend.toLocaleString('ko-KR')}` : '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`font-bold ${fatigueColor(c.fatigue_score)}`}>{c.fatigue_score}</span>
                    <span className="text-xs" style={{ color: '#9ca3af' }}> /100</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${c.is_active ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
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
        <p className="text-xs" style={{ color: '#9ca3af' }}>
          피로도 70 이상 소재는 교체 검토가 필요합니다. (frequency &gt; 3.5 또는 CTR 전주 대비 30% 하락)
        </p>
      )}
    </div>
  )
}
