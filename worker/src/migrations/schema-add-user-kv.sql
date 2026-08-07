-- 跨设备用户数据 KV 表（Issue #2 修复：作品集/昵称/引擎状态/仿真状态从 localStorage 迁到云端）
-- 按登录账号 (sub) 隔离，key 为用户数据键（portfolio / profile / sim_project / engine.activePath 等）。
-- 应用：wrangler d1 execute mes-learning --remote --file=./src/migrations/schema-add-user-kv.sql

CREATE TABLE IF NOT EXISTS user_kv (
  sub        TEXT    NOT NULL,
  k          TEXT    NOT NULL,
  v          TEXT    NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (sub, k)
);

CREATE INDEX IF NOT EXISTS idx_user_kv_sub ON user_kv(sub);
