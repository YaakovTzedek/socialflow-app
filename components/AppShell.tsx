'use client';
import { LoginLink } from './LoginLink';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useI18n } from './I18nProvider';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

/**
 * App chrome.
 * Desktop: fixed sidebar (logo, nav, "connect another account" card, status
 * line) and a sticky topbar (screen title, search, language, user).
 * Phones (<= 900px, 26.9.2026): the sidebar is hidden. A one-row header holds
 * the logo, the screen title, a search icon and the avatar, and an app-style
 * tab bar is fixed to the bottom: four main screens plus "More", which opens a
 * bottom sheet with the rest of the screens, the language switcher and logout.
 */

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'SF';
  return parts.slice(0, 2).map((p) => p[0]).join('');
}

function Logo({ size = 38, id = 'sfa-lg' }: { size?: number; id?: string }) {
  // Gradient ids are per instance: the sidebar copy is display:none on phones, and a url(#id) that points into a hidden svg paints nothing.
  return (
    <svg width={size} height={Math.round((size * 27) / 38)} viewBox="0 0 112 80" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}1`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#833ab4" /><stop offset="1" stopColor="#E1306C" /></linearGradient>
        <linearGradient id={`${id}2`} x1="1" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#E1306C" /><stop offset="1" stopColor="#f77737" /></linearGradient>
      </defs>
      <path d="M6 16c0-6 5-11 11-11h27c6 0 11 5 11 11v18c0 6-5 11-11 11H28l-11 10V45c-6 0-11-5-11-11V16z" fill={`url(#${id}1)`} />
      <circle cx="20" cy="26" r="3.6" fill="#140c1c" /><circle cx="31" cy="26" r="3.6" fill="#140c1c" /><circle cx="42" cy="26" r="3.6" fill="#140c1c" />
      <path d="M34 47c14 12 22 4 34 4" stroke={`url(#${id}2)`} strokeWidth="9" strokeLinecap="round" fill="none" opacity=".85" />
      <path d="M60 22c0-6 5-11 11-11h24c6 0 11 5 11 11v22c0 6-5 11-11 11h-4l-10 9v-9h-10c-6 0-11-5-11-11V22z" fill={`url(#${id}2)`} />
      <circle cx="83" cy="28" r="6" fill="#140c1c" /><path d="M72 46c1.6-7 5.6-10.5 11-10.5S92.4 39 94 46H72z" fill="#140c1c" />
    </svg>
  );
}

