import type { MetaInsight } from './client'
import type { Database } from '@/lib/supabase/types'

type SnapshotInsert = Database['public']['Tables']['campaigns_snapshot']['Insert']

export function normalizeInsight(i: MetaInsight): SnapshotInsert {
  const spend = parseFloat(i.spend) || 0
  const impressions = parseInt(i.impressions) || 0
  const clicks = parseInt(i.clicks) || 0
  const conversions = i.conversions?.find(c => c.action_type === 'purchase')
    ? parseInt(i.conversions.find(c => c.action_type === 'purchase')!.value)
    : (i.conversions?.[0]?.value ? parseInt(i.conversions[0].value) : 0)

  const roas = i.purchase_roas?.[0]?.value ? parseFloat(i.purchase_roas[0].value) : 0
  const revenue = roas * spend
  const cpa = conversions > 0 ? spend / conversions : null
  const ctr = parseFloat(i.ctr) || null

  return {
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
  }
}
