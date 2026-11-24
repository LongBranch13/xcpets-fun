-- HatchBot state (Cloudflare D1 'hatchbot'). Applied by .github/workflows/hatchbot-worker.yml on every deploy (safe to re-run).
CREATE TABLE IF NOT EXISTS hits (ts INTEGER NOT NULL, user_id TEXT NOT NULL, chat_id TEXT NOT NULL, cmd TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS hits_ts ON hits (ts);
CREATE INDEX IF NOT EXISTS hits_user ON hits (user_id, ts);
CREATE TABLE IF NOT EXISTS rounds (chat_id TEXT PRIMARY KEY, pet_id INTEGER NOT NULL, species TEXT, name TEXT, ends INTEGER NOT NULL, started INTEGER);
CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT);
-- Opt-in wallet links (hatchbot/link.js, Nov 24 2026). PRIVATE: never published. A player adds a row by proving the wallet with /link
-- (a signed message) and removes it with /unlink. One Telegram account may link up to 10 wallets; a wallet belongs to one account.
CREATE TABLE IF NOT EXISTS links (wallet TEXT PRIMARY KEY, tg_id TEXT NOT NULL, username TEXT, first_name TEXT, at INTEGER NOT NULL, how TEXT);
CREATE INDEX IF NOT EXISTS links_tg ON links (tg_id);
CREATE TABLE IF NOT EXISTS link_codes (code TEXT PRIMARY KEY, tg_id TEXT NOT NULL, chat_id TEXT NOT NULL, username TEXT, first_name TEXT, exp INTEGER NOT NULL);
