import postgres from 'postgres';

/**
 * Postgres connection (Supabase, or any Postgres reachable over TCP).
 * Reads the connection string from SOCIALFLOW_DATABASE_URL, and nothing else.
 *
 * History: the app started on Neon (Vercel Postgres) over its HTTP driver. On
 * 20.9.2026 the Neon free plan hit its quota ("HTTP status 402 ... exceeded the
 * quota") and every query — and therefore every route — failed for hours. The
 * 3-minute poller keeps a database awake around the clock, which is exactly
 * what a compute-hours quota punishes. Supabase has no such meter, so the app
 * moved there; postgres.js keeps the same `sql\`...\`` tagged-template shape the
 * routes already use (rows come back as an array).
 *
 * Supabase notes: use the transaction pooler URL (port 6543). Transaction
 * pooling does not support prepared statements, hence prepare:false. One
 * connection per serverless invocation is plenty and avoids pool exhaustion.
 */
// One variable, no fallback. This used to read DATABASE_URL and POSTGRES_URL as
// well, which the dead Neon integration still injected: if SOCIALFLOW_DATABASE_URL
// ever went missing the app would quietly connect to a different database and
// look healthy while serving nothing. On 22.9.2026 the database moved to its own
// Supabase project and the fallback came out with it. Missing means broken, loudly.
const connectionString = process.env.SOCIALFLOW_DATABASE_URL || '';

export const hasDb = !!connectionString;

/**
 * All SocialFlow tables live in their own schema so the app can share a
 * Postgres project with other products without name collisions (okdoc, for
 * one, has its own `automations` table). DB_SCHEMA defaults to "socialflow";
 * it is applied as the connection's search_path, so every query below stays
 * unqualified. Use the pooler in SESSION mode (port 5432) so the startup
 * search_path sticks; prepare:false also keeps transaction mode working.
 */
const schema = process.env.DB_SCHEMA || 'socialflow';

export const sql = connectionString
  ? postgres(connectionString, {
      ssl: 'require',
      prepare: false,
      max: 1,
      idle_timeout: 20,
      connect_timeout: 15,
      connection: { search_path: schema },
    })
  : null;

let initialized = false;

