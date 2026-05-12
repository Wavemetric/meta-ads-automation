'use client'

import { useEffect, useState, useCallback } from 'react'
import { createBrowserClient } from '@/lib/supabase/browser'

type ProductTarget = { id: string; product_name: string; target_cpa: number; is_active: boolean }
type PromotionTarget = { id: string; promotion_name: string; target_cpa: number; is_active: boolean }

const inputStyle = {
  border: '1px solid #93c5fd',
  background: '#fff',
  color: '#111827',
}

export default function GoalsClient() {
  const supabase = createBrowserClient()
  const [tab, setTab] = useState<'product' | 'promotion'>('product')
  const [products, setProducts] = useState<ProductTarget[]>([])
  const [promotions, setPromotions] = useState<PromotionTarget[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editCpa, setEditCpa] = useState('')
  const [adding, setAdding] = useState(false)
  const [addName, setAddName] = useState('')
  const [addCpa, setAddCpa] = useState('')

  const loadData = useCallback(async () => {
    const [p, pr] = await Promise.all([
      supabase.from('product_target_cpas').select('*').order('product_name'),
      supabase.from('promotion_target_cpas').select('*').order('promotion_name'),
    ])
    setProducts((p.data ?? []) as ProductTarget[])
    setPromotions((pr.data ?? []) as PromotionTarget[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  const isProduct = tab === 'product'
  const items = isProduct ? products : promotions
  const nameKey = isProduct ? 'product_name' : 'promotion_name'
  const table = isProduct ? 'product_target_cpas' : 'promotion_target_cpas'

  function startEdit(item: ProductTarget | PromotionTarget) {
    setEditingId(item.id)
    setEditName(isProduct ? (item as ProductTarget).product_name : (item as PromotionTarget).promotion_name)
    setEditCpa(String(item.target_cpa))
    setAdding(false)
  }

  async function handleSave(id: string) {
    if (!editName || !editCpa) return
    await supabase.from(table as any)
      .update({ [nameKey]: editName, target_cpa: Number(editCpa) })
      .eq('id', id)
    setEditingId(null)
    loadData()
  }

  async function handleDelete(id: string) {
    if (!confirm('삭제할까요?')) return
    await supabase.from(table as any).delete().eq('id', id)
    loadData()
  }

  async function handleToggle(id: string, current: boolean) {
    await supabase.from(table as any).update({ is_active: !current }).eq('id', id)
    loadData()
  }

  async function handleAdd() {
    if (!addName || !addCpa) return
    await supabase.from(table as any).insert({ [nameKey]: addName, target_cpa: Number(addCpa) })
    setAdding(false)
    setAddName('')
    setAddCpa('')
    loadData()
  }

  function startAdding() {
    setAdding(true)
    setEditingId(null)
    setAddName('')
    setAddCpa('')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#111827' }}>목표 설정</h1>
        <p className="text-sm mt-1" style={{ color: '#6b7280' }}>상품·프로모션별 목표 CPA 관리 (매체 기준)</p>
      </div>

      {/* Tabs */}
      <div
        className="flex gap-1 p-1 rounded-lg w-fit"
        style={{ background: '#f3f4f6', border: '1px solid #e5e7eb' }}
      >
        {([['product', '상품 목표 CPA'], ['promotion', '프로모션 목표 CPA']] as const).map(([v, label]) => (
          <button
            key={v}
            onClick={() => { setTab(v); setEditingId(null); setAdding(false) }}
            className="text-sm px-4 py-2 rounded-md font-medium transition-all duration-150"
            style={tab === v
              ? { background: '#ffffff', color: '#111827', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
              : { color: '#6b7280' }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: '#ffffff', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
      >
        {/* Table header */}
        <div
          className="px-5 py-3 flex items-center justify-between"
          style={{ borderBottom: '1px solid #f3f4f6', background: '#f9fafb' }}
        >
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#9ca3af' }}>
            {isProduct ? '상품명' : '프로모션명'} / 목표 CPA
          </span>
          <button
            onClick={startAdding}
            className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
            style={{ background: '#3b82f6', color: '#ffffff' }}
          >
            + 추가
          </button>
        </div>

        {loading && (
          <div className="px-5 py-8 text-center text-sm" style={{ color: '#9ca3af' }}>불러오는 중...</div>
        )}

        {/* Add row */}
        {adding && (
          <div
            className="px-5 py-3 flex items-center gap-3"
            style={{ borderBottom: '1px solid #f3f4f6', background: '#eff6ff' }}
          >
            <input
              autoFocus
              value={addName}
              onChange={e => setAddName(e.target.value)}
              placeholder={isProduct ? '상품명 (예: 팝콘)' : '프로모션명 (예: 990딜)'}
              className="rounded-lg px-3 py-1.5 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-blue-100"
              style={inputStyle}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />
            <span className="text-sm shrink-0" style={{ color: '#6b7280' }}>목표 CPA ₩</span>
            <input
              value={addCpa}
              onChange={e => setAddCpa(e.target.value)}
              placeholder="0"
              type="number"
              className="rounded-lg px-3 py-1.5 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-blue-100"
              style={inputStyle}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />
            <button
              onClick={handleAdd}
              className="text-xs px-3 py-1.5 rounded-lg font-medium shrink-0"
              style={{ background: '#3b82f6', color: '#fff' }}
            >
              저장
            </button>
            <button
              onClick={() => setAdding(false)}
              className="text-xs px-3 py-1.5 rounded-lg font-medium shrink-0"
              style={{ background: '#f3f4f6', color: '#6b7280' }}
            >
              취소
            </button>
          </div>
        )}

        {/* Rows */}
        {!loading && items.map((item, i) => {
          const name = isProduct ? (item as ProductTarget).product_name : (item as PromotionTarget).promotion_name
          return (
            <div
              key={item.id}
              className="px-5 py-3 flex items-center gap-3 transition-colors duration-150"
              style={{
                borderBottom: i < items.length - 1 ? '1px solid #f3f4f6' : 'none',
                opacity: item.is_active ? 1 : 0.45,
              }}
            >
              {editingId === item.id ? (
                <>
                  <input
                    autoFocus
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="rounded-lg px-3 py-1.5 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    style={inputStyle}
                    onKeyDown={e => e.key === 'Enter' && handleSave(item.id)}
                  />
                  <span className="text-sm shrink-0" style={{ color: '#6b7280' }}>₩</span>
                  <input
                    value={editCpa}
                    onChange={e => setEditCpa(e.target.value)}
                    type="number"
                    className="rounded-lg px-3 py-1.5 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    style={inputStyle}
                    onKeyDown={e => e.key === 'Enter' && handleSave(item.id)}
                  />
                  <button
                    onClick={() => handleSave(item.id)}
                    className="text-xs px-3 py-1.5 rounded-lg font-medium shrink-0"
                    style={{ background: '#3b82f6', color: '#fff' }}
                  >
                    저장
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="text-xs px-3 py-1.5 rounded-lg font-medium shrink-0"
                    style={{ background: '#f3f4f6', color: '#6b7280' }}
                  >
                    취소
                  </button>
                </>
              ) : (
                <>
                  <p className="flex-1 text-sm font-medium" style={{ color: '#111827' }}>{name}</p>
                  <p className="text-sm font-semibold tabular-nums" style={{ color: '#374151' }}>
                    ₩{item.target_cpa.toLocaleString('ko-KR')}
                  </p>
                  <button
                    onClick={() => handleToggle(item.id, item.is_active)}
                    className="text-xs px-2.5 py-1 rounded-full font-medium transition-colors"
                    style={item.is_active
                      ? { background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a' }
                      : { background: '#f3f4f6', border: '1px solid #e5e7eb', color: '#9ca3af' }}
                  >
                    {item.is_active ? '활성' : '비활성'}
                  </button>
                  <button
                    onClick={() => startEdit(item)}
                    className="text-xs px-2.5 py-1 rounded-lg font-medium"
                    style={{ background: '#f3f4f6', color: '#374151' }}
                  >
                    수정
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="text-xs px-2.5 py-1 rounded-lg font-medium"
                    style={{ background: '#fef2f2', color: '#dc2626' }}
                  >
                    삭제
                  </button>
                </>
              )}
            </div>
          )
        })}

        {!loading && items.length === 0 && !adding && (
          <div className="px-5 py-10 text-center text-sm" style={{ color: '#9ca3af' }}>
            등록된 목표가 없습니다 — + 추가 버튼으로 추가해보세요
          </div>
        )}
      </div>

      {/* Help */}
      <div
        className="rounded-lg px-4 py-3 text-xs space-y-1.5"
        style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#64748b' }}
      >
        <p className="font-semibold" style={{ color: '#475569' }}>매칭 기준</p>
        <p>• 이름이 <strong>캠페인명에 포함</strong>되면 해당 캠페인 데이터가 자동으로 집계됩니다</p>
        <p>• 예) 상품명 <strong>"팝콘"</strong> → <strong>"[콘스프맛 팝콘] 26.05_..."</strong> 캠페인 자동 매칭</p>
        <p>• 예) 프로모션명 <strong>"990딜"</strong> → <strong>"[제과_990딜] 26.05_..."</strong> 캠페인 자동 매칭</p>
      </div>
    </div>
  )
}
