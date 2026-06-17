import { neon } from '@neondatabase/serverless';

/**
 * Postgres connection (Neon / Vercel Postgres).
 * Reads the connection string from DATABASE_URL or POSTGRES_URL.
 * Vercel Postgres injects POSTGRES_URL automatically when you connect a DB.
 */
const connectionString =
  process.env.DATABASE_URL || process.env.POSTGRES_URL || '';

export const hasDb = !!connectionString;

export const sql = connectionString ? neon(connectionString) : null;

let initialized = false;

/** Create tables on first use (idempotent). */
export async function ensureSchema() {
  if (!sql) throw new Error('Database not configured (set DATABASE_URL).');
  if (initialized) return;

  await sql`
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
    )
  `;

  await sql`
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
    )
  `;

  // Tracks which commenters already got a DM for a given automation (once_per_user).
  await sql`
    CREATE TABLE IF NOT EXISTS dm_sent (
      automation_id TEXT NOT NULL,
      commenter_id  TEXT NOT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (automation_id, commenter_id)
    )
  `;

  // Stores the page access token per page so the webhook (no user session) can act.
  await sql`
    CREATE TABLE IF NOT EXISTS page_tokens (
      page_id      TEXT PRIMARY KEY,
      owner_id     TEXT NOT NULL,
      page_name    TEXT,
      access_token TEXT NOT NULL,
      ig_id        TEXT,
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  initialized = true;
}
