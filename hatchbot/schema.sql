-- HatchBot state (Cloudflare D1 'hatchbot'). Applied by .github/workflows/hatchbot-worker.yml on every deploy (safe to re-run).
CREATE TABLE IF NOT EXISTS hits (ts INTEGER NOT NULL, user_id TEXT NOT NULL, chat_id TEXT NOT NULL, cmd TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS hits_ts ON hits (ts);
CREATE INDEX IF NOT EXISTS hits_user ON hits (user_id, ts);
CREATE TABLE IF NOT EXISTS rounds (chat_id TEXT PRIMARY KEY, pet_id INTEGER NOT NULL, species TEXT, name TEXT, ends INTEGER NOT NULL, started INTEGER);
CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT);
