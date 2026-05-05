# 기술 스택 원칙

## 기본 스택

특별한 이유 없이 아래 스택을 벗어나지 않는다.
다른 선택이 필요하면 팀에 먼저 공유한다.

### 웹 프로젝트
- **Frontend**: Next.js 14 (App Router) + TypeScript
- **Database**: Supabase (PostgreSQL)
- **배포**: Vercel
- **인증**: Supabase Auth 또는 JWT

### 자동화/데이터 분석
- **언어**: Python (pandas, requests 기본)
- **스케줄링**: GitHub Actions
- **연동 서비스**: Google Sheets, Slack, 네이버/카카오 광고 API

---

## Supabase 사용 원칙

```typescript
// 반드시 이 패턴 사용 (lazy init)
let _supabase = null;
export function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
  }
  return _supabase;
}

// 이 패턴 금지 (빌드 타임 오류 발생)
export const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
```

- **Secret key**: 서버 사이드 전용 (API routes, GitHub Actions)
- **Anon key**: 클라이언트에서 사용 가능 (RLS 적용 필수)
- Next.js config 파일: `.mjs` 또는 `.js` 사용 (`.ts` 불가)

---

## Vercel 배포 원칙

- 환경변수는 Vercel 대시보드에서 관리
- git author 이메일 = Vercel 계정 이메일 일치 필요
- 배포 전 로컬에서 `npm run build` 성공 확인

---

## GitHub Actions 원칙

- 민감한 값은 반드시 GitHub Secrets 사용 (코드에 직접 작성 금지)
- `workflow_dispatch`로 수동 트리거 가능하게 구성
- 실패 시 원인 파악 전에 재시도 금지
