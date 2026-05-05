# Meta Ads Automation

Meta(Facebook, Instagram) 광고 성과를 자동으로 모니터링하고 최적화하는 통합 솔루션입니다.

## ✨ 주요 기능

- **자동 성과 모니터링**: Meta Graph API로 캠페인/광고세트 데이터 실시간 수집
- **규칙 기반 자동화**: CPA, ROAS, CTR 기준으로 캠페인 자동 최적화
- **승인 워크플로우**: Severity 기반 자동/수동 액션 실행
- **Slack 알림**: 주요 변화 실시간 알림
- **Cafe24 연동**: 상품별 매출 추적 및 실시간 대시보드
- **실행 이력 관리**: 모든 변경사항 로깅 및 추적

## 🚀 빠른 시작

### 1. 환경 변수 설정
```bash
cp .env.example .env.local
# .env.local 편집: Meta API 키, Supabase 설정 등
```

### 2. 의존성 설치
```bash
npm install
```

### 3. Supabase 마이그레이션
```bash
supabase db push
```

### 4. 개발 서버 실행
```bash
npm run dev
```

대시보드: http://localhost:3000

## 📊 대시보드

### 메인 대시보드 (`/dashboard`)
- KPI 요약 (총지출, 전환수, 평균 CPA, ROAS)
- 캠페인별 성과 테이블
- 승인 대기 중인 액션 미리보기

### 승인 큐 (`/dashboard/queue`)
- Pending 상태의 모든 액션 표시
- 액션 상세 정보 및 변경사항 확인
- 승인/거부 처리

### 규칙 관리 (`/dashboard/rules`)
- 자동화 규칙 조회
- 규칙 활성화/비활성화
- 새 규칙 추가 (개발 중)

### 소재 성과 (`/dashboard/creatives`)
- 소재별 CTR, CPM, 성과 추적
- 피로도 점수 (Fatigue Score)

### 실행 로그 (`/dashboard/logs`)
- 모든 자동화 액션 이력
- 성공/실패 상태 확인

## 🔄 자동화 흐름

```
1. Meta 데이터 수집 (Cron: 1시간마다)
   ↓
2. 규칙 엔진 평가 (Cron: 1시간마다)
   ↓
3. action_queue 생성
   - severity='low' → 즉시 실행 (자동)
   - severity='medium'/'high' → 대시보드 승인 대기
   ↓
4. 액션 실행 (Meta API 호출)
   ↓
5. 실행 로그 기록
```

## 📋 기본 규칙

| 규칙 | 조건 | 액션 | Severity |
|------|------|------|----------|
| CPA 목표 초과 10% | CPA > 33,000 | 예산 -10% | low |
| CPA 목표 초과 30% | CPA > 39,000 | 캠페인 정지 | high |
| ROAS 미달 | ROAS < 2.0 | 예산 -20% | medium |
| CTR 낮음 | CTR < 0.5% | 소재 교체 | medium |
| 일 예산 소진 초과 | Spend > 150,000 | 캠페인 정지 | high |

## 🔌 API 엔드포인트

### Cron 작업
- `GET /api/cron/collect` - Meta 데이터 수집
- `GET /api/cron/evaluate` - 규칙 엔진 실행

### 액션 실행
- `POST /api/actions/approve/[id]` - 액션 승인
- `POST /api/actions/reject/[id]` - 액션 거부
- `POST /api/actions/execute` - 승인된 액션 실행

## 📁 프로젝트 구조

```
project-template/
├── app/
│   ├── api/                    # API 라우트
│   │   ├── actions/           # 액션 실행
│   │   └── cron/              # 정기 작업
│   └── dashboard/             # UI 컴포넌트
├── lib/
│   ├── meta/                  # Meta API 모듈
│   ├── cafe24/                # Cafe24 API 모듈
│   ├── rules/                 # 규칙 엔진
│   ├── notifications/         # Slack 알림
│   └── supabase/              # DB 클라이언트
├── supabase/
│   ├── migrations/            # DB 스키마
│   └── functions/             # Edge Functions
└── public/                    # 정적 파일
```

## ⚙️ 환경 변수

자세한 설정은 `.env.example` 참고

```env
# Meta API
META_ACCESS_TOKEN=your_token
META_AD_ACCOUNT_IDS=act_xxx,act_yyy

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx

# Cafe24
CAFE24_CLIENT_ID=xxx
CAFE24_CLIENT_SECRET=xxx

# Slack
SLACK_WEBHOOK_URL=https://hooks.slack.com/...

# Security
CRON_SECRET=your_32char_secret
DASHBOARD_PASSWORD=password
```

## 🚢 배포

### Vercel
```bash
vercel
```

**Cron 작업** (`vercel.json`):
```json
{
  "crons": [
    {
      "path": "/api/cron/collect",
      "schedule": "0 */1 * * *"
    },
    {
      "path": "/api/cron/evaluate",
      "schedule": "0 */1 * * *"
    }
  ]
}
```

### 로컬 스케줄러
외부 Cron 서비스 (AWS EventBridge, Google Cloud Scheduler 등) 사용 가능

## 🔐 보안 고려사항

1. **Access Token 갱신**: Meta access_token은 60일마다 갱신 필요
2. **CRON_SECRET**: 환경변수로 관리하며, 모든 Cron 요청에서 검증
3. **대시보드 암호**: 간단한 비밀번호 보호 (DASHBOARD_PASSWORD)
4. **Supabase RLS**: 프로덕션에서는 Row Level Security 설정 필요

## 🐛 트러블슈팅

### Cron이 실행되지 않는 경우
- Vercel 배포 확인
- CRON_SECRET 값 일치 확인
- 로그 확인: Vercel Dashboard → Functions

### Meta API 오류
- Access token 유효 기간 확인
- App ID, Secret 일치 확인
- 광고 계정 권한 확인

### Slack 알림이 오지 않는 경우
- SLACK_WEBHOOK_URL 확인
- Slack 워크스페이스 권한 확인

## 📚 참고 자료

- [Meta Graph API Docs](https://developers.facebook.com/docs/graph-api)
- [Cafe24 Analytics API](https://developers.cafe24.com)
- [Supabase Docs](https://supabase.com/docs)
- [Next.js Docs](https://nextjs.org/docs)

## 📄 라이선스

Copyright © 2026 Wavemetric. All rights reserved.

## 🤝 기여

버그 리포트 및 기능 제안은 이슈를 통해 제출해주세요.
