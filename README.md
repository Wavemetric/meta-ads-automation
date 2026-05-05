# Meta Ads Automation

Meta(Facebook, Instagram) 광고 성과를 자동으로 모니터링하고 최적화하는 통합 솔루션입니다.

## 📦 프로젝트 구조

```
meta-ads-automation/
├── project-template/          # Next.js 애플리케이션
│   ├── app/                  # 대시보드 및 API
│   ├── lib/                  # Meta, Cafe24 통합 모듈
│   ├── supabase/             # DB 마이그레이션, Edge Functions
│   ├── package.json
│   ├── CLAUDE.md             # 상세 문서
│   ├── README.md
│   ├── .env.example
│   └── .env.local            # 크레덴셜 정보
├── onboarding-prompt.md      # 새 팀원 온보딩
└── README.md                 # 이 파일
```

## 🚀 빠른 시작

### 1. 프로젝트 설정
```bash
cd project-template
npm install
cp .env.example .env.local
# .env.local 편집
```

### 2. Supabase 마이그레이션
```bash
supabase db push
```

### 3. 개발 서버 실행
```bash
npm run dev
```

대시보드: http://localhost:3000

## 📚 상세 문서

- **[CLAUDE.md](project-template/CLAUDE.md)** - 아키텍처, 설정, 확장 가능성
- **[project-template/README.md](project-template/README.md)** - 기능 가이드, API 엔드포인트
- **[onboarding-prompt.md](onboarding-prompt.md)** - 새 팀원 온보딩

## ✨ 주요 기능

### Meta 광고 자동화
- **자동 수집**: Meta Graph API로 캠페인 성과 데이터 수집
- **규칙 기반 최적화**: CPA, ROAS, CTR 기준 자동 조정
- **워크플로우**: Severity 기반 자동/수동 액션 실행
- **Slack 알림**: 중요 변화 실시간 알림

### Cafe24 상품 매출 추적
- **자동 수집**: Cafe24 Analytics API에서 상품별 매출 데이터
- **실시간 대시보드**: 상품별 판매건수, 매출액 표시
- **분석**: 광고별 상품 성과 분석 (향후 UTM 연동)

## 🔑 크레덴셜 관리

`.env.local`에 저장되는 정보:
- **Meta API**: App ID, Secret, Access Token, 광고 계정 ID
- **Supabase**: URL, Anon Key, Service Role Key
- **Cafe24**: Client ID, Secret, Mall ID
- **Slack**: Webhook URL
- **Security**: Cron Secret, Dashboard Password

## 🏗️ 아키텍처 개요

```
Meta Ads API                 Cafe24 Analytics API
     ↓                               ↓
  [Collect Cron]          [Collect Cafe24 Cron]
     ↓                               ↓
campaigns_snapshot ←────────→ products_sales
     ↓                               ↓
[Rule Engine Cron]          [Dashboard Display]
     ↓
action_queue → approval workflow → execution
     ↓
execution_log (모든 변경사항 기록)
```

## 🔄 자동화 워크플로우

1. **수집** (Cron): Meta 광고 성과 + Cafe24 상품 매출 → Supabase
2. **평가** (Cron): 규칙 엔진 → action_queue 생성
3. **승인** (대시보드): Severity별 자동/수동 처리
4. **실행** (Cron/API): Meta API 호출 → 변경 적용
5. **로깅** (자동): 모든 변경사항 execution_log 기록

## 📊 대시보드

### 메인 (`/dashboard`)
- KPI 요약, 캠페인 성과, 승인 대기 액션

### 승인 큐 (`/dashboard/queue`)
- Pending 액션 상세 정보, 승인/거부 처리

### 규칙 관리 (`/dashboard/rules`)
- 활성화된 규칙 목록, 규칙 활성화/비활성화

### 소재 성과 (`/dashboard/creatives`)
- 소재별 CTR, CPM, 피로도 점수

### 실행 로그 (`/dashboard/logs`)
- 모든 자동화 액션 이력

## 🔐 보안

- **Cron Secret**: 모든 Cron 요청 검증
- **대시보드 암호**: DASHBOARD_PASSWORD
- **환경 변수**: .env.local은 .gitignore에 포함
- **Supabase RLS**: 프로덕션에서는 Row Level Security 설정

## 🛠️ 기술 스택

- **Frontend**: Next.js 14, React, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **API**: Meta Graph API, Cafe24 Analytics API
- **Notifications**: Slack API
- **Deployment**: Vercel (Cron 포함)

## 📖 사용 예시

### Meta 액션 승인
```
1. Cron에서 CPA > 33,000 감지
2. action_queue에 "예산 -10% 감소" 추가
3. 대시보드에서 액션 확인
4. [승인] 버튼 클릭
5. Meta API 호출 → 캠페인 예산 조정
6. execution_log 기록
```

### 상품 매출 모니터링
```
1. Cron에서 Cafe24 상품별 매출 수집
2. products_sales 테이블에 저장
3. 대시보드에서 상품별 매출 실시간 표시
4. 상위 판매 상품 확인 및 광고 최적화
```

## 🚢 배포

### Vercel
```bash
cd project-template
vercel
```

Cron은 `vercel.json`에 자동 설정됨:
- `/api/cron/collect` - 1시간마다 실행
- `/api/cron/evaluate` - 1시간마다 실행

## 📝 개발 가이드

### 새 규칙 추가
1. `supabase/migrations/` 에서 SQL 작성
2. `lib/rules/engine.ts` 에서 필요시 로직 수정
3. Supabase 마이그레이션 실행

### 새 대시보드 페이지 추가
1. `app/dashboard/` 에 `[feature]/page.tsx` 생성
2. `app/dashboard/layout.tsx` 에 navigation 추가

### API 엔드포인트 추가
1. `app/api/[feature]/route.ts` 생성
2. 필요시 `lib/` 에 비즈니스 로직 추가

## 🐛 트러블슈팅

### Cron 실행 안 됨
- Vercel 배포 확인
- CRON_SECRET 일치 확인
- 함수 로그 확인

### Meta API 오류
- Access token 유효기간 확인 (60일)
- 광고 계정 권한 확인

### DB 연결 실패
- Supabase URL, 키 확인
- 마이그레이션 실행 확인

## 🤝 기여

버그 리포트, 기능 요청, PR 환영합니다.

## 📄 라이선스

Copyright © 2026 Wavemetric. All rights reserved.
