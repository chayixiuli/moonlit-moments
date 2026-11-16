CREATE TABLE IF NOT EXISTS letters (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL UNIQUE,
  nickname TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0, 1))
);
CREATE INDEX IF NOT EXISTS letters_created ON letters(created_at);