/** Create tables on first use (idempotent). */
export async function ensureSchema() {
  if (!sql) throw new Error('Database not configured (set SOCIALFLOW_DATABASE_URL).');
  if (initialized) return;
  const schemaName = schema.replace(/"/g, '');
  // One round trip for the whole DDL: every statement is IF NOT EXISTS, and the
  // database sits in another region, so nine sequential trips on each cold
  // start cost about a second on their own.
  await sql.unsafe(`
    CREATE SCHEMA IF NOT EXISTS "${schemaName}";
    CREATE TABLE IF NOT EXISTS automations (
      id              TEXT PRIMARY KEY,
      owner_id        TEXT NOT NULL,
      name            TEXT NOT NULL,
      platform        TEXT NOT NULL DEFAULT 'facebook',
      page_id         TEXT NOT NULL,
      page_name       TEXT,
      ig_id           TEXT,
      post_id         TEXT,
      post_scope      TEXT NOT NULL DEFAULT 'specific_post',
      keywords        TEXT[] NOT NULL DEFAULT '{}',
      match_type      TEXT NOT NULL DEFAULT 'contains',
      public_reply_enabled BOOLEAN NOT NULL DEFAULT true,
      public_replies  TEXT[] NOT NULL DEFAULT '{}',
      dm_enabled      BOOLEAN NOT NULL DEFAULT false,
      dm_message      TEXT,
      dm_link         TEXT,
      once_per_user   BOOLEAN NOT NULL DEFAULT true,
      status          TEXT NOT NULL DEFAULT 'active',
      trigger_count   INTEGER NOT NULL DEFAULT 0,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS trigger_logs (
      id              SERIAL PRIMARY KEY,
      automation_id   TEXT NOT NULL,
      platform        TEXT,
      post_id         TEXT,
      comment_id      TEXT,
      commenter_id    TEXT,
      commenter_name  TEXT,
      comment_text    TEXT,
      matched_keyword TEXT,
      public_reply_status TEXT,
      dm_status       TEXT,
      error_message   TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS dm_sent (
      automation_id TEXT NOT NULL,
      commenter_id  TEXT NOT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (automation_id, commenter_id)
    );
    CREATE TABLE IF NOT EXISTS processed_comments (
      automation_id TEXT NOT NULL,
      comment_id    TEXT NOT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (automation_id, comment_id)
    );
    CREATE TABLE IF NOT EXISTS webhook_events (
      id         SERIAL PRIMARY KEY,
      object     TEXT,
      body       TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS page_tokens (
      page_id      TEXT PRIMARY KEY,
      owner_id     TEXT NOT NULL,
      page_name    TEXT,
      access_token TEXT NOT NULL,
      ig_id        TEXT,
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS pages_cache (
      owner_id   TEXT PRIMARY KEY,
      payload    JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS post_cache (
      post_id    TEXT PRIMARY KEY,
      payload    JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS api_keys (
      key          TEXT PRIMARY KEY,
      owner_id     TEXT NOT NULL,
      label        TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_used_at TIMESTAMPTZ,
      revoked_at   TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS subscriptions (
      id                 SERIAL PRIMARY KEY,
      owner_id           TEXT NOT NULL,
      plan_id            TEXT NOT NULL,
      interval           TEXT NOT NULL DEFAULT 'month',
      status             TEXT NOT NULL DEFAULT 'active',
      trial_ends_at      TIMESTAMPTZ,
      current_period_end TIMESTAMPTZ,
      sumit_customer_id  TEXT,
      sumit_recurring_id TEXT,
      payer_name         TEXT,
      payer_email        TEXT,
      amount_agorot      INTEGER NOT NULL DEFAULT 0,
      currency           TEXT NOT NULL DEFAULT 'ILS',
      created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
      canceled_at        TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS subscriptions_owner_idx ON subscriptions (owner_id, status);
    CREATE TABLE IF NOT EXISTS invoices (
      id                SERIAL PRIMARY KEY,
      owner_id          TEXT NOT NULL,
      subscription_id   INTEGER,
      sumit_document_id TEXT,
      sumit_payment_id  TEXT,
      amount_agorot     INTEGER NOT NULL DEFAULT 0,
      currency          TEXT NOT NULL DEFAULT 'ILS',
      pdf_url           TEXT,
      status            TEXT NOT NULL DEFAULT 'paid',
      raw               JSONB,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS plan_overrides (
      owner_id   TEXT PRIMARY KEY,
      plan_id    TEXT NOT NULL,
      note       TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS post_stats (
      owner_id      TEXT NOT NULL,
      page_id       TEXT NOT NULL,
      platform      TEXT NOT NULL,
      post_id       TEXT NOT NULL,
      media_type    TEXT,
      caption       TEXT,
      permalink     TEXT,
      published_at  TIMESTAMPTZ,
      likes         INTEGER,
      comments      INTEGER,
      reach         INTEGER,
      impressions   INTEGER,
      saves         INTEGER,
      shares        INTEGER,
      views         INTEGER,
      followers     INTEGER,
      fetched_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (owner_id, post_id)
    );
    CREATE INDEX IF NOT EXISTS post_stats_owner_time_idx ON post_stats (owner_id, published_at DESC);
    CREATE INDEX IF NOT EXISTS post_stats_platform_idx ON post_stats (platform, media_type);
    CREATE TABLE IF NOT EXISTS affiliates (
      code        TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      phone       TEXT,
      email       TEXT,
      note        TEXT,
      owner_id    TEXT,
      rate_percent INTEGER NOT NULL DEFAULT 50,
      months      INTEGER NOT NULL DEFAULT 12,
      status      TEXT NOT NULL DEFAULT 'active',
      clicks      INTEGER NOT NULL DEFAULT 0,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS affiliate_referrals (
      owner_id    TEXT PRIMARY KEY,
      code        TEXT NOT NULL,
      first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS affiliate_referrals_code_idx ON affiliate_referrals (code);
    -- One row per click, so a partner can ask how last week went and not only
    -- how all of time went. The lifetime counter on the affiliates row stays:
    -- it predates this table and still answers the all-time question for the
    -- clicks that happened before rows were kept.
    CREATE TABLE IF NOT EXISTS affiliate_clicks (
      id          BIGSERIAL PRIMARY KEY,
      code        TEXT NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS affiliate_clicks_code_time_idx ON affiliate_clicks (code, created_at DESC);
    CREATE TABLE IF NOT EXISTS affiliate_commissions (
      id            BIGSERIAL PRIMARY KEY,
      code          TEXT NOT NULL,
      owner_id      TEXT NOT NULL,
      invoice_id    BIGINT,
      amount_agorot INTEGER NOT NULL,
      commission_agorot INTEGER NOT NULL,
      currency      TEXT NOT NULL,
      paid_at       TIMESTAMPTZ,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS affiliate_commissions_code_idx ON affiliate_commissions (code, created_at);
    CREATE TABLE IF NOT EXISTS segment_stats (
      segment        TEXT PRIMARY KEY,
      owners         INTEGER NOT NULL,
      triggers       INTEGER NOT NULL,
      leads          INTEGER NOT NULL,
      delivery_rate  INTEGER NOT NULL,
      link_rate      INTEGER,
      no_link_rate   INTEGER,
      peak_hour      INTEGER,
      best_format    TEXT,
      best_format_avg REAL,
      median_comments REAL,
      top_keywords   JSONB NOT NULL DEFAULT '[]'::jsonb,
      computed_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS beta_signups (
      id         BIGSERIAL PRIMARY KEY,
      phone      TEXT NOT NULL UNIQUE,
      role       TEXT NOT NULL,
      tool       TEXT NOT NULL,
      locale     TEXT NOT NULL DEFAULT 'en',
      source     TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS owner_prefs (
      owner_id   TEXT PRIMARY KEY,
      locale     TEXT NOT NULL DEFAULT 'en',
      segment    TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS locale TEXT;
    ALTER TABLE owner_prefs ADD COLUMN IF NOT EXISTS segment TEXT;
    ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS trial_reminded_at TIMESTAMPTZ;
    ALTER TABLE plan_overrides ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
    ALTER TABLE segment_stats ADD COLUMN IF NOT EXISTS best_format TEXT;
    ALTER TABLE segment_stats ADD COLUMN IF NOT EXISTS best_format_avg REAL;
    ALTER TABLE segment_stats ADD COLUMN IF NOT EXISTS median_comments REAL;
    ALTER TABLE trigger_logs ADD COLUMN IF NOT EXISTS dm_message_id TEXT;
    ALTER TABLE trigger_logs ADD COLUMN IF NOT EXISTS dm_attempts INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE trigger_logs ADD COLUMN IF NOT EXISTS dm_retryable BOOLEAN NOT NULL DEFAULT false;
    CREATE INDEX IF NOT EXISTS trigger_logs_dm_retry_idx ON trigger_logs (dm_status, dm_retryable, created_at);
    CREATE INDEX IF NOT EXISTS trigger_logs_automation_idx ON trigger_logs (automation_id, created_at DESC);
  `);
  initialized = true;
}
