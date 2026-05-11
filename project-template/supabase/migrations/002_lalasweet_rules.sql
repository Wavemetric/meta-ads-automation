-- ────────────────────────────────────────────
-- 002_lalasweet_rules.sql
-- 라라스윗 운영 규칙 스키마 및 시드
-- ────────────────────────────────────────────

-- 1. automation_rules 테이블에 라라스윗 운영 컬럼 추가
ALTER TABLE automation_rules
  ADD COLUMN IF NOT EXISTS product_filter       text    DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS campaign_type_filter text    DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS time_start           integer,          -- KST 시작 시각 (null = 항상)
  ADD COLUMN IF NOT EXISTS time_end             integer,          -- KST 종료 시각 (null = 항상)
  ADD COLUMN IF NOT EXISTS is_midnight_rule     boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS threshold_type       text    DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS threshold_multiplier numeric;

-- 2. 상품별 목표 CPA 테이블
CREATE TABLE IF NOT EXISTS product_target_cpas (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  product_name text    NOT NULL,
  target_cpa   numeric NOT NULL,
  is_active    boolean DEFAULT true,
  created_at   timestamptz DEFAULT now()
);

-- 3. 라라스윗 상품 CPA 시드
INSERT INTO product_target_cpas (product_name, target_cpa) VALUES
  ('팝콘',      6800),
  ('토피넛콘',  4500),
  ('웨하스',    6800),
  ('파인트',    7000),
  ('요거트바',  7600),
  ('제로바',    8000),
  ('아몬드스윗', 4000),
  ('꼬숩두유',  4500);

-- 4. 기존 기본 규칙 제거 후 라라스윗 규칙으로 교체
DELETE FROM automation_rules;

-- ────────────────────────────────────────────
-- 5. 라라스윗 운영 규칙 시드
--    모든 규칙 severity = 'medium' (전부 pending 처리)
--    threshold = 0 (placeholder — engine에서 product_cpa * multiplier로 대체)
-- ────────────────────────────────────────────

-- ── 소재 (scope: creative) 00시 규칙 ──────────────────────────────────

INSERT INTO automation_rules
  (name, metric, operator, threshold, action, action_value, severity, scope,
   is_midnight_rule, threshold_type, threshold_multiplier, campaign_type_filter)
VALUES
  ('소재 ON: 7일CPA 목표 이하',
   'cpa', 'lte', 0, 'resume', null, 'medium', 'creative',
   true, 'product_cpa', 1.0, 'all'),

  ('소재 OFF: 7일CPA 목표 10%↑',
   'cpa', 'gt',  0, 'pause',  null, 'medium', 'creative',
   true, 'product_cpa', 1.1, 'all');

-- ── 소재 시간별 규칙 (1시~ 매시, is_midnight_rule=false) ──────────────

INSERT INTO automation_rules
  (name, metric, operator, threshold, action, action_value, severity, scope,
   is_midnight_rule, threshold_type, threshold_multiplier, campaign_type_filter)
VALUES
  ('소재 OFF: CPA 목표 5%↑',
   'cpa', 'gt',  0, 'pause',  null, 'medium', 'creative',
   false, 'product_cpa', 1.05, 'all');

-- ── 캠페인 (scope: campaign) 00시 규칙 ───────────────────────────────

INSERT INTO automation_rules
  (name, metric, operator, threshold, action, action_value, severity, scope,
   is_midnight_rule, threshold_type, threshold_multiplier, campaign_type_filter)
VALUES
  ('캠페인 ON: 7일CPA 목표 이하',
   'cpa', 'lte', 0, 'resume', null, 'medium', 'campaign',
   true, 'product_cpa', 1.0, 'all'),

  ('캠페인 ON: 7일CPA 목표 10% 이하',
   'cpa', 'lte', 0, 'resume', null, 'medium', 'campaign',
   true, 'product_cpa', 1.1, 'all'),

  ('ASC 예산=전일: 7일CPA 목표 이하',
   'cpa', 'lte', 0, 'set_budget_yesterday', null, 'medium', 'campaign',
   true, 'product_cpa', 1.0, 'ASC'),

  ('ASC 예산=전일x70%: 7일CPA 목표 5%↑',
   'cpa', 'gt',  0, 'set_budget_yesterday_70pct', null, 'medium', 'campaign',
   true, 'product_cpa', 1.05, 'ASC'),

  ('ASC 예산=전일x50%: 7일CPA 목표 10%↑',
   'cpa', 'gt',  0, 'set_budget_yesterday_50pct', null, 'medium', 'campaign',
   true, 'product_cpa', 1.1, 'ASC');

