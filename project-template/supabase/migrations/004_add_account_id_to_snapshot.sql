-- campaigns_snapshot에 account_id 컬럼 추가
ALTER TABLE campaigns_snapshot
  ADD COLUMN IF NOT EXISTS account_id text;

CREATE INDEX IF NOT EXISTS idx_snapshot_account_id ON campaigns_snapshot(account_id);
