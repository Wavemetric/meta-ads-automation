'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@/lib/supabase/browser'
import type { AutomationRule } from '@/lib/supabase/types'

const METRICS = ['cpa', 'roas', 'ctr', 'spend', 'impressions']
const OPERATORS = [
  { value: 'gt', label: '>' },
  { value: 'lt', label: '<' },
  { value: 'gte', label: '>=' },
  { value: 'lte', label: '<=' },
]
const ACTIONS = ['pause', 'resume', 'increase_budget', 'decrease_budget', 'replace_creative']
const SEVERITIES = ['low', 'medium', 'high']
const SCOPES = ['campaign', 'adset']
const THRESHOLD_TYPES = ['fixed', 'product_cpa']

const SEVERITY_STYLE: Record<string, { bg: string; border: string; color: string; glow: string }> = {
  high:   { bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.25)',   color: '#f87171', glow: '0 0 8px rgba(239,68,68,0.2)' },
  medium: { bg: 'rgba(234,179,8,0.1)',   border: 'rgba(234,179,8,0.25)',   color: '#fbbf24', glow: '0 0 8px rgba(234,179,8,0.2)' },
  low:    { bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.25)',  color: '#34d399', glow: '0 0 8px rgba(16,185,129,0.15)' },
}

const EMPTY: Omit<AutomationRule, 'id' | 'created_at' | 'updated_at'> = {
  name: '', description: '', metric: 'cpa', operator: 'gt',
  threshold: 0, action: 'decrease_budget', action_value: null,
  severity: 'medium', scope: 'campaign', is_active: true,
  product_filter: null, campaign_type_filter: null,
  time_start: null, time_end: null,
  is_midnight_rule: null, threshold_type: 'fixed', threshold_multiplier: null,
}

// 공통 입력 스타일
const inputCls = "w-full mt-1 rounded-lg px-3 py-2.5 text-sm transition-all duration-150 focus:outline-none"
const inputStyle = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: 'rgba(255,255,255,0.85)',
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>
      {children}
    </label>
  )
}

