# Meta Ads Automation 온보딩 가이드

Meta 광고 자동화 시스템에 오신 것을 환영합니다! 🎉

이 가이드는 새로운 팀원이 프로젝트를 빠르게 이해하고 기여할 수 있도록 도와줍니다.

## 📚 필독 문서

1. **[README.md](README.md)** - 프로젝트 개요
2. **[project-template/CLAUDE.md](project-template/CLAUDE.md)** - 상세 아키텍처 및 설정
3. **[project-template/README.md](project-template/README.md)** - 기능 가이드

## 🎯 5분 안에 알아야 할 것

### 이 시스템은 뭐 하는 건가요?

Meta(Facebook, Instagram) 광고의 성과를 **자동으로 모니터링하고 최적화**하는 시스템입니다.

- 매시간 Meta API에서 캠페인 성과 데이터 수집
- 규칙 엔진이 CPA, ROAS 같은 지표 평가
- 문제 상황 자동 감지 → Slack 알림
- 대시보드에서 승인 후 자동으로 예산 조정, 캠페인 정지 등

동시에 **Cafe24 쇼핑몰의 상품별 매출**도 추적하여 광고 성과와 연결합니다.

### 핵심 컴포넌트는?

```
1. Meta API 데이터 수집 (hourly cron)
   ↓
2. 규칙 엔진으로 평가
   ↓
3. 액션 대기열 생성
   ↓
4. 대시보드에서 승인 (또는 자동 실행)
   ↓
5. Meta API로 변경 적용
```

### 폴더 구조를 이해하고 싶어요

```
project-template/
├── app/api/
│   ├── cron/collect   → Meta 데이터 수집
│   ├── cron/evaluate  → 규칙 엔진 실행
│   └── actions/       → 액션 승인/거부/실행
├── app/dashboard/
│   ├── page.tsx       → 메인 대시보드
│   ├── queue/         → 승인 대기 액션
│   ├── rules/         → 규칙 관리
│   └── logs/          → 실행 이력
└── lib/
    ├── meta/          → Meta API 모듈
    ├── cafe24/        → Cafe24 API 모듈
    ├── rules/         → 규칙 엔진
    └── supabase/      → DB 클라이언트
```

## 🔧 로컬 환경 설정

### 1단계: 저장소 클론
```bash
git clone https://github.com/Wavemetric/meta-ads-automation.git
cd meta-ads-automation/project-template
```

### 2단계: 환경 변수 설정
```bash
cp .env.example .env.local
# .env.local을 편집하고 필요한 값 입력
# (팀장에게 크레덴셜 요청)
```

### 3단계: 의존성 설치 및 실행
```bash
npm install
npm run dev
```

대시보드: http://localhost:3000

### 4단계: Supabase 마이그레이션 (처음 한 번만)
```bash
supabase db push
```

## 🔑 환경 변수 가이드

필요한 값들 (팀장에게 요청):

| 변수 | 설명 | 예시 |
|------|------|------|
| `META_ACCESS_TOKEN` | Meta Graph API 토큰 | `EAAXwGZA7duRw...` |
| `META_AD_ACCOUNT_IDS` | 광고 계정 ID (쉼표 구분) | `act_xxx,act_yyy` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 서비스 키 | `eyJhbG...` |
| `CAFE24_CLIENT_ID` | Cafe24 OAuth 클라이언트 ID | `CofvJT6Y...` |
| `CAFE24_CLIENT_SECRET` | Cafe24 OAuth 시크릿 | `ifNFJyj...` |
| `CRON_SECRET` | Cron 요청 검증용 시크릿 | 32자 랜덤 문자열 |

## 📖 코드 둘러보기

### Meta API 데이터 수집 이해하기

**파일**: `lib/meta/client.ts`

```typescript
// Meta Graph API 호출
export async function fetchCampaignInsights(accountId: string) {
  // 캠페인별 CPA, ROAS, CTR 등 조회
}

// 캠페인 예산 변경
export async function updateCampaignBudget(campaignId: string, budget: number) {
  // Meta API로 예산 업데이트
}
```

**파일**: `app/api/cron/collect/route.ts`

```typescript
// Cron에서 주기적으로 호출됨
export async function GET(req: NextRequest) {
  // 1. 모든 광고 계정의 데이터 수집
  // 2. Supabase campaigns_snapshot에 저장
}
```

### 규칙 엔진 이해하기

**파일**: `lib/rules/engine.ts`

```typescript
export async function runRuleEngine() {
  // 1. 최신 캠페인 스냅샷 로드
  // 2. 활성화된 모든 규칙 로드
  // 3. 각 캠페인에 대해 각 규칙 평가
  // 4. 규칙 위반 시 action_queue에 추가
}
```

