import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getMessages, isLocale, localePath, prefixOf, DEFAULT_LOCALE, LOCALES, type Locale } from '@/lib/i18n';
import { PLAN_ORDER, PLAN_CATALOG, TRIAL, displayPrice, formatMoney, pricingForLocale, type PlanId } from '@/lib/plans';
import { SEO_BASE, alternatesFor } from '@/lib/seo';
import { PublicShell } from '@/components/PublicShell';

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  const locale: Locale = isLocale(params.locale) ? params.locale : DEFAULT_LOCALE;
  const m = getMessages(locale);
  const url = `${SEO_BASE}${prefixOf(locale)}/pricing`;
  return {
    title: m.pricing.title,
    description: m.pricing.description,
    alternates: { canonical: url, languages: alternatesFor('/pricing') },
    openGraph: { title: m.pricing.title, description: m.pricing.description, url, type: 'website' },
  };
}

export default function PricingPage({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) notFound();
  const locale = params.locale;
  const m = getMessages(locale);
  const P = m.pricing;
  const p = (path: string) => localePath(locale, path);
  const cfg = pricingForLocale(locale);
  const fmt = (n: number) => n.toLocaleString(locale === 'he' ? 'he-IL' : locale);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'SocialFlow',
    description: m.meta.description,
    offers: PLAN_ORDER.map((id) => {
      const plan = PLAN_CATALOG[id];
      const price = cfg.charge === 'ILS' ? plan.priceIls : plan.priceUsd;
      return { '@type': 'Offer', name: `SocialFlow ${plan.name}`, price: String(price), priceCurrency: cfg.charge, availability: 'https://schema.org/InStock', url: `${SEO_BASE}${prefixOf(locale)}/pricing` };
    }),
  };

  const limitLines = (id: PlanId) => {
    const l = PLAN_CATALOG[id].limits;
    return [
      l.activeAutomations === null ? P.limitAutomationsUnlimited : P.limitAutomations.replace('{n}', fmt(l.activeAutomations)),
      P.limitDms.replace('{n}', fmt(l.dmsPerMonth)),
      P.limitAccounts.replace('{n}', fmt(l.accounts)),
      P.limitSeats.replace('{n}', fmt(l.seats)),
      P.limitLogDays.replace('{n}', fmt(l.logDays)),
      l.mcp ? P.limitMcpYes : P.limitMcpNo,
      l.publishing ? P.limitPublishYes : P.limitPublishNo,
      l.branding ? P.limitBrandingYes : P.limitBrandingNo,
    ];
  };

  return (
    <PublicShell locale={locale} title={P.title} lead={P.description}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="sfp-currency">{P.chargedIn.replace('{currency}', cfg.charge)}{cfg.display ? ` ${P.localNote.replace('{currency}', cfg.display)}` : ''}</div>

      <div className="sfp-plans">
        {PLAN_ORDER.map((id) => {
          const plan = PLAN_CATALOG[id];
          const month = displayPrice(id, 'month', locale);
          const year = displayPrice(id, 'year', locale);
          const featured = id === 'pro';
          return (
            <div key={id} className={`sfp-plan${featured ? ' featured' : ''}`}>
              {featured && <span className="sfp-plan-tag">{P.popular}</span>}
              <div className="sfp-plan-name">{plan.name}</div>
              <div className="sfp-plan-price">
                {plan.priceIls === 0 ? <strong>{P.free}</strong> : <><strong>{month.main}</strong><span>{P.perMonth}</span></>}
              </div>
              {month.local && <div className="sfp-plan-local">{P.about.replace('{price}', month.local)}</div>}
              {plan.priceIls > 0 && <div className="sfp-plan-year">{P.orYear.replace('{price}', year.main)}</div>}
              <ul className="sfp-plan-limits">
                {limitLines(id).map((line) => <li key={line}>{line}</li>)}
              </ul>
              <Link href={p('/')} className={`sf-btn ${featured ? 'sf-btn-primary' : 'sf-btn-ghost'}`}>{m.beta.navCta}</Link>
            </div>
          );
        })}
      </div>

      <div className="sfp-trial">
        <div className="sfp-trial-title">{P.trialTitle}</div>
        <p>{P.trialText
          .replace('{days}', String(TRIAL.days))
          .replace('{price}', formatMoney(cfg.charge, cfg.charge === 'ILS' ? TRIAL.priceIls : TRIAL.priceUsd, locale))
          .replace('{plan}', PLAN_CATALOG[TRIAL.plan].name)}</p>
      </div>

      <section className="sfp-faq">
        <h2>{P.faqTitle}</h2>
        {P.faqs.map((f) => (
          <div key={f.q} className="sfp-faq-item">
            <h3>{f.q}</h3>
            <p>{f.a}</p>
          </div>
        ))}
      </section>
    </PublicShell>
  );
}
