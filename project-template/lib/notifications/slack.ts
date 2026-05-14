interface ActionQueueItem {
  id: string
  campaign_name: string | null
  severity: string
  proposed_change: {
    action: string
    metric: string
    current_value: number
    threshold: number
    reason: string
    proposed_budget?: number | null
    adset_name?: string | null
  }
}

type HandlerSource = { name: string; slack_user_id: string | null; kind: 'promotion' | 'product' }

// 캠페인명 → 멘션할 Slack 유저들 (프로모션 우선)
function getMentionsForCampaign(
  campaignName: string | null,
  handlers: HandlerSource[]
): string[] {
  if (!campaignName) return []
  const name = campaignName.toLowerCase()
  // 프로모션 매칭이 하나라도 있으면 프로모션만 사용, 없으면 상품 매칭
  const promoMatches = handlers.filter(h => h.kind === 'promotion' && h.slack_user_id && name.includes(h.name.toLowerCase()))
  if (promoMatches.length > 0) return Array.from(new Set(promoMatches.map(h => h.slack_user_id!).filter(Boolean)))
  const productMatches = handlers.filter(h => h.kind === 'product' && h.slack_user_id && name.includes(h.name.toLowerCase()))
  return Array.from(new Set(productMatches.map(h => h.slack_user_id!).filter(Boolean)))
}

export async function sendSlackSummary(items: ActionQueueItem[], handlers: HandlerSource[] = []) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL
  if (!webhookUrl || items.length === 0) return

  const dashboardUrl = process.env.NEXT_PUBLIC_DASHBOARD_URL ?? ''

  const highCount = items.filter(i => i.severity === 'high').length
  const mediumCount = items.filter(i => i.severity === 'medium').length
  const lowCount = items.filter(i => i.severity === 'low').length

  const topSeverity = highCount > 0 ? 'high' : mediumCount > 0 ? 'medium' : 'low'
  const emoji = topSeverity === 'high' ? '🚨' : '⚠️'
  const color = topSeverity === 'high' ? '#E53E3E' : '#D69E2E'

  // 심각도 높은 순으로 최대 10개만 표시
  const severityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 }
  const sorted = [...items].sort((a, b) => (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3))
  const preview = sorted.slice(0, 10)
  const rest = items.length - preview.length

  const lines = preview.map(item => {
    const name = item.proposed_change.adset_name ?? item.campaign_name ?? '(알 수 없음)'
    const sevLabel = item.severity === 'high' ? '🔴' : item.severity === 'medium' ? '🟡' : '🟢'
    const mentions = getMentionsForCampaign(item.campaign_name, handlers)
      .map(id => `<@${id}>`).join(' ')
    const mentionPrefix = mentions ? `${mentions} ` : ''
    return `${sevLabel} ${mentionPrefix}*${name}* — ${item.proposed_change.action} (${item.proposed_change.metric}: ${Math.round(item.proposed_change.current_value).toLocaleString('ko-KR')})`
  })

  if (rest > 0) lines.push(`_외 ${rest}건 더 있음_`)

  const severitySummary = [
    highCount > 0 ? `🔴 HIGH ${highCount}건` : '',
    mediumCount > 0 ? `🟡 MEDIUM ${mediumCount}건` : '',
    lowCount > 0 ? `🟢 LOW ${lowCount}건` : '',
  ].filter(Boolean).join('  |  ')

  const message = {
    text: `${emoji} *메타 광고 자동화 — 총 ${items.length}건 감지*`,
    attachments: [
      {
        color,
        fields: [
          { title: '심각도 요약', value: severitySummary, short: false },
          { title: '감지 항목', value: lines.join('\n'), short: false },
        ],
        actions: [
          { type: 'button', text: '대시보드에서 확인', url: `${dashboardUrl}/dashboard/queue`, style: 'primary' },
        ],
        footer: `${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} 기준`,
      },
    ],
  }

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message),
  })
}
