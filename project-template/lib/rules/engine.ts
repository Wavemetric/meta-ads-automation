import { createClient } from '@/lib/supabase/client'
import { evaluate, calcProposedBudget, type Operator } from './evaluators'
import type { CampaignsSnapshot, AutomationRule } from '@/lib/supabase/types'

export async function runRuleEngine() {
  const supabase = createClient()

  // 최신 스냅샷 (캠페인별 가장 최근 200건)
  const { data: snapshots, error: snapErr } = await supabase
    .from('campaigns_snapshot')
    .select('*')
    .order('captured_at', { ascending: false })
    .limit(200)

  if (snapErr) throw snapErr

  const { data: rules, error: ruleErr } = await supabase
    .from('automation_rules')
    .select('*')
    .eq('is_active', true)

  if (ruleErr) throw ruleErr
  if (!snapshots?.length || !rules?.length) return { evaluated: 0, queued: 0 }

  // adset별 중복 제거 (가장 최근 스냅샷만)
  const latestByAdset = new Map<string, CampaignsSnapshot>()
  for (const s of snapshots) {
    const key = s.adset_id ?? s.campaign_id
    if (!latestByAdset.has(key)) latestByAdset.set(key, s)
  }

  const queueItems = []

  for (const snapshot of latestByAdset.values()) {
    for (const rule of rules as AutomationRule[]) {
      const metricValue = snapshot[rule.metric as keyof CampaignsSnapshot] as number | null
      if (metricValue == null) continue
      if (!evaluate(metricValue, rule.operator as Operator, rule.threshold)) continue

      // 동일 규칙 + 캠페인이 이미 pending이면 중복 방지
      const { count } = await supabase
        .from('action_queue')
        .select('id', { count: 'exact', head: true })
        .eq('rule_id', rule.id)
        .eq('campaign_id', snapshot.campaign_id)
        .eq('status', 'pending')

      if ((count ?? 0) > 0) continue

      const proposedBudget = calcProposedBudget(snapshot.spend, rule.action, rule.action_value)

      queueItems.push({
        rule_id: rule.id,
        campaign_id: snapshot.campaign_id,
        campaign_name: snapshot.campaign_name,
        severity: rule.severity,
        proposed_change: {
          action: rule.action,
          metric: rule.metric,
          current_value: metricValue,
          threshold: rule.threshold,
          reason: `${rule.metric} ${metricValue} ${rule.operator} ${rule.threshold} (규칙: ${rule.name})`,
          proposed_budget: proposedBudget,
        },
        // low는 바로 approved → execute Cron이 즉시 실행
        status: rule.severity === 'low' ? 'approved' : 'pending',
      })
    }
  }

  if (queueItems.length > 0) {
    const { error } = await supabase.from('action_queue').insert(queueItems)
    if (error) throw error
  }

  return { evaluated: latestByAdset.size, queued: queueItems.length }
}
