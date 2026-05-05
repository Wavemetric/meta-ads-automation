-- ────────────────────────────────────────────
-- 1. 광고 성과 스냅샷 (1시간마다 적재)
-- ────────────────────────────────────────────
CREATE TABLE campaigns_snapshot (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id     text NOT NULL,
  campaign_name   text,
  adset_id        text,
  adset_name      text,
  spend           numeric(12,2) DEFAULT 0,
  impressions     integer DEFAULT 0,
  clicks          integer DEFAULT 0,
  conversions     integer DEFAULT 0,
  cpa             numeric(12,2),          -- spend / conversions
  ctr             numeric(8,4),           -- clicks / impressions * 100
  roas            numeric(8,4),           -- revenue / spend
  revenue         numeric(12,2) DEFAULT 0,
  captured_at     timestamptz DEFAULT now()
);

CREATE INDEX idx_snapshot_campaign_id ON campaigns_snapshot(campaign_id);
CREATE INDEX idx_snapshot_captured_at ON campaigns_snapshot(captured_at DESC);

-- ────────────────────────────────────────────
-- 2. 자동화 규칙 정의
-- ────────────────────────────────────────────
CREATE TABLE automation_rules (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name            text NOT NULL,
  description     text,
  metric          text NOT NULL,          -- 'cpa' | 'roas' | 'ctr' | 'spend' | 'impressions'
  operator        text NOT NULL,          -- 'gt' | 'lt' | 'gte' | 'lte' | 'eq'
  threshold       numeric NOT NULL,
  action          text NOT NULL,          -- 'pause' | 'resume' | 'increase_budget' | 'decrease_budget' | 'replace_creative'
  action_value    numeric,                -- 예산 조정 비율 (0.1 = +10%)
  severity        text NOT NULL DEFAULT 'low',  -- 'low' | 'medium' | 'high'
  -- low: 자동실행 / medium: 대시보드 승인 / high: Slack 즉시 알림 + 승인
  scope           text DEFAULT 'campaign', -- 'campaign' | 'adset' | 'creative'
  is_active       boolean DEFAULT true,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- 기본 규칙 시드 데이터
INSERT INTO automation_rules (name, metric, operator, threshold, action, action_value, severity) VALUES
  ('CPA 목표 초과 10%', 'cpa', 'gt', 33000, 'decrease_budget', 0.1, 'low'),
  ('CPA 목표 초과 30%', 'cpa', 'gt', 39000, 'pause', null, 'high'),
  ('ROAS 미달', 'roas', 'lt', 2.0, 'decrease_budget', 0.2, 'medium'),
  ('CTR 낮음', 'ctr', 'lt', 0.5, 'replace_creative', null, 'medium'),
  ('일 예산 소진율 초과', 'spend', 'gt', 150000, 'pause', null, 'high');

-- ────────────────────────────────────────────
-- 3. 실행 대기 큐
-- ────────────────────────────────────────────
CREATE TABLE action_queue (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_id           uuid REFERENCES automation_rules(id),
  campaign_id       text NOT NULL,
  campaign_name     text,
  proposed_change   jsonb NOT NULL,
  -- 예시: {"action": "decrease_budget", "current": 100000, "proposed": 90000, "reason": "CPA 35000 > threshold 33000"}
  severity          text NOT NULL,
  status            text NOT NULL DEFAULT 'pending',
  -- 'pending' | 'approved' | 'rejected' | 'executed' | 'failed'
  approved_by       text,
  note              text,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE INDEX idx_queue_status ON action_queue(status);
CREATE INDEX idx_queue_created_at ON action_queue(created_at DESC);

-- ────────────────────────────────────────────
-- 4. 실행 이력 로그
-- ────────────────────────────────────────────
CREATE TABLE execution_log (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  action_queue_id   uuid REFERENCES action_queue(id),
  meta_api_response jsonb,
  result            text NOT NULL,        -- 'success' | 'failed'
  error_message     text,
  executed_at       timestamptz DEFAULT now()
);

-- ────────────────────────────────────────────
-- 5. 소재 성과 트래킹
-- ────────────────────────────────────────────
CREATE TABLE creatives (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  creative_id     text UNIQUE NOT NULL,
  campaign_id     text,
  adset_id        text,
  name            text,
  type            text,                   -- 'image' | 'video' | 'carousel'
  thumbnail_url   text,
  ctr             numeric(8,4),
  cpm             numeric(12,2),
  cvr             numeric(8,4),
  spend           numeric(12,2),
  fatigue_score   integer DEFAULT 0,      -- 0~100, 높을수록 교체 필요
  is_active       boolean DEFAULT true,
  updated_at      timestamptz DEFAULT now()
);

-- ────────────────────────────────────────────
-- 6. updated_at 자동 갱신 트리거
-- ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_rules_updated_at
  BEFORE UPDATE ON automation_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_queue_updated_at
  BEFORE UPDATE ON action_queue
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ────────────────────────────────────────────
-- 7. Supabase Edge Function 트리거
--    action_queue INSERT 시 → notify-slack 호출
-- ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trigger_slack_notify()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM net.http_post(
    url := current_setting('app.edge_function_url') || '/notify-slack',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := row_to_json(NEW)::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_notify_on_queue_insert
  AFTER INSERT ON action_queue
  FOR EACH ROW
  WHEN (NEW.severity IN ('medium', 'high'))
  EXECUTE FUNCTION trigger_slack_notify();

-- ────────────────────────────────────────────
-- 8. 오래된 스냅샷 자동 삭제 (90일)
-- ────────────────────────────────────────────
SELECT cron.schedule(
  'cleanup-old-snapshots',
  '0 3 * * *',
  $$DELETE FROM campaigns_snapshot WHERE captured_at < now() - interval '90 days'$$
);