**기본 규칙**:
- CPA > 33,000 → 예산 -10% (자동 실행)
- ROAS < 2.0 → 예산 -20% (승인 필요)
- CTR < 0.5% → 소재 교체 (승인 필요)

### 대시보드 이해하기

**파일**: `app/dashboard/page.tsx`

```typescript
export default async function DashboardPage() {
  // 1. 최신 캠페인 스냅샷 조회
  // 2. Pending 액션 조회
  // 3. KPI 계산 및 표시
}
```

메인 대시보드에서 보이는 것:
- 📊 KPI 카드 (총지출, 전환수, 평균 CPA, ROAS)
- 📈 캠페인 성과 테이블
- ⏳ 승인 대기 액션 미리보기

## 🎓 일반적인 작업들

### 새로운 규칙을 추가하고 싶어요

1. `supabase/migrations/` 에서 SQL 작성
   ```sql
   INSERT INTO automation_rules (name, metric, operator, threshold, action, severity)
   VALUES ('new rule name', 'roas', 'lt', 2.0, 'decrease_budget', 'medium');
   ```

2. Supabase 마이그레이션 실행
   ```bash
   supabase db push
   ```

3. 로컬에서 테스트
   ```bash
   curl http://localhost:3000/api/cron/evaluate
   ```

### 대시보드에 새 페이지를 추가하고 싶어요

1. 디렉토리 생성
   ```bash
   mkdir -p app/dashboard/new-feature
   ```

2. 페이지 컴포넌트 작성
   ```bash
   touch app/dashboard/new-feature/page.tsx
   ```

3. Navigation 추가 (`app/dashboard/layout.tsx`)

### Meta API로 뭘 할 수 있나요?

**읽기** (조회):
- 캠페인 성과 (CPA, ROAS, CTR, 지출)
- 광고세트 성과
- 크리에이티브 성과

**쓰기** (변경):
- 캠페인 예산 조정
- 캠페인 활성화/정지
- (이 시스템에서 지원)

## 🚀 배포 이해하기

### 로컬 개발
```bash
npm run dev
```

### Vercel 배포
```bash
cd project-template
vercel
```

**Vercel Cron**이 자동으로:
- 매시간 `/api/cron/collect` 호출 → 데이터 수집
- 매시간 `/api/cron/evaluate` 호출 → 규칙 평가

### Cron 요청 테스트
```bash
# 로컬에서
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  http://localhost:3000/api/cron/collect

# 배포된 환경에서
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://your-app.vercel.app/api/cron/collect
```

## 🔍 디버깅 팁

### 문제: Cron이 실행되지 않음
```bash
# 1. Vercel 배포 확인
vercel status

# 2. CRON_SECRET 일치 확인
echo $CRON_SECRET

# 3. Vercel 대시보드에서 함수 로그 확인
```

### 문제: Meta API 인증 실패
```bash
# 1. ACCESS_TOKEN 유효기간 확인 (60일)
# 2. APP_ID, SECRET 재확인
# 3. 광고 계정 ID 정확성 확인
```

### 문제: Supabase 연결 실패
```bash
# 1. 환경 변수 확인
echo $NEXT_PUBLIC_SUPABASE_URL

# 2. 마이그레이션 실행 확인
supabase migration list

# 3. RLS 정책 확인
```

## 📞 도움받기

- **아키텍처 질문**: [project-template/CLAUDE.md](project-template/CLAUDE.md) 참고
- **API 사용법**: [Meta Graph API Docs](https://developers.facebook.com/docs/graph-api)
- **Supabase**: [Supabase Docs](https://supabase.com/docs)
- **다른 팀원**: Slack에서 @dev-team 멘션

## ✅ 체크리스트

온보딩 완료 확인:

- [ ] README.md 읽음
- [ ] CLAUDE.md 읽음
- [ ] 로컬 환경 설정 완료
- [ ] npm run dev로 대시보드 실행 확인
- [ ] Supabase 마이그레이션 실행 완료
- [ ] Meta API 데이터 수집 테스트 (`/api/cron/collect`)
- [ ] 규칙 엔진 테스트 (`/api/cron/evaluate`)
- [ ] 대시보드에서 데이터 확인

## 🎉 다음 단계

축하합니다! 이제 다음을 시작할 수 있습니다:

1. **코드 리뷰**: 팀의 기존 PR 검토
2. **이슈 해결**: GitHub Issues에서 `good first issue` 찾기
3. **기능 개발**: 새로운 규칙 또는 대시보드 페이지 추가
4. **문서 개선**: 이 가이드나 코드 주석 개선

행운을 빕니다! 🚀
