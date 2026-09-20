import postgres from 'postgres';

/**
 * Postgres connection (Supabase, or any Postgres reachable over TCP).
 * Reads the connection string from DATABASE_URL or POSTGRES_URL.
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
// SOCIALFLOW_DATABASE_URL wins so the Supabase pooler URL can coexist with the
// DATABASE_URL/POSTGRES_URL that the (dead) Neon integration still injects.
const connectionString =
  process.env.SOCIALFLOW_DATABASE_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL || '';

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
  if (!sql) throw new Error('Database not configured (set DATABASE_URL).');
  if (initialized) return;

  await sql.unsafe(`CREATE SCHEMA IF NOT EXISTS "${schema.replace(/"/g, '')}"`);

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

  // Tracks comments already processed by the poller (dedupe across runs).
  await sql`
    CREATE TABLE IF NOT EXISTS processed_comments (
      automation_id TEXT NOT NULL,
      comment_id    TEXT NOT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (automation_id, comment_id)
    )
  `;

  // Raw log of every incoming webhook POST — for diagnosing delivery.
  await sql`
    CREATE TABLE IF NOT EXISTS webhook_events (
      id         SERIAL PRIMARY KEY,
      object     TEXT,
      body       TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
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
