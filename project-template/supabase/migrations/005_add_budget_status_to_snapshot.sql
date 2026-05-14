-- campaigns_snapshot에 광고세트/캠페인의 현재 일 예산과 상태를 함께 저장
-- 추천 카드에서 "현재 예산 → 변경 예산", "현재 광고 상태"를 보여주기 위함

ALTER TABLE campaigns_snapshot
  ADD COLUMN IF NOT EXISTS daily_budget numeric,
  ADD COLUMN IF NOT EXISTS adset_status text,
  ADD COLUMN IF NOT EXISTS campaign_status text;