export default function RulesPage() {
  const supabase = createBrowserClient()
  const [rules, setRules] = useState<AutomationRule[]>([])
  const [form, setForm] = useState<typeof EMPTY>(EMPTY)
  const [editing, setEditing] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  async function load() {
    const { data } = await supabase.from('automation_rules').select('*').order('created_at')
    setRules(data ?? [])
  }

  useEffect(() => { load() }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave() {
    if (editing) {
      await supabase.from('automation_rules').update(form).eq('id', editing)
    } else {
      await supabase.from('automation_rules').insert(form)
    }
    setShowForm(false)
    setEditing(null)
    setForm(EMPTY)
    load()
  }

  async function handleToggle(id: string, current: boolean) {
    await supabase.from('automation_rules').update({ is_active: !current }).eq('id', id)
    load()
  }

  async function handleDelete(id: string) {
    if (!confirm('규칙을 삭제하시겠습니까?')) return
    await supabase.from('automation_rules').delete().eq('id', id)
    load()
  }

  function startEdit(rule: AutomationRule) {
    setEditing(rule.id)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, created_at, updated_at, ...rest } = rule
    setForm({ ...rest, description: rest.description ?? '' })
    setShowForm(true)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
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
            자동화 규칙 관리
          </h1>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
            광고 성과 기반 자동 액션 규칙
          </p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditing(null); setForm(EMPTY) }}
          className="text-sm px-4 py-2 rounded-lg font-medium transition-all duration-150"
          style={{
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            color: '#fff',
            boxShadow: '0 0 16px rgba(59,130,246,0.3)',
          }}
        >
          + 규칙 추가
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div
          className="rounded-xl p-6 space-y-5"
          style={{
            background: 'rgba(17,17,24,0.8)',
            border: '1px solid rgba(59,130,246,0.2)',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 0 30px rgba(59,130,246,0.06)',
          }}
        >
          <h2
            className="text-sm font-semibold"
            style={{
              background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            {editing ? '규칙 수정' : '새 규칙 추가'}
          </h2>

          {/* 기본 정보 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>규칙 이름</Label>
              <input
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                className={inputCls}
                style={inputStyle}
                placeholder="예: CPA 초과 시 예산 감소"
              />
            </div>

            <div>
              <Label>지표</Label>
              <select
                value={form.metric}
                onChange={e => setForm(p => ({ ...p, metric: e.target.value }))}
                className={inputCls}
                style={inputStyle}
              >
                {METRICS.map(m => <option key={m} value={m}>{m.toUpperCase()}</option>)}
              </select>
            </div>

            <div>
              <Label>조건</Label>
              <select
                value={form.operator}
                onChange={e => setForm(p => ({ ...p, operator: e.target.value }))}
                className={inputCls}
                style={inputStyle}
              >
                {OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            {/* 임계값 타입 */}
            <div>
              <Label>임계값 기준</Label>
              <select
                value={form.threshold_type ?? 'fixed'}
                onChange={e => setForm(p => ({ ...p, threshold_type: e.target.value, threshold_multiplier: e.target.value === 'fixed' ? null : (p.threshold_multiplier ?? 1.2) }))}
                className={inputCls}
                style={inputStyle}
              >
                {THRESHOLD_TYPES.map(t => (
                  <option key={t} value={t}>
                    {t === 'fixed' ? '고정값 (숫자)' : '상품 목표CPA 기준 (배율)'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label>
                {form.threshold_type === 'product_cpa' ? '임계값 (목표CPA 기준, 예: 1.2 = 120%)' : '임계값'}
              </Label>
              <input
                type="number"
                step={form.threshold_type === 'product_cpa' ? '0.1' : '1'}
                value={form.threshold_type === 'product_cpa' ? (form.threshold_multiplier ?? '') : form.threshold}
                onChange={e => {
                  const v = parseFloat(e.target.value) || 0
                  if (form.threshold_type === 'product_cpa') {
                    setForm(p => ({ ...p, threshold_multiplier: v }))
                  } else {
                    setForm(p => ({ ...p, threshold: v }))
                  }
                }}
                className={inputCls}
                style={inputStyle}
                placeholder={form.threshold_type === 'product_cpa' ? '1.2' : '33000'}
              />
            </div>

            <div>
              <Label>액션</Label>
              <select
                value={form.action}
                onChange={e => setForm(p => ({ ...p, action: e.target.value }))}
                className={inputCls}
                style={inputStyle}
              >
                {ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>

            {form.action.includes('budget') && (
              <div>
                <Label>조정 비율 (예: 0.1 = 10%)</Label>
                <input
                  type="number"
                  step="0.01"
                  value={form.action_value ?? ''}
                  onChange={e => setForm(p => ({ ...p, action_value: parseFloat(e.target.value) || null }))}
                  className={inputCls}
                  style={inputStyle}
                  placeholder="0.1"
                />
              </div>
            )}

            <div>
              <Label>심각도</Label>
              <select
                value={form.severity}
                onChange={e => setForm(p => ({ ...p, severity: e.target.value }))}
                className={inputCls}
                style={inputStyle}
              >
                {SEVERITIES.map(s => <option key={s} value={s}>{s === 'high' ? 'high (슬랙 즉시 알림)' : s === 'medium' ? 'medium (승인 필요)' : 'low (자동 실행)'}</option>)}
              </select>
            </div>
          </div>

          {/* 구분선 */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />

          {/* 상세 필터 */}
          <div>
            <p className="text-xs font-semibold mb-3" style={{ color: 'rgba(255,255,255,0.4)' }}>
              상세 필터 (선택)
            </p>
            <div className="grid grid-cols-2 gap-4">

              {/* Scope */}
              <div>
                <Label>적용 범위</Label>
                <div className="flex gap-2 mt-1">
                  {SCOPES.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setForm(p => ({ ...p, scope: s }))}
                      className="flex-1 py-2 rounded-lg text-xs font-medium transition-all duration-150"
                      style={form.scope === s ? {
                        background: 'rgba(59,130,246,0.2)',
                        border: '1px solid rgba(59,130,246,0.4)',
                        color: '#60a5fa',
                        boxShadow: '0 0 8px rgba(59,130,246,0.15)',
                      } : {
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        color: 'rgba(255,255,255,0.4)',
                      }}
                    >
                      {s === 'campaign' ? '캠페인' : '광고세트'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Product filter */}
              <div>
                <Label>상품 필터 (예: 파인트)</Label>
                <input
                  value={form.product_filter ?? ''}
                  onChange={e => setForm(p => ({ ...p, product_filter: e.target.value || null }))}
                  className={inputCls}
                  style={inputStyle}
                  placeholder="비워두면 전체 적용"
                />
              </div>

              {/* Time range */}
              <div>
                <Label>적용 시작 시간 (0~23시)</Label>
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={form.time_start ?? ''}
                  onChange={e => {
                    const v = e.target.value === '' ? null : parseInt(e.target.value)
                    setForm(p => ({ ...p, time_start: v }))
                  }}
                  className={inputCls}
                  style={inputStyle}
                  placeholder="예: 9 (9시부터)"
                />
              </div>

              <div>
                <Label>적용 종료 시간 (0~23시)</Label>
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={form.time_end ?? ''}
                  onChange={e => {
                    const v = e.target.value === '' ? null : parseInt(e.target.value)
                    setForm(p => ({ ...p, time_end: v }))
                  }}
                  className={inputCls}
                  style={inputStyle}
                  placeholder="예: 18 (18시까지)"
                />
              </div>
            </div>

            {/* Midnight rule checkbox */}
            <div className="mt-4">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div
                  className="w-4 h-4 rounded flex items-center justify-center transition-all duration-150 shrink-0"
                  style={form.is_midnight_rule ? {
                    background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                    border: '1px solid rgba(139,92,246,0.5)',
                    boxShadow: '0 0 8px rgba(59,130,246,0.3)',
                  } : {
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.12)',
                  }}
                  onClick={() => setForm(p => ({ ...p, is_midnight_rule: !p.is_midnight_rule }))}
                >
                  {form.is_midnight_rule && (
                    <span style={{ color: '#fff', fontSize: '10px', lineHeight: 1 }}>✓</span>
                  )}
                </div>
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  00시 일일 규칙 — 자정에 우선 실행되는 일일 규칙
                </span>
              </label>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSave}
              className="px-5 py-2 rounded-lg text-sm font-medium transition-all duration-150"
              style={{
                background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                color: '#fff',
                boxShadow: '0 0 16px rgba(59,130,246,0.25)',
              }}
            >
              저장
            </button>
            <button
              onClick={() => { setShowForm(false); setEditing(null) }}
              className="px-4 py-2 rounded-lg text-sm transition-all duration-150"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.5)',
              }}
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* Rules table */}
      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: 'rgba(17,17,24,0.6)',
          border: '1px solid rgba(255,255,255,0.07)',
          backdropFilter: 'blur(12px)',
        }}
      >
        {rules.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.2)' }}>
              등록된 규칙이 없습니다
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {['규칙명', '범위', '상품필터', '조건', '액션', '심각도', '시간대', '상태', ''].map(h => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-medium"
                      style={{ color: 'rgba(255,255,255,0.3)' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rules.map((r, i) => {
                  const sev = SEVERITY_STYLE[r.severity]
                  return (
                    <tr
                      key={r.id}
                      className="transition-colors duration-150 hover:bg-white/[0.02]"
                      style={{
                        borderBottom: i < rules.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                        opacity: r.is_active ? 1 : 0.35,
                      }}
                    >
                      <td className="px-4 py-3 font-medium" style={{ color: 'rgba(255,255,255,0.85)' }}>
                        <div className="flex items-center gap-1.5">
                          {r.is_midnight_rule && (
                            <span
                              className="text-xs px-1.5 py-0.5 rounded font-medium shrink-0"
                              style={{
                                background: 'rgba(99,102,241,0.15)',
                                border: '1px solid rgba(99,102,241,0.25)',
                                color: '#a5b4fc',
                              }}
                            >
                              00시
                            </span>
                          )}
                          {r.name}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="text-xs px-2 py-0.5 rounded-full"
                          style={{
                            background: 'rgba(255,255,255,0.05)',
                            color: 'rgba(255,255,255,0.45)',
                          }}
                        >
                          {r.scope ?? 'campaign'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        {r.product_filter ?? <span style={{ color: 'rgba(255,255,255,0.18)' }}>전체</span>}
                      </td>
                      <td className="px-4 py-3 text-xs font-mono" style={{ color: 'rgba(255,255,255,0.45)' }}>
                        {r.threshold_type === 'product_cpa'
                          ? `${r.metric} ${r.operator} 목표×${r.threshold_multiplier}`
                          : `${r.metric} ${r.operator} ${r.threshold}`}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
                        {r.action}
                      </td>
                      <td className="px-4 py-3">
                        {sev ? (
                          <span
                            className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{
                              background: sev.bg,
                              border: `1px solid ${sev.border}`,
                              color: sev.color,
                              boxShadow: sev.glow,
                            }}
                          >
                            {r.severity}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-500">{r.severity}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        {r.time_start != null && r.time_end != null
                          ? `${r.time_start}~${r.time_end}시`
                          : <span style={{ color: 'rgba(255,255,255,0.18)' }}>전체</span>}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleToggle(r.id, r.is_active)}
                          className="text-xs px-2.5 py-1 rounded-md font-medium transition-all duration-150"
                          style={r.is_active ? {
                            background: 'rgba(16,185,129,0.1)',
                            border: '1px solid rgba(16,185,129,0.2)',
                            color: '#34d399',
                          } : {
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            color: 'rgba(255,255,255,0.3)',
                          }}
                        >
                          {r.is_active ? '활성' : '비활성'}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-3">
                          <button
                            onClick={() => startEdit(r)}
                            className="text-xs transition-colors duration-150"
                            style={{ color: '#60a5fa' }}
                          >
                            수정
                          </button>
                          <button
                            onClick={() => handleDelete(r.id)}
                            className="text-xs transition-colors duration-150"
                            style={{ color: '#f87171' }}
                          >
                            삭제
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
