import { createClient } from '@/lib/supabase/client'
import { evaluate, calcProposedBudget, type Operator } from './evaluators'
import { sendSlackAlert } from '@/lib/notifications/slack'
import type { CampaignsSnapshot, AutomationRule, ProductTargetCpa } from '@/lib/supabase/types'

function getKstHour(): number {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' })).getHours()
}

function isMidnightRun(kstHour: number): boolean {
  return kstHour === 0
}

function isRuleApplicable(
  rule: AutomationRule,
  kstHour: number,
  midnightRun: boolean
): boolean {
  if (midnightRun) return !!rule.is_midnight_rule
  if (rule.is_midnight_rule) return false
  if (rule.time_start == null || rule.time_end == null) return true
  return kstHour >= rule.time_start && kstHour < rule.time_end
}

function getProductTargetCpa(
  campaignName: string,
  productCpas: ProductTargetCpa[]
): number | null {
  const name = campaignName.toLowerCase()
  for (const p of productCpas) {
    if (name.includes(p.product_name.toLowerCase())) return p.target_cpa
  }
  return null
}

function getEffectiveThreshold(rule: AutomationRule, productTargetCpa: number | null): number {
  if (
    rule.threshold_type === 'product_cpa' &&
    productTargetCpa != null &&
    rule.threshold_multiplier != null
  ) {
    return productTargetCpa * rule.threshold_multiplier
  }
  return rule.threshold
}

export async function runRuleEngine() {
  const supabase = createClient()
  const kstHour = getKstHour()
  const midnightRun = isMidnightRun(kstHour)

  const [snapshotsRes, rulesRes, productCpasRes] = await Promise.all([
    supabase
      .from('campaigns_snapshot')
      .select('*')
      .order('captured_at', { ascending: false })
      .limit(200),
    supabase.from('automation_rules').select('*').eq('is_active', true),
    supabase.from('product_target_cpas').select('*').eq('is_active', true),
  ])

  if (snapshotsRes.error) throw snapshotsRes.error
  if (rulesRes.error) throw rulesRes.error

  const snapshots = snapshotsRes.data ?? []
  const rules = rulesRes.data ?? []
  const productCpas = (productCpasRes.data ?? []) as ProductTargetCpa[]

  if (!snapshots.length || !rules.length) return { evaluated: 0, queued: 0, kstHour, midnightRun }

  // 캠페인별 최신 스냅샷만 유지
  const latestByAdset = new Map<string, CampaignsSnapshot>()
  for (const s of snapshots) {
    const key = s.adset_id ?? s.campaign_id
    if (!latestByAdset.has(key)) latestByAdset.set(key, s)
  }

  // 현재 시간대에 해당하는 규칙만 필터링
  const applicableRules = rules.filter(r => isRuleApplicable(r, kstHour, midnightRun))
  if (!applicableRules.length) return { evaluated: latestByAdset.size, queued: 0, kstHour, midnightRun }

  const queueItems = []

  for (const snapshot of latestByAdset.values()) {
    const productTargetCpa = getProductTargetCpa(snapshot.campaign_name ?? '', productCpas)

    for (const rule of applicableRules) {
      const metricValue = snapshot[rule.metric as keyof CampaignsSnapshot] as number | null
      if (metricValue == null) continue

      const effectiveThreshold = getEffectiveThreshold(rule, productTargetCpa)
      if (!evaluate(metricValue, rule.operator as Operator, effectiveThreshold)) continue

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
          threshold: effectiveThreshold,
          product_target_cpa: productTargetCpa,
          reason: `[${rule.name}] ${rule.metric} ${metricValue} ${rule.operator} ${effectiveThreshold}${productTargetCpa ? ` (상품 목표 CPA: ${productTargetCpa}원)` : ''}`,
          proposed_budget: proposedBudget,
          is_midnight_rule: !!rule.is_midnight_rule,
        },
        // 모든 액션은 자동 실행 없이 pending
        status: 'pending',
      })
    }
  }

  if (queueItems.length > 0) {
    const { data: inserted, error } = await supabase
      .from('action_queue')
      .insert(queueItems)
      .select()
    if (error) throw error

    // 삽입된 항목마다 Slack 알림 발송
    for (const item of inserted ?? []) {
      await sendSlackAlert(item as any).catch(() => {})
    }
  }

  return { evaluated: latestByAdset.size, queued: queueItems.length, kstHour, midnightRun }
}
