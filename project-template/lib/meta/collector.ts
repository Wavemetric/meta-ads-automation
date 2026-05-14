import type { MetaInsight, AdsetMeta } from './client'
import type { Database } from '@/lib/supabase/types'

type SnapshotInsert = Database['public']['Tables']['campaigns_snapshot']['Insert']

export function normalizeInsight(i: MetaInsight, meta?: AdsetMeta): SnapshotInsert {
  const spend = parseFloat(i.spend) || 0
  const impressions = parseInt(i.impressions) || 0
  const clicks = parseInt(i.clicks) || 0
  const purchaseAction = i.actions?.find(
    c => c.action_type === 'purchase' ||
         c.action_type === 'offsite_conversion.fb_pixel_purchase' ||
         c.action_type === 'omni_purchase'
  )
  const conversions = purchaseAction ? parseInt(purchaseAction.value) : 0

  const roas = i.purchase_roas?.[0]?.value ? parseFloat(i.purchase_roas[0].value) : 0
  const revenue = roas * spend
  const cpa = conversions > 0 ? spend / conversions : null
  const ctr = parseFloat(i.ctr) || null

  // 광고세트 자체 예산이 있으면 그걸 쓰고, 없으면 캠페인 예산(CBO) 사용
  const dailyBudget = meta?.daily_budget ?? meta?.campaign_daily_budget ?? null

  return {
    account_id: i.account_id,
    campaign_id: i.campaign_id,
    campaign_name: i.campaign_name,
    adset_id: i.adset_id,
    adset_name: i.adset_name,
    spend,
    impressions,
    clicks,
    conversions,
    cpa,
    ctr,
    roas,
    revenue,
    daily_budget: dailyBudget,
    adset_status: meta?.adset_status ?? null,
    campaign_status: meta?.campaign_status ?? null,
  }
}

// adset_id → AdsetMeta 매핑
export function indexAdsetMeta(metas: AdsetMeta[]): Map<string, AdsetMeta> {
  const m = new Map<string, AdsetMeta>()
  for (const meta of metas) m.set(meta.adset_id, meta)
  return m
}
