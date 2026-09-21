/**
 * SocialFlow plan catalog: THE source of truth for plan names, prices and
 * limits. Pure data, no database, safe to import from client components.
 *
 * Modeled on okdoc's catalog: a PlanId is what the customer bought and never
 * changes meaning; to change terms later, add a new id and mark the old one
 * `sellable: false`, so existing subscribers keep the deal they pay for.
 *
 * Prices from the 21.9.2026 market study: ILS VAT included, USD for abroad.
 * The metered unit is private messages sent per calendar month (not contacts:
 * ManyChat's "success tax" is the number one complaint in the market).
 */

export type Tier = 'free' | 'creator' | 'pro' | 'agency';
export type PlanId = Tier;
export type Interval = 'month' | 'year';

export interface PlanLimits {
  /** Active automations at once. null = unlimited (paid tiers). */
  activeAutomations: number | null;
  /** Private messages (DMs) sent per calendar month. */
  dmsPerMonth: number;
  /** Connected pages / Instagram accounts. */
  accounts: number;
  seats: number;
  /** Activity log retention shown in the app. */
  logDays: number;
  /** MCP server for Claude / ChatGPT. */
  mcp: boolean;
  /** "Sent with SocialFlow" appended to every DM. */
  branding: boolean;
}

export interface CatalogEntry {
  tier: Tier;
  name: string;
  sellable: boolean;
  /** ILS per month, VAT included. */
  priceIls: number;
  /** ILS per year, VAT included (two months free). */
  priceIlsYear: number;
  priceUsd: number;
  priceUsdYear: number;
  limits: PlanLimits;
  blurb: string;
}

export const PLAN_CATALOG: Record<PlanId, CatalogEntry> = {
  free: {
    tier: 'free', name: 'Free', sellable: true, priceIls: 0, priceIlsYear: 0, priceUsd: 0, priceUsdYear: 0,
    limits: { activeAutomations: 3, dmsPerMonth: 300, accounts: 1, seats: 1, logDays: 7, mcp: false, branding: true },
    blurb: 'Start without a card: 3 active automations and 300 private messages a month.',
  },
  creator: {
    tier: 'creator', name: 'Creator', sellable: true, priceIls: 49, priceIlsYear: 490, priceUsd: 12, priceUsdYear: 120,
    limits: { activeAutomations: null, dmsPerMonth: 3000, accounts: 2, seats: 1, logDays: 90, mcp: false, branding: false },
    blurb: 'For creators and small businesses: unlimited automations, 3,000 messages a month, no branding.',
  },
  pro: {
    tier: 'pro', name: 'Pro', sellable: true, priceIls: 99, priceIlsYear: 990, priceUsd: 24, priceUsdYear: 240,
    limits: { activeAutomations: null, dmsPerMonth: 20000, accounts: 5, seats: 3, logDays: 365, mcp: true, branding: false },
    blurb: 'For people who live on this: 20,000 messages, 5 accounts, and management from Claude and ChatGPT through MCP.',
  },
  agency: {
    tier: 'agency', name: 'Agency', sellable: true, priceIls: 249, priceIlsYear: 2490, priceUsd: 59, priceUsdYear: 590,
    limits: { activeAutomations: null, dmsPerMonth: 100000, accounts: 15, seats: 10, logDays: 365, mcp: true, branding: false },
    blurb: 'For agencies: 15 accounts, 10 users, 100,000 messages a month.',
  },
};

/** The card-on-file trial: Pro for 30 days at ₪1, then the monthly price unless cancelled. */
export const TRIAL = { plan: 'pro' as PlanId, days: 30, priceIls: 1, priceUsd: 1 };

export const PLAN_ORDER: PlanId[] = ['free', 'creator', 'pro', 'agency'];

export function planOf(id: string | null | undefined): CatalogEntry {
  return PLAN_CATALOG[(id as PlanId) in PLAN_CATALOG ? (id as PlanId) : 'free'];
}

export function priceFor(id: PlanId, interval: Interval, currency: 'ILS' | 'USD') {
  const p = PLAN_CATALOG[id];
  if (currency === 'USD') return interval === 'year' ? p.priceUsdYear : p.priceUsd;
  return interval === 'year' ? p.priceIlsYear : p.priceIls;
}

export function fmtIls(n: number) { return `₪${n.toLocaleString('he-IL')}`; }
