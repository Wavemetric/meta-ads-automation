// Supabase Edge Function — Deno runtime
// 배포: supabase functions deploy notify-slack

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const webhookUrl = Deno.env.get('SLACK_WEBHOOK_URL')
  const dashboardUrl = Deno.env.get('DASHBOARD_URL') ?? ''

  if (!webhookUrl) {
    return new Response('SLACK_WEBHOOK_URL not configured', { status: 500 })
  }

  const record = await req.json()
  const severity: string = record.severity ?? 'medium'
  const change = record.proposed_change ?? {}
  const emoji = severity === 'high' ? '🚨' : '⚠️'
  const color = severity === 'high' ? '#E53E3E' : '#D69E2E'

  const message = {
    text: `${emoji} *메타 광고 자동화 알림*`,
    attachments: [
      {
        color,
        fields: [
          { title: '캠페인', value: record.campaign_name ?? '(알 수 없음)', short: true },
          { title: '심각도', value: severity.toUpperCase(), short: true },
          { title: '감지 내용', value: change.reason ?? '', short: false },
          { title: '제안 액션', value: change.action ?? '', short: true },
        ],
        actions:
          severity !== 'low'
            ? [
                {
                  type: 'button',
                  text: '대시보드에서 확인',
                  url: `${dashboardUrl}/dashboard/queue/${record.id}`,
                  style: 'primary',
                },
              ]
            : [],
      },
    ],
  }

  const slackRes = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message),
  })

  if (!slackRes.ok) {
    return new Response(`Slack error: ${slackRes.status}`, { status: 502 })
  }

  return new Response('ok', { status: 200 })
})
