# Meta Ads Automation — Claude Code 가이드

## 이 프로젝트 담당자에 대해

담당자는 **마케터/운영팀 배경**으로, 개발 경험이 없어요.
아래 커뮤니케이션 원칙을 반드시 지켜요.

### 커뮤니케이션 원칙

**설명할 때**
- 기술 용어는 반드시 쉬운 말로 바로 풀어서 설명
- 구조: [비유] → [실제 내용] → [왜 중요한지] 순서로
- 나쁜 예: "Vercel Cron이 route handler를 invoke합니다"
- 좋은 예: "Vercel이 1시간마다 자동으로 데이터 수집을 실행해요 (알람 맞춰놓은 것처럼)"

**진행 상황 보고할 때**
- "70% 완료" 같은 말 쓰지 않기
- 대신: "완료된 것 / 지금 하는 것 / 다음 할 것 / 확인 필요한 것" 순서로

**막혔을 때**
- "불가능합니다" 대신 → "이 방법은 어렵고, 대신 이렇게 하면 되는데 이런 점이 아쉬워요. 어떻게 할까요?"

**질문할 때**
- 모호한 요청이 오면 바로 만들지 말고 → "왜 필요한지 / 완료 기준이 뭔지" 먼저 확인

---

## 프로젝트 개요

**메타(페이스북/인스타그램) 광고를 자동으로 감시하고 조정하는 시스템**

```
1시간마다 자동 → 메타에서 광고 성과 수집 (CPA, ROAS, 지출 등)
              → 규칙이랑 비교 ("CPA 33,000 넘으면 예산 줄여")
              → 위험도 낮으면 자동 실행
              → 위험도 높으면 Slack 알림 + 담당자 승인
              → 모든 실행 이력 기록
```

작업 위치: `project-template/` 폴더 안이 실제 앱

---

## 현재 상태 (2026-05-11 기준)

### 완성된 것 (코드 있음)
- 메타 성과 자동 수집 (`lib/meta/client.ts`, `collector.ts`)
- 규칙 평가 엔진 (`lib/rules/engine.ts`, `evaluators.ts`)
- 자동 실행 / 담당자 승인 분기 (`app/api/actions/`)
- 승인 화면, KPI 대시보드, 규칙 관리, 소재 성과, 실행 이력 UI
- Supabase DB 설계 + 기본 규칙 5개 (`supabase/migrations/001_initial_schema.sql`)
- Slack 알림 (`lib/notifications/slack.ts`)

### 아직 안 된 것 (지금부터 할 것)
| 할 일 | 설명 |
|-------|------|
| `vercel.json` 없음 | 이게 없으면 배포해도 자동 수집이 안 돌아감 |
| 환경변수 미설정 | 메타 토큰, 광고계정 ID, Supabase 주소 등 아직 안 넣음 |
| Supabase DB 미생성 | 실제 DB를 아직 안 만든 상태 |
| Cafe24 연동 미구현 | `lib/cafe24/` 폴더 구조만 있고 실제 코드 없음 |

---

## 앞으로 작업 순서

1. Supabase 프로젝트 생성 + DB 마이그레이션
2. `.env.local` 환경변수 채우기 (메타 토큰, Supabase, Slack)
3. `vercel.json` 추가 (Cron 스케줄 설정)
4. Vercel 배포 + 실제 계정 연결 테스트
5. Cafe24 연동 구현

---

## 기본 규칙 (자동화 기준)

| 조건 | 조치 | 방식 |
|------|------|------|
| CPA > 33,000원 | 예산 -10% | 자동 |
| CPA > 39,000원 | 캠페인 정지 | 승인 필요 |
| ROAS < 2.0 | 예산 -20% | 승인 필요 |
| CTR < 0.5% | 소재 교체 알림 | 승인 필요 |
| 일일 지출 > 150,000원 | 캠페인 정지 | 승인 필요 |

---

## 환경변수 목록 (`.env.local`)

```
META_APP_ID=
META_APP_SECRET=
META_ACCESS_TOKEN=          # 60일마다 갱신 필요
META_AD_ACCOUNT_IDS=        # act_xxx 형식, 여러 개면 쉼표로 구분

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

SLACK_WEBHOOK_URL=

CRON_SECRET=                # 보안용 랜덤 문자열
```

---

## 로컬 실행

```bash
cd project-template
npm install
npm run dev
# http://localhost:3000
```

---

## 팀 연락처

- 기술 지원: Wavemetric AX팀 (angryzero@wavemetric.io)
