'use client';
import { LoginLink } from './LoginLink';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useI18n } from './I18nProvider';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * App chrome: fixed sidebar (logo, nav, "connect another account" card, status
 * line) and a sticky topbar (screen title, search, language, user).
 */

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'SF';
  return parts.slice(0, 2).map((p) => p[0]).join('');
}

function Logo() {
  return (
    <svg width="38" height="27" viewBox="0 0 112 80" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="sfa-lg1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#833ab4" /><stop offset="1" stopColor="#E1306C" /></linearGradient>
        <linearGradient id="sfa-lg2" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#E1306C" /><stop offset="1" stopColor="#f77737" /></linearGradient>
      </defs>
      <path d="M6 16c0-6 5-11 11-11h27c6 0 11 5 11 11v18c0 6-5 11-11 11H28l-11 10V45c-6 0-11-5-11-11V16z" fill="url(#sfa-lg1)" />
      <circle cx="20" cy="26" r="3.6" fill="#140c1c" /><circle cx="31" cy="26" r="3.6" fill="#140c1c" /><circle cx="42" cy="26" r="3.6" fill="#140c1c" />
      <path d="M34 47c14 12 22 4 34 4" stroke="url(#sfa-lg2)" strokeWidth="9" strokeLinecap="round" fill="none" opacity=".85" />
      <path d="M60 22c0-6 5-11 11-11h24c6 0 11 5 11 11v22c0 6-5 11-11 11h-4l-10 9v-9h-10c-6 0-11-5-11-11V22z" fill="url(#sfa-lg2)" />
      <circle cx="83" cy="28" r="6" fill="#140c1c" /><path d="M72 46c1.6-7 5.6-10.5 11-10.5S92.4 39 94 46H72z" fill="#140c1c" />
    </svg>
  );
}

export default function AppShell({ userName, title, children }: { userName: string; title: string; children: React.ReactNode }) {
  const { m, p } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const [q, setQ] = useState('');
  const NAV: { href: string; label: string; icon: string }[] = [
    { href: '/dashboard', label: m.nav.dashboard, icon: '⌂' },
    { href: '/automations', label: m.nav.automations, icon: '⚡' },
    { href: '/brain', label: m.nav.brain, icon: '◇' },
    { href: '/logs', label: m.nav.logs, icon: '☰' },
    { href: '/posts', label: m.nav.posts, icon: '◎' },
    { href: '/mcp', label: m.nav.mcp, icon: '⇄' },
    { href: '/billing', label: m.nav.billing, icon: '◈' },
  ];
  const [l1, l2] = m.shell.sideCardTitle.split('\n');

  return (
    <div className="sfa">
      <aside className="sfa-side">
        <div className="sfa-logo"><Logo /><span className="sfa-wordmark">Social<b>Flow</b></span></div>
        <nav className="sfa-nav">
          {NAV.map((n) => (
            <Link key={n.href} href={p(n.href)} className={pathname?.includes(n.href) ? 'active' : ''}>
              <span><i>{n.icon}</i>{n.label}</span>
            </Link>
          ))}
        </nav>
        <div className="sfa-side-foot">
          <div className="sfa-side-card">
            <div className="sfa-h">{l1}<br />{l2}</div>
            <p>{m.shell.sideCardText}</p>
            <LoginLink>{m.common.connectAccount}</LoginLink>
          </div>
          <div className="sfa-status"><span className="sfa-dot" />{m.common.connectedToMeta}</div>
        </div>
      </aside>

      <div className="sfa-main">
        <header className="sfa-top">
          <div className="sfa-title">{title}</div>
          <form className="sfa-search" onSubmit={(e) => { e.preventDefault(); router.push(q.trim() ? `${p('/logs')}?q=${encodeURIComponent(q.trim())}` : p('/logs')); }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b39ac6" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={m.shell.searchPlaceholder} aria-label={m.shell.searchAria} />
          </form>
          <div className="sfa-spacer" />
          <LanguageSwitcher />
          <div className="sfa-user">
            <div><strong>{userName}</strong><a href="/api/auth/logout">{m.common.logout}</a></div>
            <span className="sfa-avatar">{initials(userName)}</span>
          </div>
        </header>
        <main className="sfa-content">{children}</main>
      </div>
    </div>
  );
}
