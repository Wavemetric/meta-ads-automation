const META_BASE = 'https://graph.facebook.com/v21.0'

export type MetaInsight = {
  account_id: string
  campaign_id: string
  campaign_name: string
  adset_id: string
  adset_name: string
  spend: string
  impressions: string
  clicks: string
  ctr: string
  cpm: string
  actions?: Array<{ action_type: string; value: string }>
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
    'purchase_roas', 'actions',
  ].join(',')

  const url = new URL(`${META_BASE}/${accountId}/insights`)
  url.searchParams.set('fields', fields)
  url.searchParams.set('date_preset', datePreset)
  url.searchParams.set('level', 'adset')
  url.searchParams.set('access_token', getToken())

  const data = await metaRequest(url.toString())
  return (data.data ?? []) as MetaInsight[]
}

export type AdsetMeta = {
  adset_id: string
  daily_budget: number | null      // 원(KRW) 단위. 광고세트 자체 예산이 없으면 null
  adset_status: string | null      // 광고세트 effective_status (ACTIVE / PAUSED / ...)
  campaign_id: string
  campaign_status: string | null   // 캠페인 effective_status
  campaign_daily_budget: number | null
}

// 계정의 모든 광고세트 메타(예산/상태) 조회 — insights 엔드포인트에는 없는 정보
export async function fetchAdsetMeta(accountId: string): Promise<AdsetMeta[]> {
  const fields = [
    'id',
    'daily_budget',
    'effective_status',
    'campaign{id,effective_status,daily_budget}',
  ].join(',')

  const url = new URL(`${META_BASE}/${accountId}/adsets`)
  url.searchParams.set('fields', fields)
  url.searchParams.set('limit', '500')
  url.searchParams.set('access_token', getToken())

  const data = await metaRequest(url.toString())
  // daily_budget은 센트 단위로 반환되므로 KRW로 환산 (× 0.01)
  const toKrw = (v: unknown) => {
    if (v == null || v === '') return null
    const n = typeof v === 'string' ? parseFloat(v) : Number(v)
    return Number.isFinite(n) ? n / 100 : null
  }
  return (data.data ?? []).map((a: any): AdsetMeta => ({
    adset_id: a.id,
    daily_budget: toKrw(a.daily_budget),
    adset_status: a.effective_status ?? null,
    campaign_id: a.campaign?.id ?? '',
    campaign_status: a.campaign?.effective_status ?? null,
    campaign_daily_budget: toKrw(a.campaign?.daily_budget),
  }))
}

// META_AD_ACCOUNT_IDS 환경변수 계정들의 인사이트 수집 (account_id 태그 포함)
export async function fetchAllAccountInsights(datePreset = 'today'): Promise<MetaInsight[]> {
  const accountIds = (process.env.META_AD_ACCOUNT_IDS ?? '')
    .split(',').map(s => s.trim()).filter(Boolean)

  const results = await Promise.allSettled(
    accountIds.map(id => fetchCampaignInsights(id, datePreset))
  )

  const insights: MetaInsight[] = []
  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    if (result.status === 'fulfilled') {
      insights.push(...result.value.map(insight => ({ ...insight, account_id: accountIds[i] })))
    }
  }
  return insights
}

// 모든 광고계정의 광고세트 메타(예산/상태) 일괄 조회
export async function fetchAllAdsetMeta(): Promise<AdsetMeta[]> {
  const accountIds = (process.env.META_AD_ACCOUNT_IDS ?? '')
    .split(',').map(s => s.trim()).filter(Boolean)

  const results = await Promise.allSettled(accountIds.map(id => fetchAdsetMeta(id)))
  const out: AdsetMeta[] = []
  for (const r of results) {
    if (r.status === 'fulfilled') out.push(...r.value)
  }
  return out
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
