import { updateCampaignBudget, updateAdsetBudget, setCampaignStatus } from './client'
import type { ProposedChange } from '@/lib/supabase/types'

export async function executeAction(
  campaignId: string,
  change: ProposedChange
): Promise<{ result: 'success' | 'failed'; response?: unknown; error?: string }> {
  try {
    let response: unknown
    const { action, proposed_budget } = change

    if (action === 'pause') {
      response = await setCampaignStatus(campaignId, 'PAUSED')
    } else if (action === 'resume') {
      response = await setCampaignStatus(campaignId, 'ACTIVE')
    } else if (action === 'decrease_budget' || action === 'increase_budget') {
      if (!proposed_budget) throw new Error('proposed_budget is required for budget actions')
      response = await updateCampaignBudget(campaignId, proposed_budget)
    } else if (action === 'replace_creative') {
      // 소재 교체는 수동 확인 필요 — 로그만 남김
      response = { message: 'replace_creative requires manual review' }
    } else {
      throw new Error(`Unknown action: ${action}`)
    }

    return { result: 'success', response }
  } catch (e) {
    return {
      result: 'failed',
      error: e instanceof Error ? e.message : String(e),
    }
  }
}
