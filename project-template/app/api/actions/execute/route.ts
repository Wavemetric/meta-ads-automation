// 실행 기능 비활성화 — 현재는 알림/확인 기능만 운영
// Meta API 실행은 별도 승인 프로세스 구축 후 활성화 예정
export async function POST() {
  return Response.json(
    { error: '실행 기능이 비활성화되어 있습니다. 현재는 Slack 알림 및 대시보드 확인 기능만 운영 중입니다.' },
    { status: 403 }
  )
}
