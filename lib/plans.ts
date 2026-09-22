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
  /** Publishing posts and reels to Instagram and Facebook through MCP. */
  publishing: boolean;
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
    limits: { activeAutomations: 3, dmsPerMonth: 300, accounts: 1, seats: 1, logDays: 7, mcp: false, publishing: false, branding: true },
    blurb: 'Start without a card: 3 active automations and 300 private messages a month.',
  },
  creator: {
    tier: 'creator', name: 'Creator', sellable: true, priceIls: 49, priceIlsYear: 490, priceUsd: 12, priceUsdYear: 120,
    limits: { activeAutomations: null, dmsPerMonth: 3000, accounts: 2, seats: 1, logDays: 90, mcp: false, publishing: false, branding: false },
    blurb: 'For creators and small businesses: unlimited automations, 3,000 messages a month, no branding.',
  },
  pro: {
    tier: 'pro', name: 'Pro', sellable: true, priceIls: 99, priceIlsYear: 990, priceUsd: 24, priceUsdYear: 240,
    limits: { activeAutomations: null, dmsPerMonth: 20000, accounts: 5, seats: 3, logDays: 365, mcp: true, publishing: true, branding: false },
    blurb: 'For people who live on this: 20,000 messages, 5 accounts, and management from Claude and ChatGPT through MCP.',
  },
  agency: {
    tier: 'agency', name: 'Agency', sellable: true, priceIls: 249, priceIlsYear: 2490, priceUsd: 59, priceUsdYear: 590,
    limits: { activeAutomations: null, dmsPerMonth: 100000, accounts: 15, seats: 10, logDays: 365, mcp: true, publishing: true, branding: false },
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

/* ------------------------------------------------------------------------ */
/* Currency by country                                                        */
/* ------------------------------------------------------------------------ */

/**
 * What a visitor is charged, and what the page shows them.
 *
 * Only two currencies are actually charged: shekels in Israel and dollars
 * everywhere else, because those are the two the payment provider settles in.
 * A locale whose country uses a third currency still sees its own money, as an
 * indication next to the real figure, converted with the fixed rates below.
 *
 * The rates are deliberately fixed rather than fetched: a price that moves with
 * the exchange rate every time the page is loaded is a worse experience than a
 * round number that is occasionally a few percent off. Update them here.
 */
export type ChargeCurrency = 'ILS' | 'USD';
export type DisplayCurrency = 'ILS' | 'USD' | 'EUR' | 'HUF' | 'JPY';

export interface LocalePricing {
  /** The currency the customer's card is actually charged in. */
  charge: ChargeCurrency;
  /** The currency shown alongside, when the country uses a third one. */
  display?: Exclude<DisplayCurrency, 'ILS' | 'USD'>;
}

export const PRICING_BY_LOCALE: Record<string, LocalePricing> = {
  he: { charge: 'ILS' },
  en: { charge: 'USD' },
  ar: { charge: 'USD' },
  de: { charge: 'USD', display: 'EUR' },
  fr: { charge: 'USD', display: 'EUR' },
  it: { charge: 'USD', display: 'EUR' },
  es: { charge: 'USD', display: 'EUR' },
  hu: { charge: 'USD', display: 'HUF' },
  ja: { charge: 'USD', display: 'JPY' },
};

/** Indicative rates against one US dollar. Reviewed by hand, not fetched. */
export const USD_RATES: Record<Exclude<DisplayCurrency, 'ILS' | 'USD'>, number> = {
  EUR: 0.92,
  HUF: 360,
  JPY: 152,
};

const SYMBOL: Record<DisplayCurrency, string> = { ILS: '₪', USD: '$', EUR: '€', HUF: 'Ft', JPY: '¥' };

/** Round to something a price tag would actually show in that currency. */
function roundFor(currency: DisplayCurrency, value: number): number {
  if (value === 0) return 0;
  if (currency === 'HUF') return Math.round(value / 100) * 100;
  if (currency === 'JPY') return Math.round(value / 10) * 10;
  return Math.round(value);
}

export function formatMoney(currency: DisplayCurrency, amount: number, locale = 'en'): string {
  const n = roundFor(currency, amount);
  const num = n.toLocaleString(locale === 'he' ? 'he-IL' : locale);
  return currency === 'HUF' ? `${num} ${SYMBOL.HUF}` : `${SYMBOL[currency]}${num}`;
}

export function pricingForLocale(locale: string): LocalePricing {
  return PRICING_BY_LOCALE[locale] || { charge: 'USD' };
}

/** The headline price, in the currency the card is charged, plus the local indication. */
export function displayPrice(planId: PlanId, interval: Interval, locale: string) {
  const cfg = pricingForLocale(locale);
  const charged = priceFor(planId, interval, cfg.charge);
  const main = formatMoney(cfg.charge, charged, locale);
  if (!cfg.display || charged === 0) return { main, local: null as string | null, charge: cfg.charge };
  const usd = priceFor(planId, interval, 'USD');
  return { main, local: formatMoney(cfg.display, usd * USD_RATES[cfg.display], locale), charge: cfg.charge };
}
