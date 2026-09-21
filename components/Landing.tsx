'use client';

import Link from 'next/link';
import { LandingFaq } from './LandingFaq';
import { LoginLink } from './LoginLink';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useI18n } from './I18nProvider';

/**
 * Public landing page (logged-out root), ported from the Claude Design file
 * "SocialFlow Landing.dc.html" (project be3e4d06) after Yaakov's own mockup:
 * aurora background, phone mockup, four-card flow, ribbon, app mockup,
 * keyword cards, factual proof and a live-log sample.
 *
 * Every claim here is factual. The phone, the flow cards and the log rows are
 * product illustrations and the log says so. No invented customer numbers and
 * no invented testimonials.
 *
 * Layout uses logical properties and auto-fit grids only, so the same markup
 * works in RTL (Hebrew, Arabic) and LTR (the other seven languages).
 */

type P = string[];
const CHAT: P = ['M21 11.5a8 8 0 0 1-11.6 7.1L4 20l1.5-4.6A8 8 0 1 1 21 11.5z'];
const PLANE: P = ['M21.5 3 2.8 10.2l7 2.6 2.6 7z', 'M9.8 12.8 21.5 3'];
const PEOPLE: P = ['M16 20v-1.5c0-2.2-2.2-3.5-5-3.5s-5 1.3-5 3.5V20', 'M11 11.5a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z', 'M18 8.2a2.6 2.6 0 1 0 0-5.2', 'M19 20v-1.6c0-1.3-.6-2.3-1.6-3'];
const BOLT: P = ['M13 2 4 14h7l-1 8 9-12h-7l1-8z'];
const KEY: P = ['M14.5 9.5a4.5 4.5 0 1 1-4.2-4.5', 'M20 3l-6 6', 'M17.5 5.5 19 7'];
const SHIELD: P = ['M12 3l7.5 3v5.2c0 4.4-3.1 8.2-7.5 9.3-4.4-1.1-7.5-4.9-7.5-9.3V6z', 'M9 12.2l2.2 2.2L15.4 10'];
const BOOK: P = ['M4 5.2C4 4.3 4.8 3.6 5.8 3.6H19v14H5.8c-1 0-1.8.7-1.8 1.6z', 'M4 19.2c0-.9.8-1.6 1.8-1.6H19V21H5.8C4.8 21 4 20.3 4 19.4z'];
const PRICE: P = ['M3.5 12.6 12 4.1l7.9.4.4 7.9-8.5 8.5z', 'M16.2 8.2h.01'];
const INFO: P = ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 11v5', 'M12 7.8h.01'];
const SPARK: P = ['M12 3l1.9 5.4L19.5 10l-5.6 1.6L12 17l-1.9-5.4L4.5 10l5.6-1.6z', 'M18.5 16.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z'];
const CLOCK: P = ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 7.4V12l3 1.8'];
const PLUG: P = ['M9 3v5', 'M15 3v5', 'M6.5 8h11v3.5a5.5 5.5 0 0 1-11 0z', 'M12 17v4'];
const STORE: P = ['M4 9.5 5.5 4h13L20 9.5', 'M4 9.5h16v10.5H4z', 'M9.5 20v-5.5h5V20'];
const TREND: P = ['M4 16.5 9.5 11l3.5 3.5L20 7.5', 'M20 12.5v-5h-5'];
const CHECK: P = ['M5 12.5 10 17l9-10'];

const Icon = ({ d, stroke, size = 26, w = 1.9 }: { d: P; stroke: string; size?: number; w?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d.map((path, i) => <path key={i} d={path} />)}
  </svg>
);

type Tone = 'pink' | 'purple' | 'orange' | 'blue' | 'green';
const TONES: Record<Tone, [string, string, string, string]> = {
  pink: ['rgba(225,48,108,.16)', 'rgba(225,48,108,.5)', 'rgba(225,48,108,.3)', '#F04B7E'],
  purple: ['rgba(131,58,180,.2)', 'rgba(131,58,180,.55)', 'rgba(131,58,180,.32)', '#C08BE8'],
  orange: ['rgba(247,119,55,.16)', 'rgba(247,119,55,.5)', 'rgba(247,119,55,.26)', '#FCAF45'],
  blue: ['rgba(43,108,246,.16)', 'rgba(43,108,246,.5)', 'rgba(43,108,246,.28)', '#7FA8FF'],
  green: ['rgba(34,197,94,.14)', 'rgba(34,197,94,.5)', 'rgba(34,197,94,.24)', '#6CE9A6'],
};
const wrap = (tone: Tone, size = 56): React.CSSProperties => {
  const [bg, border, glow] = TONES[tone];
  return { width: size, height: size, borderRadius: Math.round(size * 0.34), flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg, border: `1px solid ${border}`, boxShadow: `0 0 28px ${glow}` };
};

