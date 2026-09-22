/**
 * Server-side plan resolution and usage metering.
 *
 * Plan precedence: admin override (plan_overrides) > the newest subscription
 * that is trialing or active > free. Usage comes straight from trigger_logs,
 * so what the customer sees on /billing is exactly what the poller counted.
 */
import { sql, ensureSchema } from './db';
import { PLAN_CATALOG, planOf, type CatalogEntry, type PlanId } from './plans';

export interface Subscription {
  id: number;
  owner_id: string;
  plan_id: PlanId;
  interval: 'month' | 'year';
  status: 'trialing' | 'active' | 'canceled' | 'past_due';
  trial_ends_at: string | null;
  current_period_end: string | null;
  sumit_customer_id: string | null;
  sumit_recurring_id: string | null;
  payer_name: string | null;
  payer_email: string | null;
  amount_agorot: number;
  currency: string;
  created_at: string;
  canceled_at: string | null;
}

export interface Entitlement {
  planId: PlanId;
  plan: CatalogEntry;
  source: 'override' | 'subscription' | 'free';
  subscription: Subscription | null;
}

/**
 * While the closed beta runs, the MCP connection is open on every plan.
 * It is the thing beta testers are invited for, so gating it behind Pro during
 * the beta would hand them an account that cannot do what they were promised.
 * Clear CLOSED_BETA when the product opens and the catalog limits apply again.
 */
function withBeta(plan: CatalogEntry): CatalogEntry {
  if (process.env.CLOSED_BETA !== 'true' || plan.limits.mcp) return plan;
  return { ...plan, limits: { ...plan.limits, mcp: true } };
}

export function monthStart(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export async function getEntitlement(ownerId: string): Promise<Entitlement> {
  await ensureSchema();
  const [ov] = await sql!`
    SELECT plan_id FROM plan_overrides
    WHERE owner_id = ${ownerId} AND (expires_at IS NULL OR expires_at > now())`;
  if (ov && ov.plan_id in PLAN_CATALOG) {
    return { planId: ov.plan_id as PlanId, plan: withBeta(planOf(ov.plan_id)), source: 'override', subscription: null };
  }
  const [sub] = await sql!`
    SELECT * FROM subscriptions
    WHERE owner_id = ${ownerId} AND status IN ('trialing', 'active')
    ORDER BY created_at DESC LIMIT 1`;
  if (sub) {
    // A cancelled trial/paid period stays valid until its end date.
    return { planId: sub.plan_id as PlanId, plan: withBeta(planOf(sub.plan_id)), source: 'subscription', subscription: sub as Subscription };
  }
  const [grace] = await sql!`
    SELECT * FROM subscriptions
    WHERE owner_id = ${ownerId} AND status = 'canceled' AND current_period_end > now()
    ORDER BY current_period_end DESC LIMIT 1`;
  if (grace) {
    return { planId: grace.plan_id as PlanId, plan: withBeta(planOf(grace.plan_id)), source: 'subscription', subscription: grace as Subscription };
  }
  return { planId: 'free', plan: withBeta(PLAN_CATALOG.free), source: 'free', subscription: null };
}

/** DMs sent this calendar month across all of the owner's automations. */
export async function dmsThisMonth(ownerId: string): Promise<number> {
  const [row] = await sql!`
    SELECT count(*)::int AS n
    FROM trigger_logs l JOIN automations a ON a.id = l.automation_id
    WHERE a.owner_id = ${ownerId} AND l.dm_status = 'sent' AND l.created_at >= ${monthStart()}`;
  return row?.n ?? 0;
}

export async function activeAutomations(ownerId: string): Promise<number> {
  const [row] = await sql!`SELECT count(*)::int AS n FROM automations WHERE owner_id = ${ownerId} AND status = 'active'`;
  return row?.n ?? 0;
}

export async function connectedAccounts(ownerId: string): Promise<number> {
  const [row] = await sql!`SELECT count(DISTINCT page_id)::int AS n FROM automations WHERE owner_id = ${ownerId}`;
  return row?.n ?? 0;
}

export interface Usage {
  dmsUsed: number;
  dmsLimit: number;
  activeAutomations: number;
  activeAutomationsLimit: number | null;
  accounts: number;
  accountsLimit: number;
  resetsAt: string;
}

export async function getUsage(ownerId: string, plan: CatalogEntry): Promise<Usage> {
  const [dms, autos, accounts] = await Promise.all([dmsThisMonth(ownerId), activeAutomations(ownerId), connectedAccounts(ownerId)]);
  const next = monthStart(); next.setUTCMonth(next.getUTCMonth() + 1);
  return {
    dmsUsed: dms, dmsLimit: plan.limits.dmsPerMonth,
    activeAutomations: autos, activeAutomationsLimit: plan.limits.activeAutomations,
    accounts, accountsLimit: plan.limits.accounts,
    resetsAt: next.toISOString(),
  };
}

/** Can this owner activate one more automation? (null reason = yes) */
export async function automationActivationBlock(ownerId: string, excludingId?: string): Promise<{ reason: 'automations' | 'accounts'; limit: number; plan: PlanId } | null> {
  const ent = await getEntitlement(ownerId);
  const cap = ent.plan.limits.activeAutomations;
  if (cap !== null) {
    const [row] = excludingId
      ? await sql!`SELECT count(*)::int AS n FROM automations WHERE owner_id = ${ownerId} AND status = 'active' AND id <> ${excludingId}`
      : await sql!`SELECT count(*)::int AS n FROM automations WHERE owner_id = ${ownerId} AND status = 'active'`;
    if ((row?.n ?? 0) >= cap) return { reason: 'automations', limit: cap, plan: ent.planId };
  }
  return null;
}

/** Owners whose monthly DM quota is exhausted (the poller skips their automations). */
export async function quotaExhaustedOwners(ownerIds: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  const uniq = Array.from(new Set(ownerIds));
  if (!uniq.length) return out;
  const rows = await sql!`
    SELECT a.owner_id, count(*)::int AS n
    FROM trigger_logs l JOIN automations a ON a.id = l.automation_id
    WHERE a.owner_id = ANY(${uniq}) AND l.dm_status = 'sent' AND l.created_at >= ${monthStart()}
    GROUP BY a.owner_id`;
  const used = new Map<string, number>(rows.map((r: any) => [r.owner_id, r.n]));
  for (const owner of uniq) {
    const ent = await getEntitlement(owner);
    if ((used.get(owner) ?? 0) >= ent.plan.limits.dmsPerMonth) out.add(owner);
  }
  return out;
}
