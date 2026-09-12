CREATE TABLE IF NOT EXISTS olsera_token_cache (
  id integer PRIMARY KEY DEFAULT 1,
  access_token text NOT NULL,
  refresh_token text,
  expires_at timestamptz NOT NULL,
  refresh_expires_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE olsera_token_cache ENABLE ROW LEVEL SECURITY;

-- No CRUD policies: this table is only accessed server-side via the service role key.
-- RLS with no policies means the anon/authenticated roles cannot read or write it.

INSERT INTO olsera_token_cache (id, access_token, expires_at)
VALUES (1, '', '1970-01-01T00:00:00Z')
ON CONFLICT (id) DO NOTHING;
