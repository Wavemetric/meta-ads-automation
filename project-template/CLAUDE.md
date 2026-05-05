# Meta Ads Automation - Claude Code Guide

## 프로젝트 개요

**Meta Ads Automation**은 Meta(Facebook, Instagram) 광고의 성과를 자동으로 모니터링하고, 규칙 엔진을 통해 캠페인을 자동으로 최적화하는 Next.js 기반 시스템입니다.

동시에 Cafe24 쇼핑몰의 상품별 매출 데이터를 수집하여 광고와 제품 판매를 연결하고 실시간 성과 측정을 지원합니다.

---

## 아키텍처 개요

```
Meta Ads API
    ↓ (1시간마다 Cron)
campaigns_snapshot (Supabase)
    ↓ (규칙 엔진 평가)
action_queue
    ↓ severity에 따라
  low → 자동 실행
  medium → 대시보드 승인 필요
  high → Slack 즉시 알림 + 승인 필요
    ↓
execution_log

---

Cafe24 Analytics API
    ↓ (1시간마다 Cron)
products_sales (Supabase)
    ↓
대시보드에서 실시간 상품 매출 표시
```

---

## 주요 기능

### 1. Meta 광고 성과 모니터링
- **자동 수집**: Cron으로 Meta Graph API에서 캠페인/광고세트 성과 데이터 수집
- **메트릭**: CPA, ROAS, CTR, 지출, 전환수 등
- **데이터 저장**: Supabase `campaigns_snapshot` 테이블

### 2. 규칙 엔진 (자동 최적화)
- **기본 규칙**:
  - CPA > 33,000: 예산 -10% (자동)
  - CPA > 39,000: 캠페인 정지 (승인 필요)
  - ROAS < 2.0: 예산 -20% (승인 필요)
  - CTR < 0.5%: 소재 교체 (승인 필요)
  - Daily Spend > 150,000: 캠페인 정지 (승인 필요)

### 3. 승인 워크플로우
- **Severity 기반**:
  - `low`: 자동 실행
  - `medium`: 대시보드 승인 후 실행
  - `high`: Slack 알림 + 대시보드 승인 후 실행

### 4. Cafe24 상품 매출 추적
- **자동 수집**: Cafe24 Analytics API에서 상품별 매출 데이터 수집
- **메트릭**: 상품명, 판매건수, 매출액
- **실시간 대시보드**: 상품별 매출 실시간 표시

---

## 디렉토리 구조

```
project-template/
├── app/
│   ├── api/                    # API 라우트
│   │   ├── actions/           # 액션 실행 (승인/거부/실행)
│   │   │   ├── approve/
│   │   │   ├── reject/
│   │   │   └── execute/
│   │   └── cron/              # 정기 작업
│   │       ├── collect/       # Meta 데이터 수집
│   │       └── evaluate/      # 규칙 엔진 실행
│   ├── dashboard/             # 대시보드 UI
│   │   ├── page.tsx          # 메인 대시보드
│   │   ├── queue/            # 승인 대기 큐
│   │   ├── rules/            # 규칙 관리
│   │   ├── creatives/        # 소재 성과
│   │   └── logs/             # 실행 이력
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
│
├── lib/
│   ├── meta/                  # Meta API 모듈
│   │   ├── client.ts         # Meta API 클라이언트
│   │   ├── collector.ts      # 데이터 수집
│   │   └── executor.ts       # 액션 실행
│   ├── cafe24/               # Cafe24 API 모듈
│   │   ├── client.ts
│   │   └── collector.ts
│   ├── rules/                # 규칙 엔진
│   │   ├── engine.ts         # 규칙 평가 엔진
│   │   └── evaluators.ts     # 평가 함수
│   ├── notifications/
│   │   └── slack.ts         # Slack 알림
│   └── supabase/
│       ├── client.ts         # Supabase 클라이언트
│       ├── browser.ts        # 클라이언트 사이드
│       └── types.ts          # 타입 정의
│
├── supabase/
│   ├── migrations/
│   │   └── 001_initial_schema.sql
│   └── functions/
│       └── notify-slack/     # Edge Function
│
├── package.json
├── tsconfig.json
├── next.config.ts
├── postcss.config.mjs
└── .env.example
```

---

## 핵심 파일 설명

### `/lib/meta/client.ts`
Meta Graph API 호출 함수들:
- `fetchCampaignInsights()`: 캠페인 성과 조회
- `updateCampaignBudget()`: 예산 변경
- `setCampaignStatus()`: 캠페인 활성화/정지

