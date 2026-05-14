'use client'

import { useEffect, useState, useCallback } from 'react'
import { createBrowserClient } from '@/lib/supabase/browser'

type ProductTarget = { id: string; product_name: string; target_cpa: number; is_active: boolean; slack_user_id: string | null }
type PromotionTarget = { id: string; promotion_name: string; target_cpa: number; is_active: boolean; slack_user_id: string | null }

const inputStyle = {
  border: '1px solid #e4e4e7',
  background: '#ffffff',
  color: '#0f0f11',
  borderRadius: '10px',
  padding: '8px 12px',
  fontSize: '14px',
  outline: 'none',
  transition: 'border-color 150ms, box-shadow 150ms',
  width: '100%',
}

const inputFocusStyle = {
  border: '1px solid #6366f1',
  boxShadow: '0 0 0 3px rgba(99,102,241,0.12)',
}

function StyledInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [focused, setFocused] = useState(false)
  return (
    <input
      {...props}
      style={{ ...inputStyle, ...(focused ? inputFocusStyle : {}), ...props.style }}
      onFocus={e => { setFocused(true); props.onFocus?.(e) }}
      onBlur={e => { setFocused(false); props.onBlur?.(e) }}
    />
  )
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
  const [editSlack, setEditSlack] = useState('')
  const [adding, setAdding] = useState(false)
  const [addName, setAddName] = useState('')
  const [addCpa, setAddCpa] = useState('')
  const [addSlack, setAddSlack] = useState('')

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
    setEditSlack(item.slack_user_id ?? '')
    setAdding(false)
  }

  async function handleSave(id: string) {
    if (!editName || !editCpa) return
    await supabase.from(table as any).update({
      [nameKey]: editName,
      target_cpa: Number(editCpa),
      slack_user_id: editSlack.trim() || null,
    }).eq('id', id)
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
    await supabase.from(table as any).insert({
      [nameKey]: addName,
      target_cpa: Number(addCpa),
      slack_user_id: addSlack.trim() || null,
    })
    setAdding(false)
    setAddName('')
    setAddCpa('')
    setAddSlack('')
    loadData()
  }

  function startAdding() {
    setAdding(true)
    setEditingId(null)
    setAddName('')
    setAddCpa('')
    setAddSlack('')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-black" style={{ fontSize: '26px', color: '#0f0f11', letterSpacing: '-0.02em' }}>
          목표 설정
        </h1>
        <p className="text-sm mt-1" style={{ color: '#a1a1aa' }}>상품·프로모션별 목표 CPA 관리 (매체 기준)</p>
      </div>

      {/* Tabs */}
      <div
        className="flex gap-1 p-1 rounded-xl w-fit"
        style={{ background: '#f4f4f5', border: '1px solid #e4e4e7' }}
      >
        {([['product', '상품 목표 CPA'], ['promotion', '프로모션 목표 CPA']] as const).map(([v, label]) => (
          <button
            key={v}
            onClick={() => { setTab(v); setEditingId(null); setAdding(false) }}
            className="text-sm px-4 py-2 rounded-lg font-semibold transition-all duration-150"
            style={tab === v ? {
              background: '#ffffff',
              color: '#0f0f11',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            } : {
              color: '#a1a1aa',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: '#ffffff',
          boxShadow: '0 0 0 1px rgba(0,0,0,0.05), 0 2px 8px rgba(0,0,0,0.05), 0 8px 24px rgba(0,0,0,0.04)',
        }}
      >
        {/* Header */}
        <div
          className="px-5 py-3.5 flex items-center justify-between"
          style={{ borderBottom: '1px solid #f4f4f5', background: '#fafafa' }}
        >
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#a1a1aa' }}>
            {isProduct ? '상품명' : '프로모션명'} / 목표 CPA
          </span>
          <button
            onClick={startAdding}
            className="text-xs px-3.5 py-1.5 rounded-xl font-semibold transition-all duration-200"
            style={{
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: '#ffffff',
              boxShadow: '0 2px 6px rgba(99,102,241,0.3)',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 10px rgba(99,102,241,0.45)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 2px 6px rgba(99,102,241,0.3)' }}
          >
            + 추가
          </button>
        </div>

        {loading && (
          <div className="px-5 py-10 text-center text-sm" style={{ color: '#a1a1aa' }}>불러오는 중...</div>
        )}

        {/* Add row */}
        {adding && (
          <div
            className="px-5 py-3.5 flex items-center gap-3"
            style={{ borderBottom: '1px solid #f4f4f5', background: 'rgba(99,102,241,0.03)' }}
          >
            <StyledInput
              autoFocus
              value={addName}
              onChange={e => setAddName(e.target.value)}
              placeholder={isProduct ? '상품명 (예: 팝콘)' : '프로모션명 (예: 990딜)'}
              style={{ flex: 1 }}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />
            <span className="text-sm shrink-0 font-medium" style={{ color: '#71717a' }}>목표 ₩</span>
            <StyledInput
              value={addCpa}
              onChange={e => setAddCpa(e.target.value)}
              placeholder="0"
              type="number"
              style={{ width: '100px' }}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />
            <span className="text-sm shrink-0 font-medium" style={{ color: '#71717a' }}>담당</span>
            <StyledInput
              value={addSlack}
              onChange={e => setAddSlack(e.target.value)}
              placeholder="U01ABCD2EFG"
              style={{ width: '140px' }}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />
            <button
              onClick={handleAdd}
              className="text-xs px-3.5 py-2 rounded-xl font-semibold shrink-0 transition-all duration-200"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', boxShadow: '0 2px 6px rgba(99,102,241,0.3)' }}
            >
              저장
            </button>
            <button
              onClick={() => setAdding(false)}
              className="text-xs px-3.5 py-2 rounded-xl font-semibold shrink-0 transition-all duration-200"
              style={{ background: '#f4f4f5', color: '#71717a', border: '1px solid #e4e4e7' }}
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
              className="px-5 py-3.5 flex items-center gap-3 transition-colors duration-150"
              style={{
                borderBottom: i < items.length - 1 ? '1px solid #f4f4f5' : 'none',
                opacity: item.is_active ? 1 : 0.4,
              }}
            >
              {editingId === item.id ? (
                <>
                  <StyledInput
                    autoFocus
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    style={{ flex: 1 }}
                    onKeyDown={e => e.key === 'Enter' && handleSave(item.id)}
                  />
                  <span className="text-sm shrink-0 font-medium" style={{ color: '#71717a' }}>₩</span>
                  <StyledInput
                    value={editCpa}
                    onChange={e => setEditCpa(e.target.value)}
                    type="number"
                    style={{ width: '100px' }}
                    onKeyDown={e => e.key === 'Enter' && handleSave(item.id)}
                  />
                  <span className="text-sm shrink-0 font-medium" style={{ color: '#71717a' }}>담당</span>
                  <StyledInput
                    value={editSlack}
                    onChange={e => setEditSlack(e.target.value)}
                    placeholder="U01ABCD2EFG"
                    style={{ width: '140px' }}
                    onKeyDown={e => e.key === 'Enter' && handleSave(item.id)}
                  />
                  <button
                    onClick={() => handleSave(item.id)}
                    className="text-xs px-3.5 py-2 rounded-xl font-semibold shrink-0"
                    style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', boxShadow: '0 2px 6px rgba(99,102,241,0.3)' }}
                  >
                    저장
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="text-xs px-3.5 py-2 rounded-xl font-semibold shrink-0"
                    style={{ background: '#f4f4f5', color: '#71717a', border: '1px solid #e4e4e7' }}
                  >
                    취소
                  </button>
                </>
              ) : (
                <>
                  <p className="flex-1 text-sm font-semibold" style={{ color: '#0f0f11' }}>{name}</p>
                  <p className="text-sm font-bold tabular-nums" style={{ color: '#3f3f46' }}>
                    ₩{item.target_cpa.toLocaleString('ko-KR')}
                  </p>
                  <span
                    className="text-xs font-mono px-2 py-0.5 rounded shrink-0"
                    style={{
                      background: item.slack_user_id ? 'rgba(99,102,241,0.08)' : '#f4f4f5',
                      color: item.slack_user_id ? '#6366f1' : '#c4c4c8',
                      border: `1px solid ${item.slack_user_id ? 'rgba(99,102,241,0.2)' : '#e4e4e7'}`,
                      minWidth: '120px',
                      textAlign: 'center',
                    }}
                    title={item.slack_user_id ? `Slack 멘션 대상: <@${item.slack_user_id}>` : '담당자 미지정'}
                  >
                    {item.slack_user_id ?? '담당자 없음'}
                  </span>
                  <button
                    onClick={() => handleToggle(item.id, item.is_active)}
                    className="text-xs px-2.5 py-1 rounded-full font-semibold transition-all duration-150"
                    style={item.is_active ? {
                      background: 'rgba(16,185,129,0.1)',
                      border: '1px solid rgba(16,185,129,0.3)',
                      color: '#059669',
                    } : {
                      background: '#f4f4f5',
                      border: '1px solid #e4e4e7',
                      color: '#a1a1aa',
                    }}
                  >
                    {item.is_active ? '활성' : '비활성'}
                  </button>
                  <button
                    onClick={() => startEdit(item)}
                    className="text-xs px-2.5 py-1.5 rounded-lg font-semibold transition-all duration-150"
                    style={{ background: '#f4f4f5', color: '#3f3f46', border: '1px solid #e4e4e7' }}
                  >
                    수정
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="text-xs px-2.5 py-1.5 rounded-lg font-semibold transition-all duration-150"
                    style={{ background: 'rgba(239,68,68,0.08)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.2)' }}
                  >
                    삭제
                  </button>
                </>
              )}
            </div>
          )
        })}

        {!loading && items.length === 0 && !adding && (
          <div className="px-5 py-12 text-center text-sm" style={{ color: '#a1a1aa' }}>
            등록된 목표가 없습니다 — + 추가 버튼으로 추가해보세요
          </div>
        )}
      </div>

      {/* Help */}
      <div
        className="rounded-xl px-4 py-3.5 text-xs space-y-1.5"
        style={{
          background: '#f9f9fb',
          border: '1px solid #e4e4e7',
          color: '#71717a',
        }}
      >
        <p className="font-semibold" style={{ color: '#3f3f46' }}>매칭 기준 (프로모션 우선)</p>
        <p>• 캠페인명에 <strong>프로모션명이 포함되면 프로모션 CPA</strong>를, 없으면 <strong>상품 CPA</strong>를 사용합니다</p>
        <p>• 예) 상품명 <strong>"팝콘"</strong> → <strong>"[콘스프맛 팝콘] 26.05_..."</strong> 캠페인 자동 매칭</p>
        <p>• 예) 프로모션명 <strong>"990딜"</strong> → <strong>"[제과_990딜] 26.05_..."</strong> 캠페인 자동 매칭 (상품보다 우선)</p>
        <p>• 손익분기점이 바뀌면 여기서 즉시 수정 — 다음 정시 평가부터 새 목표가 적용됩니다</p>
      </div>
    </div>
  )
}