const GRAD = 'linear-gradient(90deg,#833AB4,#E1306C,#F77737)';
const CARD: React.CSSProperties = { background: '#1a1024', border: '1px solid rgba(255,255,255,.08)', borderRadius: 18, boxShadow: '0 20px 50px rgba(0,0,0,.3)' };
const GRAD_BORDER: React.CSSProperties = { border: '1px solid transparent', backgroundImage: 'linear-gradient(#1a1024,#1a1024),linear-gradient(90deg,#833AB4,#E1306C,#F77737)', backgroundOrigin: 'border-box', backgroundClip: 'padding-box,border-box' };

function Logo({ size = 42 }: { size?: number }) {
  const h = Math.round((size * 80) / 112);
  return (
    <svg width={size} height={h} viewBox="0 0 112 80" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="sfLogoA" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#833AB4" /><stop offset="1" stopColor="#E1306C" /></linearGradient>
        <linearGradient id="sfLogoB" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#E1306C" /><stop offset="1" stopColor="#F77737" /></linearGradient>
      </defs>
      <path d="M6 16c0-6 5-11 11-11h27c6 0 11 5 11 11v18c0 6-5 11-11 11H28l-11 10V45c-6 0-11-5-11-11V16z" fill="url(#sfLogoA)" />
      <circle cx="20" cy="26" r="3.6" fill="#140c1c" /><circle cx="31" cy="26" r="3.6" fill="#140c1c" /><circle cx="42" cy="26" r="3.6" fill="#140c1c" />
      <path d="M34 47c14 12 22 4 34 4" stroke="url(#sfLogoB)" strokeWidth="9" strokeLinecap="round" fill="none" opacity=".9" />
      <path d="M60 22c0-6 5-11 11-11h24c6 0 11 5 11 11v22c0 6-5 11-11 11h-4l-10 9v-9h-10c-6 0-11-5-11-11V22z" fill="url(#sfLogoB)" />
      <circle cx="83" cy="28" r="6" fill="#140c1c" /><path d="M72 46c1.6-7 5.6-10.5 11-10.5S92.4 39 94 46H72z" fill="#140c1c" />
    </svg>
  );
}

const Wordmark = ({ size = 21 }: { size?: number }) => (
  <span style={{ fontWeight: 800, fontSize: size, color: '#fff' }}>Social<span className="sf-grad-text">Flow</span></span>
);

