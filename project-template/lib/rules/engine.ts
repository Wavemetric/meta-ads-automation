import { createClient } from '@/lib/supabase/client'
import { evaluate, calcProposedBudget, type Operator } from './evaluators'
import { sendSlackSummary } from '@/lib/notifications/slack'
import type {
  CampaignsSnapshot,
  AutomationRule,
  ProductTargetCpa,
  PromotionTargetCpa,
} from '@/lib/supabase/types'

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

type ResolvedTargetCpa = {
  value: number
  source: 'promotion' | 'product'
  matchedName: string
} | null

// 캠페인명에서 프로모션이 먼저 매칭되면 그걸 쓰고, 없으면 상품 매칭
function resolveTargetCpa(
  campaignName: string,
  promotionCpas: PromotionTargetCpa[],
  productCpas: ProductTargetCpa[]
): ResolvedTargetCpa {
  const name = campaignName.toLowerCase()
  for (const p of promotionCpas) {
    if (name.includes(p.promotion_name.toLowerCase())) {
      return { value: p.target_cpa, source: 'promotion', matchedName: p.promotion_name }
    }
  }
  for (const p of productCpas) {
    if (name.includes(p.product_name.toLowerCase())) {
      return { value: p.target_cpa, source: 'product', matchedName: p.product_name }
    }
  }
  return null
}

function getEffectiveThreshold(rule: AutomationRule, targetCpa: number | null): number {
  if (
    rule.threshold_type === 'product_cpa' &&
    targetCpa != null &&
    rule.threshold_multiplier != null
  ) {
    return targetCpa * rule.threshold_multiplier
  }
  return rule.threshold
}

export async function runRuleEngine() {
  const supabase = createClient()
  const kstHour = getKstHour()
  const midnightRun = isMidnightRun(kstHour)

  const [snapshotsRes, rulesRes, productCpasRes, promotionCpasRes] = await Promise.all([
    supabase
      .from('campaigns_snapshot')
      .select('*')
      .order('captured_at', { ascending: false })
      .limit(200),
    supabase.from('automation_rules').select('*').eq('is_active', true),
    supabase.from('product_target_cpas').select('*').eq('is_active', true),
    supabase.from('promotion_target_cpas').select('*').eq('is_active', true),
  ])

  if (snapshotsRes.error) throw snapshotsRes.error
  if (rulesRes.error) throw rulesRes.error

  const snapshots = snapshotsRes.data ?? []
  const rules = rulesRes.data ?? []
  const productCpas = (productCpasRes.data ?? []) as ProductTargetCpa[]
  const promotionCpas = (promotionCpasRes.data ?? []) as PromotionTargetCpa[]

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
    // 프로모션 우선, 없으면 상품 매칭
    const resolved = resolveTargetCpa(snapshot.campaign_name ?? '', promotionCpas, productCpas)
    const targetCpa = resolved?.value ?? null

    for (const rule of applicableRules) {
      const metricValue = snapshot[rule.metric as keyof CampaignsSnapshot] as number | null
      if (metricValue == null) continue

      const effectiveThreshold = getEffectiveThreshold(rule, targetCpa)
      if (!evaluate(metricValue, rule.operator as Operator, effectiveThreshold)) continue

      // 동일 규칙 + 캠페인의 기존 pending 삭제 후 최신 내용으로 교체
      await supabase
        .from('action_queue')
        .delete()
        .eq('rule_id', rule.id)
        .eq('campaign_id', snapshot.campaign_id)
        .eq('status', 'pending')

      // 현상유지 액션은 실제 조치가 없으므로 큐에 넣지 않음
      if (rule.action === 'set_budget_current') continue

      // 현재 예산을 알면 그걸 기준, 모르면 spend로 fallback
      const baseBudget = snapshot.daily_budget ?? snapshot.spend
      const proposedBudget = calcProposedBudget(baseBudget, rule.action, rule.action_value)
      // 광고세트 상태가 있으면 광고세트, 없으면 캠페인 상태
      const currentStatus = snapshot.adset_status ?? snapshot.campaign_status ?? null

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
          product_target_cpa: targetCpa,
          target_cpa_source: resolved?.source ?? null,
          target_cpa_matched_name: resolved?.matchedName ?? null,
          reason: `[${rule.name}] ${rule.metric} ${metricValue} ${rule.operator} ${effectiveThreshold}${
            resolved
              ? ` (${resolved.source === 'promotion' ? '프로모션' : '상품'} 목표 CPA: ${resolved.value}원 / ${resolved.matchedName})`
              : ''
          }`,
          proposed_budget: proposedBudget,
          current_budget: snapshot.daily_budget,
          current_status: currentStatus,
          is_midnight_rule: !!rule.is_midnight_rule,
          adset_id: snapshot.adset_id,
          adset_name: snapshot.adset_name,
          rule_name: rule.name,
          rule_description: rule.description,
        },
        // 모든 액션은 자동 실행 없이 pending
        status: 'pending',
      })
    }
  }

  if (queueItems.length > 0) {
    const { error } = await supabase.from('action_queue').insert(queueItems)
    if (error) throw error
  }

  // 새 항목 유무와 관계없이 현재 pending 전체를 Slack에 요약 발송
  const { data: allPending } = await supabase
    .from('action_queue')
    .select('*')
    .eq('status', 'pending')
    .order('severity', { ascending: true }) // high → medium → low
    .limit(50)

  // 프로모션/상품 담당자 정보를 Slack 멘션용으로 전달 (slack_user_id가 있는 항목만)
  const handlers = [
    ...promotionCpas
      .filter(p => p.slack_user_id)
      .map(p => ({ name: p.promotion_name, slack_user_id: p.slack_user_id, kind: 'promotion' as const })),
    ...productCpas
      .filter(p => p.slack_user_id)
      .map(p => ({ name: p.product_name, slack_user_id: p.slack_user_id, kind: 'product' as const })),
  ]

  await sendSlackSummary((allPending ?? []) as any[], handlers).catch(() => {})

  return { evaluated: latestByAdset.size, queued: queueItems.length, kstHour, midnightRun }
}