/** Line icons for the phone tab bar and the "More" sheet (24px grid, currentColor). */
const ICONS: Record<string, React.ReactNode> = {
  dashboard: <><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10v9.5h13V10" /><path d="M10 19.5v-5h4v5" /></>,
  automations: <path d="M13 2.5 4.5 13.5H11l-1 8 8.5-11H12l1-8z" />,
  inbox: <><path d="M4 5.5h16a1 1 0 0 1 1 1v9.5a1 1 0 0 1-1 1H9l-4.5 3.5V17H4a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1z" /><path d="M7.5 10h9M7.5 13h6" /></>,
  brain: <><path d="M12 3.5 20.5 12 12 20.5 3.5 12z" /><path d="M12 8.5 15.5 12 12 15.5 8.5 12z" /></>,
  more: <><circle cx="5.5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="18.5" cy="12" r="1.6" /></>,
  logs: <><path d="M5 6.5h14M5 12h14M5 17.5h9" /></>,
  posts: <><rect x="3.5" y="3.5" width="17" height="17" rx="4" /><circle cx="12" cy="12" r="4" /><circle cx="17" cy="7" r=".9" /></>,
  mcp: <><path d="M4 8h12l-3-3M20 16H8l3 3" /></>,
  billing: <><rect x="3" y="5.5" width="18" height="13" rx="2.5" /><path d="M3 10h18M7 15h4" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4-4" /></>,
  logout: <><path d="M14 4h4.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H14" /><path d="M10 8l-4 4 4 4M6 12h10" /></>,
  close: <path d="M6 6l12 12M18 6 6 18" />,
};
function Icon({ name, size = 22 }: { name: string; size?: number }) {
  return (
    <svg className="sfa-ico" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

/** Signing out drops this tab's saved copies (the /posts page list), so the next account never sees them. */
function forget() { try { sessionStorage.clear(); } catch { /* ignore */ } }

export default function AppShell({ userName, title, children }: { userName: string; title: string; children: React.ReactNode }) {
  const { m, p } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const [q, setQ] = useState('');
  const [moreOpen, setMoreOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const NAV: { key: string; href: string; label: string; icon: string }[] = [
    { key: 'dashboard', href: '/dashboard', label: m.nav.dashboard, icon: '⌂' },
    { key: 'automations', href: '/automations', label: m.nav.automations, icon: '⚡' },
    { key: 'inbox', href: '/inbox', label: m.nav.inbox, icon: '✉' },
    { key: 'brain', href: '/brain', label: m.nav.brain, icon: '◇' },
    { key: 'logs', href: '/logs', label: m.nav.logs, icon: '☰' },
    { key: 'posts', href: '/posts', label: m.nav.posts, icon: '◎' },
    { key: 'mcp', href: '/mcp', label: m.nav.mcp, icon: '⇄' },
    { key: 'billing', href: '/billing', label: m.nav.billing, icon: '◈' },
  ];
  const isActive = (href: string) => !!pathname?.includes(href);
  const TABS = NAV.slice(0, 4);
  const MORE = NAV.slice(4);
  const moreActive = MORE.some((n) => isActive(n.href));
  const [l1, l2] = m.shell.sideCardTitle.split('\n');

  // Close the sheet and the search on navigation; Escape closes the sheet.
  useEffect(() => { setMoreOpen(false); setSearchOpen(false); }, [pathname]);
  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMoreOpen(false); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [moreOpen]);
  useEffect(() => { if (searchOpen) searchRef.current?.focus(); }, [searchOpen]);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(q.trim() ? `${p('/logs')}?q=${encodeURIComponent(q.trim())}` : p('/logs'));
    setSearchOpen(false);
  };

  return (
    <div className={`sfa${searchOpen ? ' sfa-searching' : ''}`}>
      <aside className="sfa-side">
        <div className="sfa-logo"><Logo /><span className="sfa-wordmark">Social<b>Flow</b></span></div>
        <nav className="sfa-nav">
          {NAV.map((n) => (
            <Link key={n.href} href={p(n.href)} className={isActive(n.href) ? 'active' : ''}>
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
          <Link href={p('/dashboard')} className="sfa-top-logo" aria-label="SocialFlow"><Logo size={30} id="sfa-tlg" /></Link>
          <div className="sfa-title">{title}</div>
          <form className="sfa-search" onSubmit={submitSearch} role="search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b39ac6" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder={m.shell.searchPlaceholder} aria-label={m.shell.searchAria} />
            <button type="button" className="sfa-search-close" onClick={() => setSearchOpen(false)} aria-label={m.tabs.close}><Icon name="close" size={18} /></button>
          </form>
          <div className="sfa-spacer" />
          <button type="button" className="sfa-icon-btn sfa-search-toggle" onClick={() => setSearchOpen(true)} aria-label={m.tabs.search}><Icon name="search" /></button>
          <LanguageSwitcher className="sfa-desk" />
          <div className="sfa-user">
            <div className="sfa-desk"><strong>{userName}</strong><a href="/api/auth/logout" onClick={forget}>{m.common.logout}</a></div>
            <button type="button" className="sfa-avatar" onClick={() => setMoreOpen(true)} aria-label={userName} title={userName}>{initials(userName)}</button>
          </div>
        </header>
        <main className="sfa-content">{children}</main>
      </div>

      <nav className="sfa-tabbar" aria-label={m.tabs.navLabel}>
        {TABS.map((n) => (
          <Link key={n.href} href={p(n.href)} className={isActive(n.href) ? 'on' : ''} aria-current={isActive(n.href) ? 'page' : undefined}>
            <span className="sfa-tab-ico"><Icon name={n.key} /></span>
            <span className="sfa-tab-lbl">{(m.tabs as Record<string, string>)[n.key]}</span>
          </Link>
        ))}
        <button type="button" className={moreActive || moreOpen ? 'on' : ''} onClick={() => setMoreOpen((o) => !o)} aria-expanded={moreOpen} aria-haspopup="dialog">
          <span className="sfa-tab-ico"><Icon name="more" /></span>
          <span className="sfa-tab-lbl">{m.tabs.more}</span>
        </button>
      </nav>

      {moreOpen && (
        <div className="sfa-sheet-bg" onClick={() => setMoreOpen(false)}>
          <div className="sfa-sheet" role="dialog" aria-modal="true" aria-label={m.tabs.menuTitle} onClick={(e) => e.stopPropagation()}>
            <div className="sfa-sheet-grab" aria-hidden="true" />
            <div className="sfa-sheet-user">
              <span className="sfa-avatar">{initials(userName)}</span>
              <div><strong>{userName}</strong><small><span className="sfa-dot" />{m.common.connectedToMeta}</small></div>
              <button type="button" className="sfa-icon-btn" onClick={() => setMoreOpen(false)} aria-label={m.tabs.close}><Icon name="close" /></button>
            </div>
            <div className="sfa-sheet-links">
              {MORE.map((n) => (
                <Link key={n.href} href={p(n.href)} className={isActive(n.href) ? 'on' : ''} onClick={() => setMoreOpen(false)}>
                  <span className="sfa-tab-ico"><Icon name={n.key} /></span>{n.label}
                </Link>
              ))}
            </div>
            <div className="sfa-sheet-row">
              <span>{m.common.language}</span>
              <LanguageSwitcher />
            </div>
            <LoginLink className="sfa-btn sfa-btn-dashed sfa-sheet-connect">{m.common.connectAnother}</LoginLink>
            <a href="/api/auth/logout" className="sfa-sheet-logout" onClick={forget}><Icon name="logout" />{m.common.logout}</a>
          </div>
        </div>
      )}
    </div>
  );
}