-- ── 캠페인 6~9시 (ASC 시간대별 규칙 — 6시 이상 9시 미만) ─────────────

INSERT INTO automation_rules
  (name, metric, operator, threshold, action, action_value, severity, scope,
   is_midnight_rule, time_start, time_end,
   threshold_type, threshold_multiplier, campaign_type_filter)
VALUES
  ('ASC 예산+30%: CPA 목표 이하 (6-9시)',
   'cpa', 'lte', 0, 'increase_budget', 0.3, 'medium', 'campaign',
   false, 6, 9, 'product_cpa', 1.0, 'ASC'),

  ('ASC 예산-10%: CPA 목표 5%↑ (6-9시)',
   'cpa', 'gt',  0, 'decrease_budget', 0.1, 'medium', 'campaign',
   false, 6, 9, 'product_cpa', 1.05, 'ASC'),

  ('ASC 예산-50%: CPA 목표 10%↑ (6-9시)',
   'cpa', 'gt',  0, 'decrease_budget', 0.5, 'medium', 'campaign',
   false, 6, 9, 'product_cpa', 1.1, 'ASC');

-- ── 캠페인 20~23시 (ASC 시간대별 규칙 — 20시 이상 23시 미만) ──────────

INSERT INTO automation_rules
  (name, metric, operator, threshold, action, action_value, severity, scope,
   is_midnight_rule, time_start, time_end,
   threshold_type, threshold_multiplier, campaign_type_filter)
VALUES
  ('ASC 예산+30%: CPA 목표 이하 (20-23시)',
   'cpa', 'lte', 0, 'increase_budget', 0.3, 'medium', 'campaign',
   false, 20, 23, 'product_cpa', 1.0, 'ASC'),

  ('ASC 예산-10%: CPA 목표 5%↑ (20-23시)',
   'cpa', 'gt',  0, 'decrease_budget', 0.1, 'medium', 'campaign',
   false, 20, 23, 'product_cpa', 1.05, 'ASC'),

  ('ASC 예산-50%: CPA 목표 10%↑ (20-23시)',
   'cpa', 'gt',  0, 'decrease_budget', 0.5, 'medium', 'campaign',
   false, 20, 23, 'product_cpa', 1.1, 'ASC');

-- ── 캠페인 9~12시 ─────────────────────────────────────────────────────

INSERT INTO automation_rules
  (name, metric, operator, threshold, action, action_value, severity, scope,
   is_midnight_rule, time_start, time_end,
   threshold_type, threshold_multiplier, campaign_type_filter)
VALUES
  ('ASC 예산+15%: CPA 목표 이하 (9-12시)',
   'cpa', 'lte', 0, 'increase_budget', 0.15, 'medium', 'campaign',
   false, 9, 12, 'product_cpa', 1.0, 'ASC'),

  ('ASC 예산-10%: CPA 목표 5%↑ (9-12시)',
   'cpa', 'gt',  0, 'decrease_budget', 0.1, 'medium', 'campaign',
   false, 9, 12, 'product_cpa', 1.05, 'ASC'),

  ('ASC 예산=현재: CPA 목표 10%↑ (9-12시)',
   'cpa', 'gt',  0, 'set_budget_current', null, 'medium', 'campaign',
   false, 9, 12, 'product_cpa', 1.1, 'ASC');

-- ── 캠페인 16~20시 ────────────────────────────────────────────────────

INSERT INTO automation_rules
  (name, metric, operator, threshold, action, action_value, severity, scope,
   is_midnight_rule, time_start, time_end,
   threshold_type, threshold_multiplier, campaign_type_filter)
