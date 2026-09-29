/**
 * Account events for the owner's admin area: logins, impersonation, and the
 * customer actions that change what SocialFlow does for them. Best effort:
 * nothing a customer does may fail because this insert failed.
 *
 * Kinds in use: login, impersonation_start, impersonation_stop,
 * impersonation_blocked, automation_created, automation_updated,
 * automation_deleted, subscription_started, subscription_canceled,
 * mcp_key_created, mcp_key_revoked.
 */
import { sql, hasDb, ensureSchema } from './db';

export async function recordEvent(ownerId: string | null | undefined, kind: string, detail: Record<string, unknown> = {}, actorId?: string | null): Promise<void> {
  if (!hasDb || !ownerId) return;
  try {
    await ensureSchema();
    await sql!`
      INSERT INTO audit_events (owner_id, actor_id, kind, detail)
      VALUES (${ownerId}, ${actorId ?? ownerId}, ${kind}, ${sql!.json(detail as any)})`;
  } catch { /* best effort */ }
}

// Last seen, written at most every ten minutes per account per warm function,
// so an app page render almost never pays a database round trip for it.
const SEEN_EVERY_MS = 10 * 60 * 1000;
const lastTouch = new Map<string, number>();

export async function touchSeen(ownerId: string | null | undefined, name?: string | null): Promise<void> {
  if (!hasDb || !ownerId) return;
  const now = Date.now();
  if (now - (lastTouch.get(ownerId) || 0) < SEEN_EVERY_MS) return;
  lastTouch.set(ownerId, now);
  if (lastTouch.size > 2000) lastTouch.delete(lastTouch.keys().next().value as string);
  try {
    await ensureSchema();
    await sql!`
      INSERT INTO app_users (owner_id, name, last_seen_at) VALUES (${ownerId}, ${name || null}, now())
      ON CONFLICT (owner_id) DO UPDATE SET last_seen_at = now(), name = COALESCE(EXCLUDED.name, app_users.name)`;
  } catch { /* best effort */ }
}

/** A Facebook login: the account's name, first and last login, and a login event. */
export async function recordLogin(ownerId: string, name: string | null): Promise<void> {
  if (!hasDb) return;
  try {
    await ensureSchema();
    await sql!`
      INSERT INTO app_users (owner_id, name, first_login_at, last_login_at, last_seen_at, login_count)
      VALUES (${ownerId}, ${name}, now(), now(), now(), 1)
      ON CONFLICT (owner_id) DO UPDATE SET
        name = COALESCE(EXCLUDED.name, app_users.name),
        first_login_at = COALESCE(app_users.first_login_at, now()),
        last_login_at = now(), last_seen_at = now(),
        login_count = app_users.login_count + 1`;
  } catch { /* best effort */ }
  await recordEvent(ownerId, 'login', {});
}
