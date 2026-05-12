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
const SCOPES = ['campaign', 'adset']

const SEVERITY_STYLE: Record<string, { bg: string; border: string; color: string }> = {
  high:   { bg: '#fef2f2', border: '#fecaca', color: '#dc2626' },
  medium: { bg: '#fefce8', border: '#fde68a', color: '#ca8a04' },
  low:    { bg: '#f0fdf4', border: '#bbf7d0', color: '#16a34a' },
}

const EMPTY: Omit<AutomationRule, 'id' | 'created_at' | 'updated_at'> = {
  name: '', description: '', metric: 'cpa', operator: 'gt',
  threshold: 0, action: 'decrease_budget', action_value: null,
  severity: 'medium', scope: 'campaign', is_active: true,
  product_filter: null, campaign_type_filter: null,
  time_start: null, time_end: null,
  is_midnight_rule: null, threshold_type: 'fixed', threshold_multiplier: null,
}

const inputCls = "w-full mt-1 rounded-lg px-3 py-2 text-sm transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-100"
const inputStyle = { background: '#ffffff', border: '1px solid #d1d5db', color: '#111827' }
const inputDisabledStyle = { background: '#f9fafb', border: '1px solid #e5e7eb', color: '#9ca3af' }

function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-xs font-medium" style={{ color: '#6b7280' }}>{children}</label>
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#9ca3af' }}>
      {children}
    </p>
  )
}

// ── Group view helpers ──────────────────────────────────────────────────────

const TIME_GROUPS: {
  label: string
  icon: string
  filter: (r: AutomationRule) => boolean
}[] = [
  { label: '자정 실행',   icon: '🌙', filter: (r) => !!r.is_midnight_rule },
  { label: '오전 6~9시',  icon: '🕕', filter: (r) => !r.is_midnight_rule && r.time_start === 6  && r.time_end === 9  },
  { label: '오전 9~12시', icon: '🕘', filter: (r) => !r.is_midnight_rule && r.time_start === 9  && r.time_end === 12 },
  { label: '낮 12~16시',  icon: '🕛', filter: (r) => !r.is_midnight_rule && r.time_start === 12 && r.time_end === 16 },
  { label: '오후 4~8시',  icon: '🕓', filter: (r) => !r.is_midnight_rule && r.time_start === 16 && r.time_end === 20 },
  { label: '저녁 8~11시', icon: '🕗', filter: (r) => !r.is_midnight_rule && r.time_start === 20 && r.time_end === 23 },
]

type ConditionKey = 'lte_1.0' | 'lte_1.1' | 'gt_1.05' | 'gt_1.1'

const CONDITION_ORDER: ConditionKey[] = ['lte_1.0', 'lte_1.1', 'gt_1.05', 'gt_1.1']

const CONDITION_META: Record<ConditionKey, { label: string; dot: string; color: string }> = {
  'lte_1.0':  { label: 'CPA ≤ 목표치',           dot: '🟢', color: '#16a34a' },
  'lte_1.1':  { label: 'CPA ≤ 목표 10% 이내',     dot: '🟢', color: '#16a34a' },
  'gt_1.05':  { label: 'CPA > 목표 5% 초과',      dot: '🟡', color: '#ca8a04' },
  'gt_1.1':   { label: 'CPA > 목표 10% 초과',     dot: '🔴', color: '#dc2626' },
}

function getConditionKey(r: AutomationRule): ConditionKey | null {
  const m = r.threshold_multiplier
  if (r.operator === 'lte' && m === 1.0)  return 'lte_1.0'
  if (r.operator === 'lte' && m === 1.1)  return 'lte_1.1'
  if (r.operator === 'gt'  && m === 1.05) return 'gt_1.05'
  if (r.operator === 'gt'  && m === 1.1)  return 'gt_1.1'
  return null
}

function getScopeLabel(scope: string): string {
  if (scope === 'campaign') return 'ASC'
  if (scope === 'adset')    return '광고세트'
  if (scope === 'creative') return '소재'
  return scope
}

