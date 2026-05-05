# 보안 원칙

## 절대 하지 않는 것

- API 키를 코드에 직접 작성하지 않는다
- `.env` 파일을 GitHub에 올리지 않는다
- Secret key를 클라이언트(브라우저)에 노출하지 않는다
- `main` 브랜치에 직접 push하지 않는다
- GitHub repo를 Public으로 만들지 않는다 (명시적 승인 없이)

---

## API 키 관리 방법

```python
# Python - 올바른 방법
import os
from dotenv import load_dotenv
load_dotenv()
api_key = os.getenv("NAVER_AD_API_KEY")

# Python - 절대 금지
api_key = "abc123xyz..."
```

```typescript
// TypeScript - 올바른 방법
const apiKey = process.env.API_KEY;

// TypeScript - 절대 금지
const apiKey = "abc123xyz...";
```

---

## 환경변수 관리

| 파일 | 용도 | Git 포함 여부 |
|------|------|--------------|
| `.env` | 실제 키 값 저장 | 절대 포함 안 함 |
| `.env.example` | 필요한 키 이름만 기록 | 포함 (값은 비워둠) |

새 키가 추가되면 `.env.example`에도 반드시 추가한다.

---

## 새 프로젝트 시작 시 체크리스트

- [ ] `.gitignore`에 `.env` 포함 확인
- [ ] `.env.example` 작성 완료
- [ ] GitHub repo Private 설정 확인
- [ ] 실제 키 값은 팀원에게 별도 전달 (Slack DM 등)

---

## 보안 사고 발생 시

1. 즉시 담당자에게 알린다 (숨기지 않는다)
2. 해당 키를 즉시 무효화(revoke)한다
3. 새 키를 발급받아 교체한다

빠르게 알릴수록 피해가 줄어든다.