VALUES
  ('ASC 예산+15%: CPA 목표 이하 (16-20시)',
   'cpa', 'lte', 0, 'increase_budget', 0.15, 'medium', 'campaign',
   false, 16, 20, 'product_cpa', 1.0, 'ASC'),

  ('ASC 예산-10%: CPA 목표 5%↑ (16-20시)',
   'cpa', 'gt',  0, 'decrease_budget', 0.1, 'medium', 'campaign',
   false, 16, 20, 'product_cpa', 1.05, 'ASC'),

  ('ASC 예산=현재: CPA 목표 10%↑ (16-20시)',
   'cpa', 'gt',  0, 'set_budget_current', null, 'medium', 'campaign',
   false, 16, 20, 'product_cpa', 1.1, 'ASC');

-- ── 캠페인 12~16시 ────────────────────────────────────────────────────

INSERT INTO automation_rules
  (name, metric, operator, threshold, action, action_value, severity, scope,
   is_midnight_rule, time_start, time_end,
   threshold_type, threshold_multiplier, campaign_type_filter)
VALUES
  ('ASC 예산=현재: CPA 목표 5%↑ (12-16시)',
   'cpa', 'gt',  0, 'set_budget_current', null, 'medium', 'campaign',
   false, 12, 16, 'product_cpa', 1.05, 'ASC'),

  ('ASC OFF: CPA 목표 10%↑ (12-16시)',
   'cpa', 'gt',  0, 'pause', null, 'high', 'campaign',
   false, 12, 16, 'product_cpa', 1.1, 'ASC');

-- ── 광고세트 (scope: adset) — 캠페인과 동일 구조, campaign_type_filter='manual' ──

-- 광고세트 00시 규칙
INSERT INTO automation_rules
  (name, metric, operator, threshold, action, action_value, severity, scope,
   is_midnight_rule, threshold_type, threshold_multiplier, campaign_type_filter)
VALUES
  ('세트 ON: 7일CPA 목표 이하',
   'cpa', 'lte', 0, 'resume', null, 'medium', 'adset',
   true, 'product_cpa', 1.0, 'manual'),

  ('세트 ON: 7일CPA 목표 10% 이하',
   'cpa', 'lte', 0, 'resume', null, 'medium', 'adset',
   true, 'product_cpa', 1.1, 'manual'),

  ('세트 예산=전일: 7일CPA 목표 이하',
   'cpa', 'lte', 0, 'set_budget_yesterday', null, 'medium', 'adset',
   true, 'product_cpa', 1.0, 'manual'),

  ('세트 예산=전일x70%: 7일CPA 목표 5%↑',
   'cpa', 'gt',  0, 'set_budget_yesterday_70pct', null, 'medium', 'adset',
   true, 'product_cpa', 1.05, 'manual'),

  ('세트 예산=전일x50%: 7일CPA 목표 10%↑',
   'cpa', 'gt',  0, 'set_budget_yesterday_50pct', null, 'medium', 'adset',
   true, 'product_cpa', 1.1, 'manual');

-- 광고세트 6~9시
INSERT INTO automation_rules
  (name, metric, operator, threshold, action, action_value, severity, scope,
   is_midnight_rule, time_start, time_end,
   threshold_type, threshold_multiplier, campaign_type_filter)
VALUES
  ('세트 예산+30%: CPA 목표 이하 (6-9시)',
   'cpa', 'lte', 0, 'increase_budget', 0.3, 'medium', 'adset',
   false, 6, 9, 'product_cpa', 1.0, 'manual'),

  ('세트 예산-10%: CPA 목표 5%↑ (6-9시)',
   'cpa', 'gt',  0, 'decrease_budget', 0.1, 'medium', 'adset',
   false, 6, 9, 'product_cpa', 1.05, 'manual'),

  ('세트 예산-50%: CPA 목표 10%↑ (6-9시)',
   'cpa', 'gt',  0, 'decrease_budget', 0.5, 'medium', 'adset',
   false, 6, 9, 'product_cpa', 1.1, 'manual');

