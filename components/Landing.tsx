'use client';

import Link from 'next/link';
import { LandingFaq } from './LandingFaq';
import { LoginLink } from './LoginLink';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useI18n } from './I18nProvider';

/**
 * Public landing page (logged-out root), from the Claude Design file
 * "SocialFlow Landing.dc.html" (project be3e4d06), Instagram palette. Every
 * claim on this page is factual; the log table and the chat are labelled demo data.
 */

function Logo({ size = 42 }: { size?: number }) {
  const h = Math.round((size * 80) / 112);
  return (
    <svg width={size} height={h} viewBox="0 0 112 80" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="sf-lg1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#833ab4" /><stop offset="1" stopColor="#E1306C" /></linearGradient>
        <linearGradient id="sf-lg2" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#E1306C" /><stop offset="1" stopColor="#f77737" /></linearGradient>
      </defs>
      <path d="M6 16c0-6 5-11 11-11h27c6 0 11 5 11 11v18c0 6-5 11-11 11H28l-11 10V45c-6 0-11-5-11-11V16z" fill="url(#sf-lg1)" />
      <circle cx="20" cy="26" r="3.6" fill="#140c1c" /><circle cx="31" cy="26" r="3.6" fill="#140c1c" /><circle cx="42" cy="26" r="3.6" fill="#140c1c" />
      <path d="M34 47c14 12 22 4 34 4" stroke="url(#sf-lg2)" strokeWidth="9" strokeLinecap="round" fill="none" opacity=".85" />
      <path d="M60 22c0-6 5-11 11-11h24c6 0 11 5 11 11v22c0 6-5 11-11 11h-4l-10 9v-9h-10c-6 0-11-5-11-11V22z" fill="url(#sf-lg2)" />
      <circle cx="83" cy="28" r="6" fill="#140c1c" /><path d="M72 46c1.6-7 5.6-10.5 11-10.5S92.4 39 94 46H72z" fill="#140c1c" />
    </svg>
  );
}

const FbMark = () => <span className="sf-fb" aria-hidden>f</span>;
const ClaudeIcon = () => (
  <span className="sf-conn-i" style={{ background: '#1b1408' }}>
    <svg width="18" height="18" viewBox="0 0 24 24" stroke="#d97757" strokeWidth="1.8" fill="none"><path d="M12 2v20M2 12h20M4.9 4.9l14.2 14.2M19.1 4.9L4.9 19.1" /></svg>
  </span>
);
const GptIcon = () => (
  <span className="sf-conn-i" style={{ background: '#150d20' }}>
    <svg width="18" height="18" viewBox="0 0 24 24" stroke="#FAF7FC" strokeWidth="1.6" fill="none"><path d="M12 3.2 18.5 7v8L12 18.8 5.5 15V7L12 3.2z" /><path d="M12 3.2v15.6M5.5 7l13 8M18.5 7l-13 8" /></svg>
  </span>
);

const PLAT: ('fb' | 'ig')[] = ['fb', 'ig', 'fb', 'ig', 'fb', 'ig'];
const TIMES = ['14:28', '14:25', '14:21', '14:18', '14:16', '14:03'];
const SENT = [true, true, true, false, true, false];
const LEADKIND: ('lead' | 'tag' | 'warn')[] = ['lead', 'lead', 'tag', 'warn', 'lead', 'warn'];