function FlowArrow({ flip = false }: { flip?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', paddingBlock: 4 }} aria-hidden="true">
      <svg width="40" height="54" viewBox="0 0 40 54" fill="none" style={flip ? { transform: 'scaleX(-1)' } : undefined}>
        <path d="M11 4c13 9 16 19 7 36" stroke="url(#sfLine)" strokeWidth="2.6" strokeLinecap="round" strokeDasharray="4 6" />
        <path d="M12 33l6 10 8-6" stroke="url(#sfLine)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export function Landing({ error }: { error?: string }) {
  const { m, t, p, dir } = useI18n();
  const H = m.home;
  const rtl = dir === 'rtl';
  const arrowPath = rtl ? 'M19 12H5M11 18l-6-6 6-6' : 'M5 12h14M13 6l6 6-6 6';

  return (
    <div className="sf">
      {/* shared gradient defs for strokes */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <linearGradient id="sfLine" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#833AB4" /><stop offset=".5" stopColor="#E1306C" /><stop offset="1" stopColor="#F77737" /></linearGradient>
          <linearGradient id="sfIG" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#FCAF45" /><stop offset=".45" stopColor="#E1306C" /><stop offset="1" stopColor="#833AB4" /></linearGradient>
        </defs>
      </svg>

      <div className="sf-aurora" aria-hidden="true">
        <i style={{ insetBlockStart: -320, insetInlineEnd: -220, width: 900, height: 760, background: 'radial-gradient(circle at 40% 40%, #833AB4, transparent 68%)', filter: 'blur(120px)', opacity: 0.55, animation: 'sfDrift 22s ease-in-out infinite' }} />
        <i style={{ insetBlockStart: -180, insetInlineStart: -240, width: 760, height: 680, background: 'radial-gradient(circle at 50% 50%, #E1306C, transparent 66%)', filter: 'blur(130px)', opacity: 0.38, animation: 'sfDrift 28s ease-in-out infinite reverse' }} />
        <i style={{ insetBlockStart: 420, insetInlineStart: '34%', width: 620, height: 520, background: 'radial-gradient(circle at 50% 50%, #F77737, transparent 66%)', filter: 'blur(140px)', opacity: 0.22 }} />
        <i style={{ insetBlockEnd: 520, insetInlineEnd: -180, width: 780, height: 640, background: 'radial-gradient(circle at 50% 50%, #2B6CF6, transparent 66%)', filter: 'blur(150px)', opacity: 0.26, animation: 'sfDrift 26s ease-in-out infinite' }} />
        <i style={{ insetBlockEnd: -260, insetInlineStart: -160, width: 900, height: 700, background: 'radial-gradient(circle at 50% 50%, #833AB4, transparent 68%)', filter: 'blur(150px)', opacity: 0.42 }} />
      </div>

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* NAV */}
        <div className="sf-nav">
          <div className="sf-shell sf-nav-in">
            <div className="sf-brand" style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Logo /><Wordmark /></div>
            <div className="sf-nav-links">
              <a href="#how">{H.navHow}</a>
              <a href="#features">{H.navFeatures}</a>
              <a href="#faq">{H.navFaq}</a>
            </div>
            <LanguageSwitcher />
            <LoginLink className="sf-btn sf-btn-primary sf-btn-sm">{H.startFree}</LoginLink>
          </div>
        </div>

        {/* HERO */}
        <div className="sf-shell sf-hero">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, minWidth: 0 }}>
            <span className="sf-pill"><span className="sf-dot" />{H.pill}</span>
            <h1 className="sf-h1">{H.h1a}<br /><span className="sf-grad-text">{H.h1grad}</span> {H.h1b}</h1>
            <p style={{ fontSize: 22, lineHeight: 1.6, color: '#C9BBD3', margin: 0, maxWidth: 520, fontWeight: 600 }}>{H.lead}</p>
            {error && <div className="sf-error">{t(m.landing.loginError, { error })}</div>}

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div className="sf-chip">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="url(#sfIG)" strokeWidth="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5.4" /><circle cx="12" cy="12" r="4.2" /><circle cx="17.4" cy="6.6" r="1.1" fill="#F77737" stroke="none" /></svg>
                <span style={{ fontWeight: 700, fontSize: 15 }}>{m.common.instagram}</span>
              </div>
              <div className="sf-chip">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#1877f2" aria-hidden="true"><path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.7-3.9 1.1 0 2.2.2 2.2.2v2.4h-1.2c-1.2 0-1.6.8-1.6 1.6V12h2.7l-.4 2.9h-2.3v7A10 10 0 0 0 22 12z" /></svg>
                <span style={{ fontWeight: 700, fontSize: 15 }}>{m.common.facebook}</span>
              </div>
            </div>

            <div className="sf-hero-cta" style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
              <LoginLink className="sf-btn sf-btn-primary sf-btn-lg">
                {H.startFree}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={arrowPath} /></svg>
              </LoginLink>
              <a href="#how" className="sf-btn sf-btn-ghost sf-btn-lg">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#F04B7E" aria-hidden="true" style={rtl ? { transform: 'scaleX(-1)' } : undefined}><path d="M8 5.5v13l11-6.5z" /></svg>
                {H.watchDemo}
              </a>
            </div>

            <div className="sf-trustline">{H.trust.map((x, i) => <span key={x}>{x}{i < H.trust.length - 1 && <i>·</i>}</span>)}</div>
          </div>

          {/* HERO VISUAL */}
          <div className="sf-visual">
            <div className="sf-phone-wrap">
              <div className="sf-phone-glow" aria-hidden="true" />
              <div className="sf-phone">
                <div className="sf-phone-screen">
                  <div className="sf-notch"><i /></div>
                  <div className="sf-post-h">
                    <span className="sf-ring"><span>{H.phone.handle.slice(0, 2).toUpperCase()}</span></span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, direction: 'ltr', textAlign: 'start' }}>{H.phone.handle}</div>
                      <div style={{ fontSize: 11, color: '#8B7B99' }}>{H.phone.sponsored}</div>
                    </div>
                    <span style={{ color: '#C9BBD3', fontSize: 16 }}>⋯</span>
                  </div>
                  <div className="sf-stories">{[0, 1, 2, 3, 4].map((i) => <span key={i} className="sf-ring sf-ring-sm"><span style={{ background: ['#2a1a38', '#33203f', '#2c1b34', '#391f42', '#271831'][i] }} /></span>)}</div>
                  <div className="sf-post-img">
                    <div className="sf-post-img-glow" aria-hidden="true" />
                    <div className="sf-post-badge">{H.phone.badge}</div>
                  </div>
                  <div className="sf-post-actions">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="#E1306C" aria-hidden="true"><path d="M12 20.5 4.2 13a4.6 4.6 0 0 1 6.5-6.5l1.3 1.3 1.3-1.3A4.6 4.6 0 1 1 19.8 13z" /></svg>
                    <Icon d={CHAT} stroke="#FAF7FC" size={22} w={1.8} />
                    <Icon d={PLANE} stroke="#FAF7FC" size={22} w={1.8} />
                    <span style={{ marginInlineStart: 'auto', fontSize: 11, color: '#8B7B99' }}>{H.phone.ago}</span>
                  </div>
                  <div style={{ paddingInline: 12, paddingBlock: '0 8px', fontSize: 12, color: '#C9BBD3', lineHeight: 1.6 }}>
                    <b style={{ color: '#FAF7FC' }}>{H.phone.likes}</b><br />
                    <b style={{ color: '#FAF7FC', direction: 'ltr', unicodeBidi: 'isolate' }}>{H.phone.handle}</b> {H.phone.caption}
                  </div>
                  <div style={{ paddingInline: 12, paddingBlock: '0 18px', fontSize: 11, color: '#8B7B99' }}>{H.phone.comments}</div>
                </div>
              </div>
              <div className="sf-float-comment">
                <span className="sf-av-grad">{H.comment.initials}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 12 }}>{H.comment.name}</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{H.comment.text}</div>
                </div>
              </div>
            </div>

            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <div className="sf-hand" style={{ marginBlockEnd: 8, alignSelf: 'start' }}>{H.hand1}</div>

              <div style={{ ...CARD, padding: 14, display: 'flex', alignItems: 'center', gap: 11 }}>
                <span className="sf-av-grad sf-av-lg">{H.comment.initials}</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{H.comment.name}</div>
                  <div style={{ fontSize: 14, color: '#C9BBD3' }}>{H.flow.c1sub}</div>
                </div>
                <span className="sf-tag-ai">{H.flow.c1tag}</span>
              </div>

              <FlowArrow />

              <div style={{ ...GRAD_BORDER, borderRadius: 16, padding: 14, display: 'flex', alignItems: 'flex-start', gap: 11, boxShadow: '0 18px 44px rgba(225,48,108,.16)' }}>
                <span style={{ width: 36, height: 36, borderRadius: 11, flex: 'none', background: 'linear-gradient(140deg,#833AB4,#E1306C)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon d={CHAT} stroke="#fff" size={18} w={2} /></span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 14 }}>{H.flow.c2title}</div>
                  <div style={{ fontSize: 14, color: '#C9BBD3', lineHeight: 1.6 }}>{H.flow.c2text}</div>
                </div>
              </div>

              <FlowArrow flip />

              <div style={{ ...CARD, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                  <span style={{ width: 36, height: 36, borderRadius: 11, flex: 'none', background: 'linear-gradient(140deg,#E1306C,#F77737)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon d={PLANE} stroke="#fff" size={18} w={2} /></span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 14 }}>{H.flow.c3title}</div>
                    <div style={{ fontSize: 14, color: '#C9BBD3' }}>{H.flow.c3text}</div>
                  </div>
                </div>
                <div className="sf-link-preview">
                  <span aria-hidden="true" />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{H.flow.linkTitle}</div>
                    <div style={{ fontSize: 12, color: '#8B7B99', direction: 'ltr', textAlign: 'start' }}>{H.flow.linkUrl}</div>
                  </div>
                </div>
              </div>

              <FlowArrow />

              <div className="sf-lead-card">
                <span className="sf-lead-check"><Icon d={CHECK} stroke="#06240f" size={18} w={3} /></span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 15, color: '#fff' }}>{H.flow.c4title}</div>
                  <div style={{ fontSize: 13, color: '#C9BBD3' }}>{H.flow.c4sub}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIBBON */}
        <div className="sf-shell" style={{ paddingBlock: '32px 96px' }}>
          <div className="sf-ribbon">
            <div className="sf-hand" style={{ marginBlockEnd: 18 }}>{H.hand2}</div>
            <div className="sf-ribbon-grid">
              {H.ribbon.map((r, i) => {
                const tone: Tone = ['pink', 'purple', 'blue'][i] as Tone;
                const icons = [CHAT, PLANE, PEOPLE];
                return (
                  <div key={r.title} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
                    <span style={wrap(tone, 72)}><Icon d={icons[i]} stroke={TONES[tone][3]} size={30} /></span>
                    <div className="sf-display" style={{ fontSize: 38, lineHeight: 1 }}>{r.title}</div>
                    <div style={{ fontSize: 15, lineHeight: 1.7, color: '#C9BBD3', maxWidth: 260 }}>{r.desc}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* HOW */}
        <div id="how" className="sf-shell" style={{ paddingBlock: '0 96px' }}>
          <div style={{ marginBlockEnd: 34 }}>
            <div className="sf-display sf-h2">{H.howTitle}</div>
            <div className="sf-rule" />
            <div style={{ fontSize: 19, color: '#C9BBD3' }}>{H.howSub}</div>
          </div>
          <div className="sf-how-grid">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
              {H.how.map((h, i) => {
                const tone: Tone = ['pink', 'purple', 'orange'][i] as Tone;
                const icons = [PLUG, KEY, BOLT];
                const nums = ['linear-gradient(140deg,#E1306C,#F04B7E)', 'linear-gradient(140deg,#833AB4,#A855D6)', 'linear-gradient(140deg,#F77737,#FCAF45)'];
                return (
                  <div key={h.title} style={{ ...CARD, padding: 22, display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                    <span className="sf-step-num" style={{ background: nums[i], color: i === 2 ? '#2a1405' : '#fff' }}>{i + 1}</span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 800, fontSize: 20, color: '#fff', marginBlockEnd: 5 }}>{h.title}</div>
                      <div style={{ fontSize: 16, lineHeight: 1.7, color: '#C9BBD3' }}>{h.desc}</div>
                    </div>
                    <span style={wrap(tone, 48)}><Icon d={icons[i]} stroke={TONES[tone][3]} size={24} /></span>
                  </div>
                );
              })}
            </div>

            {/* app mockup */}
            <div style={{ position: 'relative', minWidth: 0 }}>
              <div className="sf-app-glow" aria-hidden="true" />
              <div className="sf-app">
                <div className="sf-app-bar">
                  <span style={{ background: '#E1306C' }} /><span style={{ background: '#FCAF45' }} /><span style={{ background: '#22c55e' }} />
                  <em>{H.app.panel}</em>
                </div>
                <div className="sf-app-body">
                  <div className="sf-app-nav">
                    {H.app.nav.map((label, i) => (
                      <div key={label} className={i === 0 ? 'on' : ''}><span /> {label}</div>
                    ))}
                  </div>
                  <div className="sf-app-form">
                    <div style={{ fontWeight: 800, fontSize: 18, color: '#fff' }}>{H.app.formTitle}</div>
                    {H.app.fields.map((f) => (
                      <div key={f.label} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        <span style={{ fontSize: 12, letterSpacing: '.1em', color: '#B3A3C0' }}>{f.label}</span>
                        <div className="sf-app-input">{f.value}</div>
                      </div>
                    ))}
                    <div className="sf-app-toggle">
                      <span style={{ fontSize: 14, fontWeight: 700 }}>{H.app.status}</span>
                      <span className="sf-switch"><i /></span>
                    </div>
                    <span className="sf-btn sf-btn-primary" style={{ justifyContent: 'center' }}>{H.app.save}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* KEYWORDS */}
        <div id="features" className="sf-shell" style={{ paddingBlock: '0 96px' }}>
          <div style={{ marginBlockEnd: 30 }}>
            <div className="sf-display sf-h2">{H.keywordsTitle}</div>
            <div className="sf-rule" />
          </div>
          <div className="sf-kw-grid">
            {H.keywords.map((k, i) => {
              const tone: Tone = ['pink', 'purple', 'orange', 'blue'][i] as Tone;
              const icons = [BOOK, PRICE, INFO, SPARK];
              return (
                <div key={k.word} style={{ ...CARD, padding: 22, display: 'flex', flexDirection: 'column', gap: 11 }}>
                  <span style={wrap(tone, 52)}><Icon d={icons[i]} stroke={TONES[tone][3]} size={26} /></span>
                  <div className="sf-display" style={{ fontSize: 40, lineHeight: 1 }}>{k.word}</div>
                  <div style={{ fontSize: 15, lineHeight: 1.65, color: '#C9BBD3' }}>{k.desc}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* PROOF */}
        <div className="sf-shell" style={{ paddingBlock: '0 96px' }}>
          <div className="sf-proof">
            <div className="sf-facts">
              {H.facts.map((f, i) => {
                const tone: Tone = ['pink', 'blue', 'purple', 'orange'][i] as Tone;
                const icons = [STORE, SHIELD, CLOCK, SPARK];
                return (
                  <div key={f.title} style={{ ...CARD, padding: 22, display: 'flex', flexDirection: 'column', gap: 9 }}>
                    <span style={wrap(tone, 48)}><Icon d={icons[i]} stroke={TONES[tone][3]} size={24} /></span>
                    <div style={{ fontWeight: 800, fontSize: 18, color: '#fff', lineHeight: 1.35 }}>{f.title}</div>
                    <div style={{ fontSize: 14, lineHeight: 1.6, color: '#C9BBD3' }}>{f.sub}</div>
                  </div>
                );
              })}
            </div>

            <div style={{ ...GRAD_BORDER, borderRadius: 22, padding: 30, boxShadow: '0 30px 70px rgba(225,48,108,.16)', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="sf-dot" />
                <span style={{ fontWeight: 800, fontSize: 19, color: '#fff' }}>{H.logTitle}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {H.logRows.map((row, i) => (
                  <div key={row.time} className="sf-log-row">
                    <span style={{ fontSize: 14, color: '#C9BBD3', fontVariantNumeric: 'tabular-nums' }}>{row.time}</span>
                    <span className="sf-log-plat">{row.plat}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, flex: 1, minWidth: 60 }}>{row.keyword}</span>
                    <span className={`sf-log-tag ${i === 2 ? 'warn' : 'ok'}`}>{row.tag}</span>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 13, color: '#8B7B99' }}>{H.logNote}</div>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div id="faq" className="sf-shell" style={{ paddingBlock: '0 96px' }}>
          <div style={{ marginBlockEnd: 26 }}>
            <div className="sf-display sf-h2">{m.landing.faqTitle}</div>
            <div className="sf-rule" />
          </div>
          <LandingFaq />
        </div>

        {/* CTA */}
        <div className="sf-shell" style={{ paddingBlock: '0 96px' }}>
          <div className="sf-cta">
            <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div className="sf-display sf-h2-cta">{H.ctaTitle}</div>
              <div style={{ fontSize: 19, lineHeight: 1.7, color: '#C9BBD3', maxWidth: 480 }}>{H.ctaText}</div>
              <LoginLink className="sf-btn sf-btn-primary sf-btn-lg" >
                {H.startFree}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={arrowPath} /></svg>
              </LoginLink>
              <div className="sf-trustline">{H.trust.map((x, i) => <span key={x}>{i > 0 && <i>·</i>}{x}</span>)}</div>
            </div>
            <div className="sf-floats">
              {H.floats.map((label, i) => {
                const tone: Tone = ['orange', 'blue', 'pink', 'green'][i] as Tone;
                const icons = [BOLT, SHIELD, STORE, TREND];
                return (
                  <div key={label} className="sf-float">
                    <span style={wrap(tone, 44)}><Icon d={icons[i]} stroke={TONES[tone][3]} size={22} /></span>
                    <span style={{ fontWeight: 700, fontSize: 16 }}>{label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="sf-footer">
          <div className="sf-shell" style={{ paddingBlock: 40, display: 'flex', flexDirection: 'column', gap: 26 }}>
            <div className="sf-footer-top">
              <div>
                <div className="sf-sign">{H.signature}</div>
                <div style={{ fontSize: 12, letterSpacing: '.34em', color: '#B3A3C0', marginBlockStart: 6 }}>{H.signatureSub}</div>
              </div>
              <div className="sf-hand sf-hand-end">{H.hand3}</div>
            </div>
            <div className="sf-footer-bottom">
              <div className="sf-footer-links" style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 15, flex: 1 }}>
                <Link href={p('/terms')}>{H.footerTerms}</Link>
                <Link href={p('/privacy')}>{H.footerPrivacy}</Link>
                <Link href={p('/data-deletion')}>{H.footerDeletion}</Link>
              </div>
              <div style={{ fontSize: 14, color: '#8B7B99' }}>{H.copyright}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
