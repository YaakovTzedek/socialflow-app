import { randomBytes } from 'crypto';
import { sql, ensureSchema } from './db';

/**
 * Creator affiliate programme.
 *
 * The deal offered to creators: a personal link, and fifty percent of every
 * payment made by anyone who subscribes through it during their first twelve
 * months. Attribution is first touch and permanent: the first affiliate whose
 * link brought an account keeps it, so two partners can never claim the same
 * customer, and a later link does not steal an earlier one's work.
 *
 * The rate and the window live on the affiliate row rather than in code, so a
 * different deal for a different partner does not need a deployment.
 */
export const AFF_COOKIE = 'sf_aff';
/** How long a click keeps its claim on a visitor who has not signed up yet. */
export const AFF_COOKIE_DAYS = 90;

export interface Affiliate {
  code: string; name: string; phone: string | null; email: string | null; note: string | null;
  owner_id: string | null; rate_percent: number; months: number; status: string; clicks: number; created_at: string;
}

/** Readable, unambiguous codes: no O/0, no I/1, so a code read off a video works. */
export function generateCode(name: string): string {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 10);
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = randomBytes(4);
  let tail = '';
  for (let i = 0; i < 4; i++) tail += alphabet[bytes[i] % alphabet.length];
  return `${slug || 'partner'}${tail}`;
}

export function isValidCode(code: unknown): code is string {
  return typeof code === 'string' && /^[a-z0-9]{3,24}$/.test(code);
}

export async function getAffiliate(code: string): Promise<Affiliate | null> {
  await ensureSchema();
  const [row] = await sql!`SELECT * FROM affiliates WHERE code = ${code}`;
  return (row as Affiliate) || null;
}

export async function countClick(code: string): Promise<void> {
  await sql!`UPDATE affiliates SET clicks = clicks + 1 WHERE code = ${code} AND status = 'active'`;
}

/**
 * Bind an account to the affiliate who brought it. First touch wins, and the
 * binding is never overwritten, so this is safe to call on every login.
 */
export async function bindReferral(ownerId: string, code: string): Promise<void> {
  if (!isValidCode(code)) return;
  await ensureSchema();
  const aff = await getAffiliate(code);
  if (!aff || aff.status !== 'active' || aff.owner_id === ownerId) return;
  await sql!`
    INSERT INTO affiliate_referrals (owner_id, code) VALUES (${ownerId}, ${code})
    ON CONFLICT (owner_id) DO NOTHING`;
}

/**
 * Record what the affiliate earned on a payment, if the account was referred
 * and is still inside that affiliate's commission window.
 */
export async function recordCommission(opts: {
  ownerId: string; invoiceId: number | null; amountAgorot: number; currency: string;
}): Promise<void> {
  await ensureSchema();
  const [ref] = await sql!`SELECT code, first_seen_at FROM affiliate_referrals WHERE owner_id = ${opts.ownerId}`;
  if (!ref) return;
  const aff = await getAffiliate(ref.code);
  if (!aff || aff.status !== 'active') return;

  const windowEnds = new Date(ref.first_seen_at);
  windowEnds.setUTCMonth(windowEnds.getUTCMonth() + aff.months);
  if (Date.now() > windowEnds.getTime()) return;

  const commission = Math.round((opts.amountAgorot * aff.rate_percent) / 100);
  if (commission <= 0) return;
  await sql!`
    INSERT INTO affiliate_commissions (code, owner_id, invoice_id, amount_agorot, commission_agorot, currency)
    VALUES (${aff.code}, ${opts.ownerId}, ${opts.invoiceId}, ${opts.amountAgorot}, ${commission}, ${opts.currency})`;
}

/** What one partner sees on their own page: counts only, never customer names. */
export async function partnerStats(code: string) {
  await ensureSchema();
  const aff = await getAffiliate(code);
  if (!aff) return null;
  const [referrals] = await sql!`SELECT count(*)::int AS n FROM affiliate_referrals WHERE code = ${code}`;
  const totals = await sql!`
    SELECT currency,
           sum(commission_agorot)::bigint AS total,
           sum(commission_agorot) FILTER (WHERE paid_at IS NULL)::bigint AS pending
    FROM affiliate_commissions WHERE code = ${code} GROUP BY currency`;
  return {
    code: aff.code,
    name: aff.name,
    ratePercent: aff.rate_percent,
    months: aff.months,
    clicks: aff.clicks,
    referrals: referrals?.n ?? 0,
    earnings: (totals as any[]).map((t) => ({
      currency: t.currency,
      total: Number(t.total || 0) / 100,
      pending: Number(t.pending || 0) / 100,
    })),
  };
}
