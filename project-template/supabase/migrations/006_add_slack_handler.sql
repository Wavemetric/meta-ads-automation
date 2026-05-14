-- 상품/프로모션별 담당자 Slack User ID 추가
-- 값은 Slack member ID (예: U01ABCD2EFG) — Slack 알림에서 <@USER_ID> 형태로 멘션됨

ALTER TABLE product_target_cpas
  ADD COLUMN IF NOT EXISTS slack_user_id text;

ALTER TABLE promotion_target_cpas
  ADD COLUMN IF NOT EXISTS slack_user_id text;
