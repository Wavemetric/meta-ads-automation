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

const SEVERITY_STYLE: Record<string, string> = {
  high:   'bg-red-500/20 text-red-400',
  medium: 'bg-yellow-500/20 text-yellow-400',
  low:    'bg-green-500/20 text-green-400',
}

const EMPTY: Omit<AutomationRule, 'id' | 'created_at' | 'updated_at'> = {
  name: '', description: '', metric: 'cpa', operator: 'gt',
  threshold: 0, action: 'decrease_budget', action_value: null,
  severity: 'medium', scope: 'campaign', is_active: true,
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
    setForm({
      name: rule.name, description: rule.description ?? '', metric: rule.metric,
      operator: rule.operator, threshold: rule.threshold, action: rule.action,
      action_value: rule.action_value, severity: rule.severity,
      scope: rule.scope, is_active: rule.is_active,
    })
    setShowForm(true)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">자동화 규칙 관리</h1>
        <button
          onClick={() => { setShowForm(true); setEditing(null); setForm(EMPTY) }}
          className="text-sm px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
        >
          + 규칙 추가
        </button>
      </div>

      {/* 폼 */}
      {showForm && (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-200">{editing ? '규칙 수정' : '새 규칙'}</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-xs text-gray-400">규칙 이름</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                className="w-full mt-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="text-xs text-gray-400">지표</label>
              <select value={form.metric} onChange={e => setForm(p => ({ ...p, metric: e.target.value }))}
                className="w-full mt-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white">
                {METRICS.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400">조건</label>
              <select value={form.operator} onChange={e => setForm(p => ({ ...p, operator: e.target.value }))}
                className="w-full mt-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white">
                {OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400">임계값</label>
              <input type="number" value={form.threshold}
                onChange={e => setForm(p => ({ ...p, threshold: parseFloat(e.target.value) || 0 }))}
                className="w-full mt-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white" />
            </div>
            <div>
              <label className="text-xs text-gray-400">액션</label>
              <select value={form.action} onChange={e => setForm(p => ({ ...p, action: e.target.value }))}
                className="w-full mt-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white">
                {ACTIONS.map(a => <option key={a}>{a}</option>)}
              </select>
            </div>
            {form.action.includes('budget') && (
              <div>
                <label className="text-xs text-gray-400">조정 비율 (예: 0.1 = 10%)</label>
                <input type="number" step="0.01" value={form.action_value ?? ''}
                  onChange={e => setForm(p => ({ ...p, action_value: parseFloat(e.target.value) || null }))}
                  className="w-full mt-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white" />
              </div>
            )}
            <div>
              <label className="text-xs text-gray-400">심각도</label>
              <select value={form.severity} onChange={e => setForm(p => ({ ...p, severity: e.target.value }))}
                className="w-full mt-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white">
                {SEVERITIES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={handleSave}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md transition-colors">
              저장
            </button>
            <button onClick={() => { setShowForm(false); setEditing(null) }}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-md transition-colors">
              취소
            </button>
          </div>
        </div>
      )}

      {/* 규칙 목록 */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        {rules.length === 0 ? (
          <p className="px-5 py-8 text-sm text-gray-500 text-center">등록된 규칙이 없습니다</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-800">
                {['규칙명', '조건', '액션', '심각도', '상태', ''].map(h => (
                  <th key={h} className="px-4 py-2 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {rules.map(r => (
                <tr key={r.id} className={`hover:bg-gray-800/50 ${!r.is_active ? 'opacity-40' : ''}`}>
                  <td className="px-4 py-3 text-gray-200">{r.name}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {r.metric} {r.operator} {r.threshold}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{r.action}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${SEVERITY_STYLE[r.severity] ?? ''}`}>
                      {r.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleToggle(r.id, r.is_active)}
                      className={`text-xs px-2 py-0.5 rounded ${r.is_active ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-gray-500'}`}>
                      {r.is_active ? '활성' : '비활성'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => startEdit(r)} className="text-xs text-blue-400 hover:underline">수정</button>
                      <button onClick={() => handleDelete(r.id)} className="text-xs text-red-400 hover:underline">삭제</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
