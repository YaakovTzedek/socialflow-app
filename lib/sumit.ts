/**
 * Sumit (OfficeGuy) billing, server-side only: it reads the private API key.
 * Card data never touches this server: the browser tokenizes the card straight
 * with Sumit (creditguy/vault/tokenizesingleuse) and sends us a SingleUseToken.
 *
 * Subscriptions are Sumit standing orders (הוראת קבע): Sumit owns the schedule,
 * charges every cycle and emails the tax invoice. The ₪1 trial is two items in
 * one standing order: ₪1 once now, then the plan price starting in 30 days.
 *
 * BILLING_TEST_MODE=true → AuthoriseOnly (authorizes, creates no real standing
 * order, no real tax document). Flip it only when the real keys are in place.
 */
import { PLAN_CATALOG, TRIAL, priceFor, type Interval, type PlanId } from './plans';
import { INVOICE_LANG, isLocale, type Locale } from './i18n/config';

const SUMIT_BASE = 'https://api.sumit.co.il';

export const billingTestMode = () => process.env.BILLING_TEST_MODE !== 'false';
export const billingConfigured = () => !!(process.env.SUMIT_COMPANY_ID && process.env.SUMIT_API_KEY);

function credentials() {
  const CompanyID = Number(process.env.SUMIT_COMPANY_ID);
  const APIKey = process.env.SUMIT_API_KEY;
  if (!CompanyID || !APIKey) throw new Error('billing_not_configured: SUMIT_COMPANY_ID / SUMIT_API_KEY missing');
  return { CompanyID, APIKey };
}

function plusDays(days: number) {
  const d = new Date(); d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export interface SubscribeResult {
  success: true;
  recurringId: string | null;
  customerId: string | null;
  paymentId: string | null;
  documentId: string | null;
  pdfUrl: string | null;
  amount: number;
  currency: string;
  raw: unknown;
}

export async function createSubscription(opts: {
  planId: PlanId; interval: Interval; currency: 'ILS' | 'USD'; trial: boolean; locale?: string;
  singleUseToken: string; payerName: string; payerEmail: string; payerPhone?: string;
}): Promise<SubscribeResult | { success: false; error: string; declined?: boolean }> {
  const plan = PLAN_CATALOG[opts.planId];
  const price = priceFor(opts.planId, opts.interval, opts.currency);
  const months = opts.interval === 'year' ? 12 : 1;
  const testMode = billingTestMode();
  const locale: Locale = isLocale(opts.locale) ? opts.locale : 'en';
  const he = locale === 'he';
  const label = `SocialFlow ${plan.name} (${opts.interval === 'year' ? (he ? 'שנתי' : 'yearly') : (he ? 'חודשי' : 'monthly')})`;

  const items = opts.trial
    ? [
        { Item: { Name: `SocialFlow ${plan.name}: ${he ? '30 ימי ניסיון' : '30-day trial'}`, SearchMode: 0 }, Quantity: 1, UnitPrice: opts.currency === 'USD' ? TRIAL.priceUsd : TRIAL.priceIls, Currency: opts.currency, Duration_Days: TRIAL.days, Recurrence: 1, Description: he ? 'חודש ראשון' : 'First month' },
        { Item: { Name: label, SearchMode: 0 }, Quantity: 1, UnitPrice: price, Currency: opts.currency, Date_Start: plusDays(TRIAL.days), Duration_Months: months, Recurrence: 0 },
      ]
    : [{ Item: { Name: label, SearchMode: 0 }, Quantity: 1, UnitPrice: price, Currency: opts.currency, Duration_Months: months, Recurrence: 0 }];

  const res = await fetch(`${SUMIT_BASE}/billing/recurring/charge/`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      Credentials: credentials(),
      Customer: { Name: opts.payerName, EmailAddress: opts.payerEmail, Phone: opts.payerPhone || '', SearchMode: 0 },
      SingleUseToken: opts.singleUseToken,
      Items: items,
      VATIncluded: true,
      DocumentType: 'InvoiceAndReceipt',
      DocumentLanguage: INVOICE_LANG[locale],
      UpdateCustomerByEmail: !testMode,
      UpdateCustomerByEmail_AttachDocument: !testMode,
      AuthoriseOnly: testMode,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (data.Status !== 0) return { success: false, error: data.UserErrorMessage || `Sumit status ${data.Status}` };
  const payment = data.Data?.Payment;
  if (payment && payment.ValidPayment === false) return { success: false, error: payment.StatusDescription || (he ? 'החיוב נדחה' : 'The charge was declined'), declined: true };
  const ids = data.Data?.RecurringCustomerItemIDs as (number | string)[] | undefined;
  return {
    success: true,
    recurringId: ids && ids[0] != null ? String(ids[0]) : null,
    customerId: data.Data?.CustomerID != null ? String(data.Data.CustomerID) : null,
    paymentId: payment?.ID != null ? String(payment.ID) : null,
    documentId: data.Data?.DocumentID != null ? String(data.Data.DocumentID) : null,
    pdfUrl: (data.Data?.DocumentDownloadURL as string) || null,
    amount: opts.trial ? (opts.currency === 'USD' ? TRIAL.priceUsd : TRIAL.priceIls) : price,
    currency: opts.currency,
    raw: data.Data,
  };
}

export async function cancelRecurring(opts: { recurringId: string; customerId?: string | null; payerEmail?: string | null }) {
  const customer = opts.customerId ? { ID: Number(opts.customerId), SearchMode: 0 } : { EmailAddress: opts.payerEmail || '', SearchMode: 1 };
  const res = await fetch(`${SUMIT_BASE}/billing/recurring/cancel/`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ Credentials: credentials(), Customer: customer, RecurringCustomerItemID: Number(opts.recurringId) }),
  });
  const data = await res.json().catch(() => ({}));
  return data.Status === 0 ? { success: true as const } : { success: false as const, error: data.UserErrorMessage || `Status ${data.Status}` };
}