-- 광고세트 20~23시
INSERT INTO automation_rules
  (name, metric, operator, threshold, action, action_value, severity, scope,
   is_midnight_rule, time_start, time_end,
   threshold_type, threshold_multiplier, campaign_type_filter)
VALUES
  ('세트 예산+30%: CPA 목표 이하 (20-23시)',
   'cpa', 'lte', 0, 'increase_budget', 0.3, 'medium', 'adset',
   false, 20, 23, 'product_cpa', 1.0, 'manual'),

  ('세트 예산-10%: CPA 목표 5%↑ (20-23시)',
   'cpa', 'gt',  0, 'decrease_budget', 0.1, 'medium', 'adset',
   false, 20, 23, 'product_cpa', 1.05, 'manual'),

  ('세트 예산-50%: CPA 목표 10%↑ (20-23시)',
   'cpa', 'gt',  0, 'decrease_budget', 0.5, 'medium', 'adset',
   false, 20, 23, 'product_cpa', 1.1, 'manual');

-- 광고세트 9~12시
INSERT INTO automation_rules
  (name, metric, operator, threshold, action, action_value, severity, scope,
   is_midnight_rule, time_start, time_end,
   threshold_type, threshold_multiplier, campaign_type_filter)
VALUES
  ('세트 예산+15%: CPA 목표 이하 (9-12시)',
   'cpa', 'lte', 0, 'increase_budget', 0.15, 'medium', 'adset',
   false, 9, 12, 'product_cpa', 1.0, 'manual'),

  ('세트 예산-10%: CPA 목표 5%↑ (9-12시)',
   'cpa', 'gt',  0, 'decrease_budget', 0.1, 'medium', 'adset',
   false, 9, 12, 'product_cpa', 1.05, 'manual'),

  ('세트 예산=현재: CPA 목표 10%↑ (9-12시)',
   'cpa', 'gt',  0, 'set_budget_current', null, 'medium', 'adset',
   false, 9, 12, 'product_cpa', 1.1, 'manual');

-- 광고세트 16~20시
INSERT INTO automation_rules
  (name, metric, operator, threshold, action, action_value, severity, scope,
   is_midnight_rule, time_start, time_end,
   threshold_type, threshold_multiplier, campaign_type_filter)
VALUES
  ('세트 예산+15%: CPA 목표 이하 (16-20시)',
   'cpa', 'lte', 0, 'increase_budget', 0.15, 'medium', 'adset',
   false, 16, 20, 'product_cpa', 1.0, 'manual'),

  ('세트 예산-10%: CPA 목표 5%↑ (16-20시)',
   'cpa', 'gt',  0, 'decrease_budget', 0.1, 'medium', 'adset',
   false, 16, 20, 'product_cpa', 1.05, 'manual'),

  ('세트 예산=현재: CPA 목표 10%↑ (16-20시)',
   'cpa', 'gt',  0, 'set_budget_current', null, 'medium', 'adset',
   false, 16, 20, 'product_cpa', 1.1, 'manual');

-- 광고세트 12~16시
INSERT INTO automation_rules
  (name, metric, operator, threshold, action, action_value, severity, scope,
   is_midnight_rule, time_start, time_end,
   threshold_type, threshold_multiplier, campaign_type_filter)
VALUES
  ('세트 예산=현재: CPA 목표 5%↑ (12-16시)',
   'cpa', 'gt',  0, 'set_budget_current', null, 'medium', 'adset',
   false, 12, 16, 'product_cpa', 1.05, 'manual'),

  ('세트 OFF: CPA 목표 10%↑ (12-16시)',
   'cpa', 'gt',  0, 'pause', null, 'high', 'adset',
   false, 12, 16, 'product_cpa', 1.1, 'manual');

-- ────────────────────────────────────────────
-- 6. 001 트리거 조건 업데이트: low severity도 Slack 발송 (모든 severity)
-- ────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_notify_on_queue_insert ON action_queue;

CREATE TRIGGER trg_notify_on_queue_insert
  AFTER INSERT ON action_queue
  FOR EACH ROW
  EXECUTE FUNCTION trigger_slack_notify();
