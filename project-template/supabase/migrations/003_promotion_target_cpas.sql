-- 프로모션별 목표 CPA 테이블
CREATE TABLE IF NOT EXISTS promotion_target_cpas (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  promotion_name text NOT NULL,
  target_cpa  numeric NOT NULL,
  is_active   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE promotion_target_cpas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON promotion_target_cpas FOR ALL USING (true);