function getActionText(action: string, actionValue: number | null): string {
  switch (action) {
    case 'increase_budget':
      if (actionValue === 0.3) return '예산 +30%'
      return actionValue ? `예산 +${Math.round(actionValue * 100)}%` : '예산 증가'
    case 'decrease_budget':
      if (actionValue === 0.1) return '예산 -10%'
      return actionValue ? `예산 -${Math.round(actionValue * 100)}%` : '예산 감소'
    case 'set_budget_current':          return '예산 현상유지'
    case 'set_budget_yesterday':        return '예산 전일 동일'
    case 'set_budget_yesterday_70pct':  return '예산 전일 70%'
    case 'set_budget_yesterday_50pct':  return '예산 전일 50%'
    case 'resume':                      return '켜기'
    case 'pause':                       return '끄기'
    default:                            return action
  }
}

interface ActionChipProps {
  rule: AutomationRule
  conditionColor: string
}

function ActionChip({ rule, conditionColor }: ActionChipProps) {
  const scopeLabel  = getScopeLabel(rule.scope ?? 'campaign')
  const actionText  = getActionText(rule.action, rule.action_value)
  const faded       = !rule.is_active

  return (
    <span
      className="inline-flex items-center gap-0.5 px-2 py-1 rounded-md text-xs whitespace-nowrap"
      style={{
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        opacity: faded ? 0.45 : 1,
      }}
    >
      <span style={{ color: '#9ca3af' }}>{scopeLabel}</span>
      <span style={{ color: '#d1d5db', margin: '0 2px' }}>→</span>
      <span style={{ color: conditionColor, fontWeight: 500 }}>{actionText}</span>
    </span>
  )
}

interface GroupCardProps {
  label: string
  icon: string
  rules: AutomationRule[]
  onEdit: (r: AutomationRule) => void
}

