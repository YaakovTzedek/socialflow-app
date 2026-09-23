import Link from 'next/link';
import '@/app/landing.css';
import { getMessages, localePath, type Locale } from '@/lib/i18n';
import { LoginLink } from './LoginLink';
import { slugFor, manychatPricingNav } from '@/lib/slugs';

/**
 * Chrome for the public pages that are not the landing: blog and pricing.
 * Server component, so these pages stay static and cheap to crawl.
 */
export function PublicShell({
  locale, title, lead, back, children,
}: {
  locale: Locale; title: string; lead?: string;
  back?: { href: string; label: string };
  children: React.ReactNode;
}) {
  const m = getMessages(locale);
  const p = (path: string) => localePath(locale, path);
  return (
    <div className="sf sfp">
      <div className="sf-aurora" aria-hidden="true">
        <i style={{ inset: '-10% auto auto -8%', width: 560, height: 560, background: 'radial-gradient(circle, rgba(131,58,180,.4), transparent 68%)' }} />
        <i style={{ inset: 'auto -12% -18% auto', width: 620, height: 620, background: 'radial-gradient(circle, rgba(225,48,108,.32), transparent 68%)' }} />
      </div>
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div className="sf-nav">
          <div className="sf-shell sf-nav-in">
            <Link href={p('/')} className="sf-brand" style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 800, fontSize: 21, color: '#fff', direction: 'ltr' }}>
              Social<span className="sf-grad-text">Flow</span>
            </Link>
            <div className="sf-nav-links" style={{ flex: 1 }}>
              <Link href={p('/blog')}>{m.blog.nav}</Link>
              <Link href={p('/pricing')}>{m.pricing.nav}</Link>
              <Link href={p(slugFor(locale, '/manychat-alternative'))}>{m.common.compareNav}</Link>
            </div>
            <LoginLink className="sf-nav-login">{m.common.login}</LoginLink>
            <Link href={p('/')} className="sf-btn sf-btn-primary sf-btn-sm sf-nav-cta">{m.beta.navCta}</Link>
          </div>
        </div>

        <div className="sf-shell sfp-head">
          {back && <Link href={back.href} className="sfp-back">{back.label}</Link>}
          <h1 className="sf-display sfp-title">{title}</h1>
          {lead && <p className="sfp-lead">{lead}</p>}
          <div className="sf-rule" />
        </div>

        <div className="sf-shell sfp-main">{children}</div>

        <div className="sf-footer">
          <div className="sf-shell" style={{ paddingBlock: 30, display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 15 }}>
            <Link href={p('/blog')}>{m.blog.nav}</Link>
            <Link href={p('/pricing')}>{m.pricing.nav}</Link>
            <Link href={p(slugFor(locale, '/manychat-alternative'))}>{m.common.compareNav}</Link>
            <Link href={p('/manychat-pricing')}>{manychatPricingNav(locale)}</Link>
            <Link href={p('/instagram-auto-responder')}>{m.common.autoResponderNav}</Link>
            <Link href={p('/terms')}>{m.landing.footerTerms}</Link>
            <Link href={p('/privacy')}>{m.landing.footerPrivacy}</Link>
            <span style={{ marginInlineStart: 'auto', color: '#8B7B99', fontSize: 14 }}>{m.landing.copyright}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