### `/lib/rules/engine.ts`
규칙 엔진:
- `runRuleEngine()`: 모든 규칙을 순회하며 위반한 규칙 찾기
- 매칭된 규칙 → `action_queue`에 삽입

### `/lib/cafe24/client.ts`
Cafe24 Analytics API 호출:
- `fetchProductSales()`: 상품별 매출
- `fetchOrderDetails()`: 개별 주문 정보

### `/app/api/cron/collect/route.ts`
Meta 데이터 수집 (Vercel Cron 또는 외부 스케줄러):
- `GET /api/cron/collect?auth=CRON_SECRET`
- 요청 검증 → 데이터 수집 → Supabase 저장

### `/app/api/cron/evaluate/route.ts`
규칙 엔진 실행:
- `GET /api/cron/evaluate?auth=CRON_SECRET`
- 규칙 평가 → `action_queue` 생성

### `/app/dashboard/page.tsx`
메인 대시보드:
- KPI 요약 (총지출, 전환수, 평균 CPA, 평균 ROAS)
- 캠페인 성과 테이블
- 승인 대기 미리보기

---

## 환경 변수 설정

### Meta API
```env
META_APP_ID=your_app_id
META_APP_SECRET=your_app_secret
META_ACCESS_TOKEN=your_long_lived_token  # 60일마다 갱신 필요
META_AD_ACCOUNT_IDS=act_xxx,act_yyy      # 쉼표로 구분
```

### Supabase
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx
```

### Cafe24 Analytics API
```env
CAFE24_MALL_ID=your_mall_id
CAFE24_CLIENT_ID=oauth_client_id
CAFE24_CLIENT_SECRET=oauth_client_secret
```

### Slack
```env
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
SLACK_BOT_TOKEN=xoxb-...  # 선택사항
```

### 보안
```env
CRON_SECRET=openssl rand -hex 32  # Vercel Cron 검증용
DASHBOARD_PASSWORD=your_password
```

---

## Supabase 마이그레이션

```bash
cd project-template/supabase
supabase db push
```

생성 테이블:
- `campaigns_snapshot`: Meta 캠페인 성과 스냅샷
- `automation_rules`: 자동화 규칙 정의
- `action_queue`: 실행 대기 중인 액션
- `execution_log`: 실행 이력
- `creatives`: 소재 성과 정보
- `products_sales`: Cafe24 상품별 매출

---

## 실행 방법

### 로컬 개발
```bash
npm install
npm run dev
# http://localhost:3000
```

### Cron 실행 (Vercel)
```bash
# vercel.json에 설정된 Cron 자동 실행
# 또는 수동으로:
curl -H "Authorization: Bearer {CRON_SECRET}" \
  https://your-app.vercel.app/api/cron/collect

curl -H "Authorization: Bearer {CRON_SECRET}" \
  https://your-app.vercel.app/api/cron/evaluate
```

---

## 주요 주의사항

1. **Meta Access Token**: 60일 주기로 갱신 필요 (장기 토큰 설정 권장)
2. **Cafe24 API Scope**: `mall.read_analytics` scope 필수
3. **Cron Secret**: 무작위 32글자 문자열 (openssl rand -hex 32)
4. **Slack Webhook**: 선택사항이지만 권장 (중요 알림용)

---

## 확장 가능성

- [ ] 상품-광고 매핑 (UTM tracking 추가 후)
- [ ] 상품별 ROAS 기반 규칙
- [ ] ML 기반 자동 예산 분배
- [ ] Google Ads 통합
- [ ] A/B 테스트 자동화

---

## 문제 해결

**Q: Cron이 실행되지 않는다**
- Vercel 배포 확인
- CRON_SECRET 값 확인
- Authorization 헤더 형식 확인

**Q: Meta API 인증 실패**
- ACCESS_TOKEN 유효 기간 확인 (60일)
- APP_ID, APP_SECRET 확인

**Q: Supabase 연결 실패**
- NEXT_PUBLIC_SUPABASE_URL, 키 확인
- 데이터베이스 마이그레이션 실행 확인

---

## 참고 자료

- [Meta Graph API](https://developers.facebook.com/docs/graph-api)
- [Cafe24 Analytics API](https://developers.cafe24.com/data/front/cafe24dataapi)
- [Supabase 문서](https://supabase.com/docs)
- [Next.js 문서](https://nextjs.org/docs)
