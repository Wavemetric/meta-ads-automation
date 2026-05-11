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
  }
}

export async function sendSlackAlert(item: ActionQueueItem) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL
  if (!webhookUrl) return

  const dashboardUrl = process.env.NEXT_PUBLIC_DASHBOARD_URL ?? ''
  const emoji = item.severity === 'high' ? '🚨' : '⚠️'
  const color = item.severity === 'high' ? '#E53E3E' : '#D69E2E'

  const message = {
    text: `${emoji} *메타 광고 자동화 알림*`,
    attachments: [
      {
        color,
        fields: [
          { title: '캠페인', value: item.campaign_name ?? '(알 수 없음)', short: true },
          { title: '심각도', value: item.severity.toUpperCase(), short: true },
          { title: '감지 내용', value: item.proposed_change.reason, short: false },
          { title: '제안 액션', value: item.proposed_change.action, short: true },
        ],
        actions: [{ type: 'button', text: '대시보드에서 확인', url: `${dashboardUrl}/dashboard/queue/${item.id}`, style: 'primary' }],
      },
    ],
  }

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message),
  })
}