export function Landing({ error }: { error?: string }) {
  const { m, t, p } = useI18n();
  const L = m.landing;
  const [pt1, pt2] = L.problemTitle.split('\n');
  return (
    <div className="sf">
      <nav className="sf-nav">
        <div className="sf-nav-in">
          <div className="sf-logo"><Logo /><span className="sf-wordmark">Social<b>Flow</b></span></div>
          <div className="sf-nav-links">
            <a href="#how">{L.navHow}</a><a href="#mcp">{L.navMcp}</a><a href="#log">{L.navLog}</a><a href="#faq">{L.navFaq}</a>
          </div>
          <LanguageSwitcher />
          <LoginLink className="sf-btn sf-btn-primary"><FbMark />{m.common.signInWithFacebook}</LoginLink>
        </div>
      </nav>

      <header className="sf-wrap sf-hero">
        <div className="sf-hero-copy">
          <span className="sf-pill"><span className="sf-dot" />{L.pill}</span>
          <h1 className="sf-display sf-h1">{L.h1a}<br /><span className="sf-grad">{L.h1b}</span></h1>
          <p className="sf-lead">{L.lead}</p>
          {error && <div className="sf-error">{t(L.loginError, { error })}</div>}
          <div className="sf-hero-cta">
            <LoginLink className="sf-btn sf-btn-primary"><FbMark />{L.ctaPrimary}</LoginLink>
            <a href="#how" className="sf-btn-ghost">{L.ctaHow}</a>
          </div>
          <div className="sf-trust">{L.trust.map((x) => <div key={x}><span className="sf-check">✓</span>{x}</div>)}</div>
        </div>

        <div className="sf-flow" aria-label={L.flowTitle}>
          <div className="sf-flow-h"><span>{L.flowTitle}</span><span><i style={{ background: '#E1306C' }} /><i style={{ background: '#833ab4' }} /></span></div>
          <div className="sf-msg"><span className="sf-av sf-av-fb">f</span><div className="sf-bubble sf-bubble-user"><small>{L.flow1Who}</small>{L.flow1Text}</div><span className="sf-step-n">1</span></div>
          <div className="sf-msg"><span className="sf-av sf-av-sf" /><div className="sf-bubble sf-bubble-public"><small>{L.flow2Who}</small>{L.flow2Text}</div><span className="sf-step-n">2</span></div>
          <div className="sf-msg"><span className="sf-av sf-av-ig" /><div className="sf-bubble sf-bubble-dm"><small>{L.flow3Who}</small>{L.flow3Text} <a href="#how">{L.flow3Link}</a></div><span className="sf-step-n">3</span></div>
          <div className="sf-lead-in"><span className="sf-ok">✓</span><div><b>{L.flow4Title}</b><p>{L.flow4Text}</p></div><span className="sf-step-n">4</span></div>
        </div>
      </header>

      <section className="sf-wrap sf-facts">
        {L.facts.map((f, i) => (
          <div key={f.title} className="sf-fact"><span className="sf-fact-i">{['⚡', '⛨', '⊘'][i]}</span><div><b>{f.title}</b><span>{f.sub}</span></div></div>
        ))}
      </section>

      <section className="sf-wrap">
        <div className="sf-problem">
          <div>
            <div className="sf-eyebrow">{L.problemEyebrow}</div>
            <div className="sf-display">{pt1}<br />{pt2}</div>
            <p>{L.problemText.split('\n').map((line, i) => <span key={i}>{line}<br /></span>)}</p>
          </div>
          <div className="sf-pains">{L.pains.map((x) => <div key={x} className="sf-pain"><i>✕</i>{x}</div>)}</div>
        </div>
      </section>

      <section id="how" className="sf-wrap">
        <div className="sf-sec-h"><div className="sf-display">{L.howTitle}</div><span>{L.howSub}</span><div className="sf-rule" /></div>
        <div className="sf-how">
          {L.how.map((h, i) => (
            <div key={h.title} className="sf-step"><div className="sf-step-h"><b>{i + 1}</b>{h.title}</div><p>{h.desc}</p><small>{h.meta}</small></div>
          ))}
        </div>
      </section>

      <section id="mcp" className="sf-wrap">
        <div className="sf-mcp">
          <div>
            <div className="sf-eyebrow">{L.mcpEyebrow}</div>
            <div className="sf-display">{L.mcpTitle}</div>
            <p>{L.mcpText}</p>
            <div className="sf-conns">
              <div className="sf-conn"><ClaudeIcon /><b>Claude</b><small>{L.connected}<i /></small></div>
              <div className="sf-conn"><GptIcon /><b>ChatGPT</b><small>{L.connected}<i /></small></div>
            </div>
          </div>
          <div className="sf-chat" aria-label={L.chatDemo}>
            <div className="sf-chat-h"><ClaudeIcon />{L.chatDemo}</div>
            <div className="sf-chat-b">
              <div className="sf-q">{L.chatQ1}</div>
              <div className="sf-a"><small>SocialFlow</small>{L.chatA1}<br />{L.chatA1b}<div className="sf-tags"><span className="sf-tag sf-tag-ok">{L.chatA1Tag}</span><span className="sf-tag">{m.common.instagram}</span></div></div>
              <div className="sf-q">{L.chatQ2}</div>
              <div className="sf-a"><small>SocialFlow</small>{L.chatA2a} <b style={{ direction: 'ltr' }}>12</b> {L.chatA2b}</div>
            </div>
          </div>
        </div>
      </section>

      <section id="log" className="sf-wrap">
        <div className="sf-sec-h"><div className="sf-display">{L.logTitle}</div><span className="sf-tag sf-tag-ok" style={{ fontSize: 14 }}>{L.logActive} <i className="sf-dot" style={{ display: 'inline-block' }} /></span><div className="sf-rule" /></div>
        <div className="sf-log">
          <div className="sf-log-scroll">
            <div className="sf-row sf-row-h">{L.logHead.map((h) => <div key={h}>{h}</div>)}</div>
            {L.logRows.map((r, i) => (
              <div key={i} className="sf-row">
                <div className="sf-time"><span className="sf-plat" style={PLAT[i] === 'fb' ? { background: '#1877f2' } : { background: 'linear-gradient(135deg,#f9ce34,#ee2a7b,#6228d7)', fontSize: 11 }}>{PLAT[i] === 'fb' ? 'f' : '◎'}</span>{TIMES[i]}</div>
                <div className="sf-user"><i>{r[1]}</i><span>{r[0]}</span></div>
                <div className="sf-comment">{r[2]}</div>
                <div className="sf-kw">{r[3]}</div>
                <div><span className={`sf-tag ${SENT[i] ? 'sf-tag-ok' : 'sf-tag-off'}`}>{r[4]}</span></div>
                <div><span className={`sf-tag ${LEADKIND[i] === 'lead' ? 'sf-tag-lead' : LEADKIND[i] === 'warn' ? 'sf-tag-warn' : ''}`}>{r[5]}</span></div>
              </div>
            ))}
          </div>
          <div className="sf-log-note">{L.logNote}</div>
        </div>
      </section>

      <section className="sf-wrap">
        <div className="sf-features">
          {L.features.map((f, i) => (
            <div key={f.title} className={`sf-feature${i === 1 ? ' sf-feature-vi' : ''}`}>
              <div className="sf-feature-i">{['◎', '⇄', '▶'][i]}</div>
              <div className="sf-display">{f.title}</div>
              <p>{f.desc}</p>
              <div className="sf-tags">{f.tags.map((x) => <span key={x} className="sf-tag">{x}</span>)}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="faq" className="sf-faq">
        <div className="sf-sec-h"><div className="sf-display">{L.faqTitle}</div><div className="sf-rule" /></div>
        <LandingFaq />
      </section>

      <section className="sf-wrap">
        <div className="sf-cta">
          <div className="sf-display">{L.ctaTitle}</div>
          <p>{L.ctaText}</p>
          <LoginLink className="sf-btn sf-btn-primary"><FbMark />{m.common.signInWithFacebook}</LoginLink>
          <div className="sf-cta-trust">{L.trust.map((x) => <span key={x}>{x}</span>)}</div>
          <div className="sf-slogan">{L.slogan}</div>
        </div>
      </section>

      <footer className="sf-footer">
        <div className="sf-footer-in">
          <div className="sf-logo"><Logo size={34} /><span className="sf-wordmark" style={{ fontSize: 17 }}>Social<b>Flow</b></span></div>
          <div className="sf-footer-links">
            <a href="#how">{L.navHow}</a><a href="#mcp">{L.navMcp}</a><a href="#log">{L.navLog}</a><a href="#faq">{L.navFaq}</a>
            <Link href={p('/terms')}>{L.footerTerms}</Link><Link href={p('/privacy')}>{L.footerPrivacy}</Link><Link href={p('/data-deletion')}>{L.footerDeletion}</Link>
          </div>
          <div className="sf-copy">{L.copyright}</div>
        </div>
      </footer>
    </div>
  );
}