function GroupCard({ label, icon, rules }: GroupCardProps) {
  if (rules.length === 0) return null

  // bucket rules by condition key, including ungrouped
  const buckets: Record<string, AutomationRule[]> = {}
  const ungrouped: AutomationRule[] = []

  for (const r of rules) {
    const key = getConditionKey(r)
    if (key) {
      if (!buckets[key]) buckets[key] = []
      buckets[key].push(r)
    } else {
      ungrouped.push(r)
    }
  }

  const orderedKeys = CONDITION_ORDER.filter(k => buckets[k]?.length)
  const hasUngrouped = ungrouped.length > 0

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: '#ffffff', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
    >
      {/* Card header */}
      <div
        className="flex items-center gap-2 px-4 py-3"
        style={{ borderBottom: '1px solid #f3f4f6', background: '#fafafa' }}
      >
        <span style={{ fontSize: '16px' }}>{icon}</span>
        <span className="text-sm font-semibold" style={{ color: '#111827' }}>{label}</span>
        <span
          className="text-xs px-2 py-0.5 rounded-full ml-1"
          style={{ background: '#f3f4f6', color: '#6b7280' }}
        >
          {rules.length}개 규칙
        </span>
      </div>

      {/* Condition groups */}
      <div className="divide-y" style={{ borderColor: '#f3f4f6' }}>
        {orderedKeys.map(key => {
          const meta  = CONDITION_META[key]
          const group = buckets[key]
          return (
            <div key={key} className="px-4 py-3">
              <div className="flex items-center gap-1.5 mb-2">
                <span style={{ fontSize: '13px' }}>{meta.dot}</span>
                <span className="text-xs font-medium" style={{ color: meta.color }}>{meta.label}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {group.map(r => (
                  <ActionChip key={r.id} rule={r} conditionColor={meta.color} />
                ))}
              </div>
            </div>
          )
        })}

        {hasUngrouped && (
          <div className="px-4 py-3">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-xs font-medium" style={{ color: '#6b7280' }}>기타 조건</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ungrouped.map(r => (
                <ActionChip key={r.id} rule={r} conditionColor="#6b7280" />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────────────

export default function RulesPage() {
  const supabase = createBrowserClient()
  const [rules, setRules] = useState<AutomationRule[]>([])
  const [form, setForm] = useState<typeof EMPTY>(EMPTY)
  const [editing, setEditing] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [formTab, setFormTab] = useState<'condition' | 'filter'>('condition')
  const [listTab, setListTab] = useState<'all' | 'active' | 'inactive'>('all')
  const [viewMode, setViewMode] = useState<'list' | 'group'>('group')

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
    setFormTab('condition')
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
    setFormTab('condition')
  }

  function openNew() {
    setShowForm(true)
    setEditing(null)
    setForm(EMPTY)
    setFormTab('condition')
  }

  const filteredRules = rules.filter(r =>
    listTab === 'all' ? true : listTab === 'active' ? r.is_active : !r.is_active
  )

  const listTabCounts = {
    all: rules.length,
    active: rules.filter(r => r.is_active).length,
    inactive: rules.filter(r => !r.is_active).length,
  }

  // Active rules for group view (always show all active)
  const activeRules = rules.filter(r => r.is_active)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#111827' }}>자동화 규칙 관리</h1>
          <p className="text-sm mt-1" style={{ color: '#6b7280' }}>광고 성과 기반 자동 액션 규칙</p>
        </div>
        <button
          onClick={openNew}
          className="text-sm px-4 py-2 rounded-lg font-medium"
          style={{ background: '#3b82f6', color: '#fff', boxShadow: '0 1px 3px rgba(59,130,246,0.3)' }}
        >
          + 규칙 추가
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div
          className="rounded-xl overflow-hidden"
          style={{
            background: '#ffffff',
            border: '1px solid #bfdbfe',
            boxShadow: '0 2px 8px rgba(59,130,246,0.08)',
            maxWidth: '640px',
          }}
        >
          {/* Form header */}
          <div className="px-5 pt-4 pb-0">
            <p className="text-sm font-semibold mb-3" style={{ color: '#1d4ed8' }}>
              {editing ? '규칙 수정' : '새 규칙 추가'}
            </p>

            {/* Form tabs */}
            <div className="flex" style={{ borderBottom: '1px solid #e5e7eb' }}>
              {([
                { key: 'condition', label: '조건 · 액션' },
                { key: 'filter',    label: '필터 · 시간대' },
              ] as const).map(t => (
                <button
                  key={t.key}
                  onClick={() => setFormTab(t.key)}
                  className="px-4 py-2 text-xs font-medium transition-all"
                  style={formTab === t.key ? {
                    color: '#2563eb',
                    borderBottom: '2px solid #3b82f6',
                    marginBottom: '-1px',
                  } : {
                    color: '#9ca3af',
                    borderBottom: '2px solid transparent',
                    marginBottom: '-1px',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab: 조건 · 액션 */}
          {formTab === 'condition' && (
            <div className="px-5 py-4 space-y-4">
              {/* 규칙 이름 */}
              <div>
                <Label>규칙 이름</Label>
                <input
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  className={inputCls}
                  style={inputStyle}
                  placeholder="예: CPA 초과 시 예산 감소"
                />
              </div>

              {/* 조건 섹션 */}
              <div>
                <SectionTitle>조건</SectionTitle>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>지표</Label>
                    <select
                      value={form.metric}
                      onChange={e => setForm(p => ({ ...p, metric: e.target.value }))}
                      className={inputCls} style={inputStyle}
                    >
                      {METRICS.map(m => <option key={m} value={m}>{m.toUpperCase()}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label>조건</Label>
                    <select
                      value={form.operator}
                      onChange={e => setForm(p => ({ ...p, operator: e.target.value }))}
                      className={inputCls} style={inputStyle}
                    >
                      {OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label>기준</Label>
                    <select
                      value={form.threshold_type ?? 'fixed'}
                      onChange={e => setForm(p => ({
                        ...p,
                        threshold_type: e.target.value,
                        threshold_multiplier: e.target.value === 'fixed' ? null : (p.threshold_multiplier ?? 1.2),
                      }))}
                      className={inputCls} style={inputStyle}
                    >
                      <option value="fixed">고정값</option>
                      <option value="product_cpa">목표CPA 배율</option>
                    </select>
                  </div>
                </div>
                <div className="mt-3" style={{ maxWidth: '200px' }}>
                  <Label>{form.threshold_type === 'product_cpa' ? '배율 (예: 1.2 = 120%)' : '임계값'}</Label>
                  <input
                    type="number"
                    step={form.threshold_type === 'product_cpa' ? '0.1' : '1'}
                    value={form.threshold_type === 'product_cpa' ? (form.threshold_multiplier ?? '') : form.threshold}
                    onChange={e => {
                      const v = parseFloat(e.target.value) || 0
                      form.threshold_type === 'product_cpa'
                        ? setForm(p => ({ ...p, threshold_multiplier: v }))
                        : setForm(p => ({ ...p, threshold: v }))
                    }}
                    className={inputCls} style={inputStyle}
                    placeholder={form.threshold_type === 'product_cpa' ? '1.2' : '33000'}
                  />
                </div>
              </div>

              {/* 액션 섹션 */}
              <div>
                <SectionTitle>액션</SectionTitle>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>실행 액션</Label>
                    <select
                      value={form.action}
                      onChange={e => setForm(p => ({ ...p, action: e.target.value }))}
                      className={inputCls} style={inputStyle}
                    >
                      {ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label>
                      조정 비율
                      {!form.action.includes('budget') && (
                        <span className="ml-1" style={{ color: '#d1d5db' }}>(해당 없음)</span>
                      )}
                    </Label>
                    <input
                      type="number"
                      step="0.01"
                      disabled={!form.action.includes('budget')}
                      value={form.action_value ?? ''}
                      onChange={e => setForm(p => ({ ...p, action_value: parseFloat(e.target.value) || null }))}
                      className={inputCls}
                      style={form.action.includes('budget') ? inputStyle : inputDisabledStyle}
                      placeholder="0.1 = 10%"
                    />
                  </div>
                </div>
              </div>

              {/* 심각도 */}
              <div>
                <SectionTitle>심각도</SectionTitle>
                <div className="flex gap-2">
                  {([
                    { v: 'high',   label: 'HIGH',   sub: '슬랙 즉시 알림' },
                    { v: 'medium', label: 'MEDIUM', sub: '승인 필요' },
                    { v: 'low',    label: 'LOW',    sub: '자동 실행' },
                  ] as const).map(s => (
                    <button
                      key={s.v}
                      type="button"
                      onClick={() => setForm(p => ({ ...p, severity: s.v }))}
                      className="flex-1 py-2.5 px-3 rounded-lg text-left transition-all duration-150"
                      style={form.severity === s.v ? {
                        background: SEVERITY_STYLE[s.v].bg,
                        border: `1.5px solid ${SEVERITY_STYLE[s.v].border}`,
                      } : {
                        background: '#f9fafb',
                        border: '1px solid #e5e7eb',
                      }}
                    >
                      <p className="text-xs font-bold" style={{ color: form.severity === s.v ? SEVERITY_STYLE[s.v].color : '#9ca3af' }}>
                        {s.label}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: form.severity === s.v ? SEVERITY_STYLE[s.v].color : '#c4c9d4' }}>
                        {s.sub}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Tab: 필터 · 시간대 */}
          {formTab === 'filter' && (
            <div className="px-5 py-4 space-y-4">
              {/* 적용 범위 */}
              <div>
                <SectionTitle>적용 범위</SectionTitle>
                <div className="flex gap-2" style={{ maxWidth: '280px' }}>
                  {SCOPES.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setForm(p => ({ ...p, scope: s }))}
                      className="flex-1 py-2 rounded-lg text-xs font-medium transition-all duration-150"
                      style={form.scope === s ? {
                        background: '#eff6ff',
                        border: '1.5px solid #3b82f6',
                        color: '#2563eb',
                      } : {
                        background: '#f9fafb',
                        border: '1px solid #e5e7eb',
                        color: '#6b7280',
                      }}
                    >
                      {s === 'campaign' ? '캠페인' : '광고세트'}
                    </button>
                  ))}
                </div>
              </div>

              {/* 상품 필터 */}
              <div>
                <SectionTitle>상품 필터</SectionTitle>
                <div style={{ maxWidth: '280px' }}>
                  <Label>상품명 키워드 (비우면 전체 적용)</Label>
                  <input
                    value={form.product_filter ?? ''}
                    onChange={e => setForm(p => ({ ...p, product_filter: e.target.value || null }))}
                    className={inputCls} style={inputStyle}
                    placeholder="예: 파인트"
                  />
                </div>
              </div>

              {/* 시간대 */}
              <div>
                <SectionTitle>적용 시간대</SectionTitle>
                <div className="grid grid-cols-2 gap-3" style={{ maxWidth: '280px' }}>
                  <div>
                    <Label>시작 시간 (0~23)</Label>
                    <input
                      type="number" min={0} max={23}
                      value={form.time_start ?? ''}
                      onChange={e => setForm(p => ({ ...p, time_start: e.target.value === '' ? null : parseInt(e.target.value) }))}
                      className={inputCls} style={inputStyle}
                      placeholder="9"
                    />
                  </div>
                  <div>
                    <Label>종료 시간 (0~23)</Label>
                    <input
                      type="number" min={0} max={23}
                      value={form.time_end ?? ''}
                      onChange={e => setForm(p => ({ ...p, time_end: e.target.value === '' ? null : parseInt(e.target.value) }))}
                      className={inputCls} style={inputStyle}
                      placeholder="18"
                    />
                  </div>
                </div>
                <p className="text-xs mt-1.5" style={{ color: '#9ca3af' }}>비워두면 24시간 적용</p>
              </div>

              {/* 00시 규칙 */}
              <div>
                <SectionTitle>00시 일일 규칙</SectionTitle>
                <button
                  type="button"
                  onClick={() => setForm(p => ({ ...p, is_midnight_rule: !p.is_midnight_rule }))}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg w-full text-left transition-all"
                  style={form.is_midnight_rule ? {
                    background: '#eef2ff',
                    border: '1.5px solid #c7d2fe',
                  } : {
                    background: '#f9fafb',
                    border: '1px solid #e5e7eb',
                  }}
                >
                  <div
                    className="w-4 h-4 rounded flex items-center justify-center shrink-0"
                    style={form.is_midnight_rule
                      ? { background: '#6366f1', border: '1px solid #4f46e5' }
                      : { background: '#ffffff', border: '1px solid #d1d5db' }}
                  >
                    {form.is_midnight_rule && <span style={{ color: '#fff', fontSize: '10px' }}>✓</span>}
                  </div>
                  <div>
                    <p className="text-xs font-medium" style={{ color: form.is_midnight_rule ? '#4f46e5' : '#374151' }}>
                      자정(00:00)에 우선 실행
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>
                      일별 예산 리셋에 맞춰 자정에 규칙을 먼저 실행합니다
                    </p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Form footer */}
          <div
            className="flex items-center justify-between px-5 py-3"
            style={{ borderTop: '1px solid #f3f4f6', background: '#fafafa' }}
          >
            <div className="flex gap-1.5">
              {(['condition', 'filter'] as const).map((t) => (
                <div
                  key={t}
                  className="w-1.5 h-1.5 rounded-full cursor-pointer"
                  style={{ background: formTab === t ? '#3b82f6' : '#d1d5db' }}
                  onClick={() => setFormTab(t)}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setShowForm(false); setEditing(null) }}
                className="px-3 py-1.5 rounded-lg text-xs"
                style={{ background: '#ffffff', border: '1px solid #e5e7eb', color: '#6b7280' }}
              >
                취소
              </button>
              {formTab === 'condition' ? (
                <button
                  onClick={() => setFormTab('filter')}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#2563eb' }}
                >
                  다음: 필터 →
                </button>
              ) : (
                <button
                  onClick={handleSave}
                  className="px-4 py-1.5 rounded-lg text-xs font-medium"
                  style={{ background: '#3b82f6', color: '#fff', boxShadow: '0 1px 3px rgba(59,130,246,0.3)' }}
                >
                  저장
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab bar row: list tabs (left) + view toggle (right) */}
      <div className="flex items-center justify-between">
        {/* 전체/활성/비활성 — only shown in list view */}
        {viewMode === 'list' ? (
          <div className="flex gap-1 p-1 rounded-lg" style={{ background: '#f3f4f6', border: '1px solid #e5e7eb' }}>
            {([
              { key: 'all',      label: '전체' },
              { key: 'active',   label: '활성' },
              { key: 'inactive', label: '비활성' },
            ] as const).map(t => (
              <button
                key={t.key}
                onClick={() => setListTab(t.key)}
                className="text-xs px-3 py-1.5 rounded-md font-medium transition-all duration-150 flex items-center gap-1.5"
                style={listTab === t.key ? {
                  background: '#ffffff',
                  color: '#111827',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                } : {
                  color: '#9ca3af',
                }}
              >
                {t.label}
                <span
                  className="text-xs px-1.5 py-0.5 rounded-full"
                  style={listTab === t.key ? {
                    background: '#f3f4f6',
                    color: '#6b7280',
                  } : {
                    background: 'transparent',
                    color: '#c4c9d4',
                  }}
                >
                  {listTabCounts[t.key]}
                </span>
              </button>
            ))}
          </div>
        ) : (
          /* placeholder to keep flex justify-between alignment */
          <div />
        )}

        {/* View mode toggle: 목록 | 그룹 */}
        <div
          className="flex gap-0.5 p-0.5 rounded-lg"
          style={{ background: '#f3f4f6', border: '1px solid #e5e7eb' }}
        >
          {([
            { key: 'list',  label: '목록' },
            { key: 'group', label: '그룹' },
          ] as const).map(v => (
            <button
              key={v.key}
              onClick={() => setViewMode(v.key)}
              className="text-xs px-3 py-1.5 rounded-md font-medium transition-all duration-150"
              style={viewMode === v.key ? {
                background: '#ffffff',
                color: '#111827',
                boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
              } : {
                color: '#9ca3af',
              }}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── List view ── */}
      {viewMode === 'list' && (
        <div
          className="rounded-xl overflow-hidden"
          style={{ background: '#ffffff', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
        >
          {filteredRules.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="text-sm" style={{ color: '#9ca3af' }}>
                {listTab === 'all' ? '등록된 규칙이 없습니다' : `${listTab === 'active' ? '활성' : '비활성'} 규칙이 없습니다`}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
                    {['규칙명', '범위', '상품필터', '조건', '액션', '심각도', '시간대', '상태', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium" style={{ color: '#6b7280' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRules.map((r, i) => {
                    const sev = SEVERITY_STYLE[r.severity]
                    return (
                      <tr
                        key={r.id}
                        className="transition-colors duration-150 hover:bg-gray-50"
                        style={{
                          borderBottom: i < filteredRules.length - 1 ? '1px solid #f3f4f6' : 'none',
                          opacity: r.is_active ? 1 : 0.45,
                        }}
                      >
                        <td className="px-4 py-3 font-medium" style={{ color: '#111827' }}>
                          <div className="flex items-center gap-1.5">
                            {r.is_midnight_rule && (
                              <span
                                className="text-xs px-1.5 py-0.5 rounded font-medium shrink-0"
                                style={{ background: '#eef2ff', border: '1px solid #c7d2fe', color: '#6366f1' }}
                              >
                                00시
                              </span>
                            )}
                            {r.name}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#f3f4f6', color: '#6b7280' }}>
                            {r.scope ?? 'campaign'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: '#6b7280' }}>
                          {r.product_filter ?? <span style={{ color: '#9ca3af' }}>전체</span>}
                        </td>
                        <td className="px-4 py-3 text-xs font-mono" style={{ color: '#374151' }}>
                          {r.threshold_type === 'product_cpa'
                            ? `${r.metric} ${r.operator} 목표×${r.threshold_multiplier}`
                            : `${r.metric} ${r.operator} ${r.threshold}`}
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: '#374151' }}>{r.action}</td>
                        <td className="px-4 py-3">
                          {sev ? (
                            <span
                              className="text-xs px-2 py-0.5 rounded-full font-medium"
                              style={{ background: sev.bg, border: `1px solid ${sev.border}`, color: sev.color }}
                            >
                              {r.severity}
                            </span>
                          ) : (
                            <span className="text-xs" style={{ color: '#6b7280' }}>{r.severity}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: '#6b7280' }}>
                          {r.time_start != null && r.time_end != null
                            ? `${r.time_start}~${r.time_end}시`
                            : <span style={{ color: '#9ca3af' }}>전체</span>}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleToggle(r.id, r.is_active)}
                            className="text-xs px-2.5 py-1 rounded-md font-medium transition-all duration-150"
                            style={r.is_active ? {
                              background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a',
                            } : {
                              background: '#f3f4f6', border: '1px solid #e5e7eb', color: '#9ca3af',
                            }}
                          >
                            {r.is_active ? '활성' : '비활성'}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-3">
                            <button onClick={() => startEdit(r)} className="text-xs" style={{ color: '#3b82f6' }}>수정</button>
                            <button onClick={() => handleDelete(r.id)} className="text-xs" style={{ color: '#dc2626' }}>삭제</button>
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
      )}

      {/* ── Group view ── */}
      {viewMode === 'group' && (
        <div className="space-y-4">
          {activeRules.length === 0 ? (
            <div
              className="rounded-xl px-6 py-16 text-center"
              style={{ background: '#ffffff', border: '1px solid #e5e7eb' }}
            >
              <p className="text-sm" style={{ color: '#9ca3af' }}>활성화된 규칙이 없습니다</p>
            </div>
          ) : (
            TIME_GROUPS.map(tg => {
              const groupRules = activeRules.filter(tg.filter)
              if (groupRules.length === 0) return null
              return (
                <GroupCard
                  key={tg.label}
                  label={tg.label}
                  icon={tg.icon}
                  rules={groupRules}
                  onEdit={startEdit}
                />
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
