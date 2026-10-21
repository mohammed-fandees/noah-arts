-- Username + password login for the studio (replaces Cloudflare Access).

CREATE TABLE studio_users (
  id            INTEGER PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,              -- "pbkdf2-sha256$<iterations>$<salt>$<hash>", see src/shared/password.ts
  created_at    INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Signed-in browsers. Only a SHA-256 of the cookie token is stored.
CREATE TABLE studio_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES studio_users (id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE INDEX studio_sessions_user ON studio_sessions (user_id);

-- Failed sign-ins per IP and per username, to slow down password guessing.
CREATE TABLE studio_login_failures (
  key          TEXT PRIMARY KEY,
  count        INTEGER NOT NULL,
  window_start INTEGER NOT NULL
);
