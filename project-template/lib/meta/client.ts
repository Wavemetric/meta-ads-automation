const META_BASE = 'https://graph.facebook.com/v21.0'

// wavemetric-automation의 기존 광고 계정 ID
export const AD_ACCOUNTS = {
  마미케어_통합: 'act_525467572586537',
  mommycare_kr: 'act_1394935021888163',
  성분에디터_올리브: 'act_713172176082442',
}

export type MetaInsight = {
  campaign_id: string
  campaign_name: string
  adset_id: string
  adset_name: string
  spend: string
  impressions: string
  clicks: string
  ctr: string
  cpm: string
  conversions?: Array<{ action_type: string; value: string }>
  purchase_roas?: Array<{ action_type: string; value: string }>
  revenue?: string
}

function getToken() {
  const token = process.env.META_ACCESS_TOKEN
  if (!token) throw new Error('META_ACCESS_TOKEN is not set')
  return token
}

async function metaRequest(url: string, init?: RequestInit) {
  const res = await fetch(url, { ...init, next: { revalidate: 0 } })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Meta API ${res.status}: ${body}`)
  }
  return res.json()
}

// 광고 계정별 성과 인사이트 조회
export async function fetchCampaignInsights(
  accountId: string,
  datePreset = 'today'
): Promise<MetaInsight[]> {
  const fields = [
    'campaign_id', 'campaign_name', 'adset_id', 'adset_name',
    'spend', 'impressions', 'clicks', 'ctr', 'cpm',
    'purchase_roas', 'conversions',
  ].join(',')

  const url = new URL(`${META_BASE}/${accountId}/insights`)
  url.searchParams.set('fields', fields)
  url.searchParams.set('date_preset', datePreset)
  url.searchParams.set('level', 'adset')
  url.searchParams.set('access_token', getToken())

  const data = await metaRequest(url.toString())
  return (data.data ?? []) as MetaInsight[]
}

// 모든 광고 계정 인사이트 통합 수집
// META_AD_ACCOUNT_IDS 환경변수 우선 사용 (쉼표 구분), 없으면 AD_ACCOUNTS 폴백
export async function fetchAllAccountInsights(datePreset = 'today'): Promise<MetaInsight[]> {
  const envIds = process.env.META_AD_ACCOUNT_IDS
  const accountIds = envIds
    ? envIds.split(',').map(s => s.trim()).filter(Boolean)
    : Object.values(AD_ACCOUNTS)
  const results = await Promise.allSettled(
    accountIds.map(id => fetchCampaignInsights(id, datePreset))
  )

  const insights: MetaInsight[] = []
  for (const result of results) {
    if (result.status === 'fulfilled') {
      insights.push(...result.value)
    }
  }
  return insights
}

// 캠페인 일 예산 수정
export async function updateCampaignBudget(campaignId: string, dailyBudgetKrw: number) {
  const url = `${META_BASE}/${campaignId}`
  const body = new URLSearchParams({
    daily_budget: String(Math.round(dailyBudgetKrw * 100)), // 센트 단위
    access_token: getToken(),
  })
  return metaRequest(url, { method: 'POST', body })
}

// 캠페인 상태 변경
export async function setCampaignStatus(campaignId: string, status: 'ACTIVE' | 'PAUSED') {
  const url = `${META_BASE}/${campaignId}`
  const body = new URLSearchParams({ status, access_token: getToken() })
  return metaRequest(url, { method: 'POST', body })
}

// 광고 세트 예산 수정
export async function updateAdsetBudget(adsetId: string, dailyBudgetKrw: number) {
  const url = `${META_BASE}/${adsetId}`
  const body = new URLSearchParams({
    daily_budget: String(Math.round(dailyBudgetKrw * 100)),
    access_token: getToken(),
  })
  return metaRequest(url, { method: 'POST', body })
}
