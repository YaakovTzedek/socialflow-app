import Link from 'next/link';
import { LandingFaq } from './LandingFaq';

/**
 * Public landing page (logged-out root). Implemented from the Claude Design
 * file "SocialFlow Landing.dc.html" (project be3e4d06, 20.9.2026). Every claim
 * on this page is factual: the product runs on Yaakov's own pages, uses Meta's
 * official API, and never sends a second message to the same comment. The
 * log table and the chat are labelled demo data.
 */

const LOGIN = '/api/auth/login';

function Logo({ size = 42 }: { size?: number }) {
  const h = Math.round((size * 80) / 112);
  return (
    <svg width={size} height={h} viewBox="0 0 112 80" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="sf-lg1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#2b6cff" /><stop offset="1" stopColor="#3ff2ff" /></linearGradient>
        <linearGradient id="sf-lg2" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3ff2ff" /><stop offset="1" stopColor="#1fb8ff" /></linearGradient>
      </defs>
      <path d="M6 16c0-6 5-11 11-11h27c6 0 11 5 11 11v18c0 6-5 11-11 11H28l-11 10V45c-6 0-11-5-11-11V16z" fill="url(#sf-lg1)" />
      <circle cx="20" cy="26" r="3.6" fill="#0a1030" /><circle cx="31" cy="26" r="3.6" fill="#0a1030" /><circle cx="42" cy="26" r="3.6" fill="#0a1030" />
      <path d="M34 47c14 12 22 4 34 4" stroke="url(#sf-lg2)" strokeWidth="9" strokeLinecap="round" fill="none" opacity=".85" />
      <path d="M60 22c0-6 5-11 11-11h24c6 0 11 5 11 11v22c0 6-5 11-11 11h-4l-10 9v-9h-10c-6 0-11-5-11-11V22z" fill="url(#sf-lg2)" />
      <circle cx="83" cy="28" r="6" fill="#0a1030" /><path d="M72 46c1.6-7 5.6-10.5 11-10.5S92.4 39 94 46H72z" fill="#0a1030" />
    </svg>
  );
}

const FbMark = () => <span className="sf-fb" aria-hidden>f</span>;

const TRUST = ['הקמה תוך דקה', 'ללא כרטיס אשראי', 'חיבור מאובטח דרך Meta'];

const FACTS = [
  { icon: '⚡', title: 'פועל על העמודים של יעקב צדק', sub: 'בשימוש יומיומי בפועל' },
  { icon: '⛨', title: 'API רשמי של Meta', sub: 'הרשאות מאושרות לדפים ולחשבונות עסקיים' },
  { icon: '⊘', title: 'אפס הודעות כפולות', sub: 'הודעה אחת בלבד לכל מגיב' },
];

const PAIN = ['עשרות תגובות שמחכות לתשובה', 'העתקה והדבקה של אותו קישור שוב ושוב', 'תגובות שנשכחות אחרי כמה שעות', 'אין רישום מסודר של מי פנה'];

const HOW = [
  { n: '1', title: 'מחברים את הדף', desc: 'התחברות עם פייסבוק ובחירת הדף או חשבון האינסטגרם העסקי שעליו תרצה להפעיל את האוטומציה.', meta: 'דקה אחת, פעם אחת' },
  { n: '2', title: 'בוחרים מילות מפתח', desc: 'מגדירים על אילו תגובות לפעול, מה תגיד התגובה הציבורית, ומה תכיל ההודעה הפרטית שנשלחת עם הקישור.', meta: 'אשף עברי בשישה שלבים' },
  { n: '3', title: 'המערכת עובדת לבד', desc: 'כל תגובה מתאימה מקבלת תגובה ציבורית והודעה פרטית, והפונה נשמר כליד עם מילת המפתח ושעת הפנייה.', meta: 'מעקב ביומן החי' },
];

type Row = [string, 'fb' | 'ig', string, string, string, string, 'ok' | 'off', string, 'lead' | 'warn' | 'tag', string];
const ROWS: Row[] = [
  ['14:28', 'fb', 'אור כהן', 'אכ', 'כמה זה עולה?', 'מחיר', 'ok', 'נשלחה', 'lead', 'ליד חדש'],
  ['14:25', 'ig', 'מיכל רון', 'מר', 'יש משלוח חינם?', 'משלוח', 'ok', 'נשלחה', 'lead', 'ליד חדש'],
  ['14:21', 'fb', 'שי לוי', 'של', 'אפשר לקבל קישור?', 'קישור', 'ok', 'נשלחה', 'tag', 'לקוח קיים'],
  ['14:18', 'ig', 'קרן בר', 'קב', 'זה עדיין במלאי?', 'מלאי', 'off', 'לא נשלחה', 'warn', 'בבדיקה'],
  ['14:16', 'fb', 'תומר נבו', 'תנ', 'מעניין, פרטים בבקשה', 'פרטים', 'ok', 'נשלחה', 'lead', 'ליד חדש'],
  ['14:03', 'ig', 'נועה דגן', 'נד', 'תודה לכם!', 'ללא', 'off', 'לא נשלחה', 'warn', 'בבדיקה'],
];

const FEATURES = [
  { icon: '◎', title: 'פייסבוק + אינסטגרם + רילס', desc: 'אותה אוטומציה עובדת על פוסטים בדף הפייסבוק, על פוסטים באינסטגרם ועל רילס. תגובה ציבורית והודעה פרטית נשלחות בשתי הפלטפורמות מאותו מסך.', tags: ['פוסטים', 'רילס'], vi: false },
  { icon: '⇄', title: 'ניהול דרך MCP', desc: 'חיבור ל-Claude ול-ChatGPT כשרת MCP. יצירה, עצירה ועדכון של אוטומציות בשפה טבעית, כולל שליפת דוחות מתוך השיחה.', tags: ['Claude', 'ChatGPT'], vi: true },
  { icon: '▶', title: 'Trial Reels', desc: 'בדיקה של רילס מול קהל חדש לפני פרסום לעוקבים, עם אותה אוטומציית תגובות, כדי לראות מה באמת מייצר פניות.', tags: ['בדיקת קהל', 'אותה אוטומציה'], vi: false },
];

const ClaudeIcon = () => (
  <span className="sf-conn-i" style={{ background: '#1b1408' }}>
    <svg width="18" height="18" viewBox="0 0 24 24" stroke="#d97757" strokeWidth="1.8" fill="none"><path d="M12 2v20M2 12h20M4.9 4.9l14.2 14.2M19.1 4.9L4.9 19.1" /></svg>
  </span>
);
const GptIcon = () => (
  <span className="sf-conn-i" style={{ background: '#0b1a16' }}>
    <svg width="18" height="18" viewBox="0 0 24 24" stroke="#e8f1ff" strokeWidth="1.6" fill="none"><path d="M12 3.2 18.5 7v8L12 18.8 5.5 15V7L12 3.2z" /><path d="M12 3.2v15.6M5.5 7l13 8M18.5 7l-13 8" /></svg>
  </span>
);

export function Landing({ error }: { error?: string }) {
  return (
    <div className="sf">
      {/* Fonts: same pair as the design system and tzedek.me */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Karantina:wght@300;400;700&family=Assistant:wght@300;400;600;700;800&display=swap" rel="stylesheet" />

      <nav className="sf-nav">
        <div className="sf-nav-in">
          <div className="sf-logo"><Logo /><span className="sf-wordmark">Social<b>Flow</b></span></div>
          <div className="sf-nav-links">
            <a href="#how">איך זה עובד</a><a href="#mcp">MCP</a><a href="#log">יומן חי</a><a href="#faq">שאלות נפוצות</a>
          </div>
          <Link href={LOGIN} className="sf-btn sf-btn-primary"><FbMark />התחברות עם פייסבוק</Link>
        </div>
      </nav>

      <header className="sf-wrap sf-hero">
        <div className="sf-hero-copy">
          <span className="sf-pill"><span className="sf-dot" />אוטומציה לתגובות בפייסבוק ובאינסטגרם</span>
          <h1 className="sf-display sf-h1">כל תגובה הופכת לליד.<br /><span className="sf-grad">אוטומטית.</span></h1>
          <p className="sf-lead">SocialFlow מגיב לתגובות בפייסבוק ובאינסטגרם, שולח הודעה פרטית עם הקישור, ושומר את הפונה כליד. את הכול אפשר להגדיר ולתפעל גם מתוך Claude ו-ChatGPT, בשפה טבעית.</p>
          {error && <div className="sf-error">שגיאת התחברות: {error}</div>}
          <div className="sf-hero-cta">
            <Link href={LOGIN} className="sf-btn sf-btn-primary"><FbMark />חבר את הדף שלך והתחל</Link>
            <a href="#how" className="sf-btn-ghost">איך זה עובד</a>
          </div>
          <div className="sf-trust">
            {TRUST.map((t) => <div key={t}><span className="sf-check">✓</span>{t}</div>)}
          </div>
        </div>

        <div className="sf-flow" aria-label="דוגמה לתהליך">
          <div className="sf-flow-h"><span>התהליך המלא · 4 שלבים</span><span><i style={{ background: '#3ff2ff' }} /><i style={{ background: '#7c5cff' }} /></span></div>
          <div className="sf-msg"><span className="sf-av sf-av-fb">f</span><div className="sf-bubble sf-bubble-user"><small>גולש בפייסבוק</small>מעניין! אפשר לקבל פרטים?</div><span className="sf-step-n">1</span></div>
          <div className="sf-msg"><span className="sf-av sf-av-sf" /><div className="sf-bubble sf-bubble-public"><small>SocialFlow · תגובה ציבורית</small>תודה על התגובה! שלחנו לך את כל הפרטים בהודעה פרטית 💙</div><span className="sf-step-n">2</span></div>
          <div className="sf-msg"><span className="sf-av sf-av-ig" /><div className="sf-bubble sf-bubble-dm"><small>SocialFlow · הודעה פרטית</small>היי! הנה הקישור שהבטחנו: <a href="#how">הקישור שלך</a></div><span className="sf-step-n">3</span></div>
          <div className="sf-lead-in"><span className="sf-ok">✓</span><div><b>ליד נקלט במערכת</b><p>שם, פלטפורמה, מילת המפתח ושעת הפנייה.</p></div><span className="sf-step-n">4</span></div>
        </div>
      </header>

      <section className="sf-wrap sf-facts" aria-label="עובדות">
        {FACTS.map((f) => (
          <div key={f.title} className="sf-fact"><span className="sf-fact-i">{f.icon}</span><div><b>{f.title}</b><span>{f.sub}</span></div></div>
        ))}
      </section>

      <section className="sf-wrap">
        <div className="sf-problem">
          <div>
            <div className="sf-eyebrow" style={{ color: '#7c5cff' }}>הבעיה</div>
            <div className="sf-display">"הגיבו X ואשלח לכם"<br />ואז מתחיל הבלגן.</div>
            <p>הפוסט עובד, ותוך שעה יש עשרות תגובות שמחכות לתשובה.<br />אתה עונה ידנית אחת אחת, שולח קישורים בהודעות פרטיות, ומפספס חצי מהן.<br />מי שלא קיבל תשובה תוך כמה דקות כבר גלל הלאה, והליד הלך.</p>
          </div>
          <div className="sf-pains">{PAIN.map((p) => <div key={p} className="sf-pain"><i>✕</i>{p}</div>)}</div>
        </div>
      </section>

      <section id="how" className="sf-wrap">
        <div className="sf-sec-h"><div className="sf-display">איך זה עובד</div><span>שלושה צעדים, פעם אחת.</span><div className="sf-rule" /></div>
        <div className="sf-how">
          {HOW.map((h) => (
            <div key={h.n} className="sf-step"><div className="sf-step-h"><b>{h.n}</b>{h.title}</div><p>{h.desc}</p><small>{h.meta}</small></div>
          ))}
        </div>
      </section>

      <section id="mcp" className="sf-wrap">
        <div className="sf-mcp">
          <div>
            <div className="sf-eyebrow" style={{ color: '#3ff2ff' }}>MCP</div>
            <div className="sf-display">תנהל את הכול מתוך הצ'אט</div>
            <p>SocialFlow מתחבר כשרת MCP ל-Claude ול-ChatGPT. אתה כותב מה שאתה רוצה בעברית, והאוטומציה נוצרת, מתעדכנת או נעצרת. גם הדוחות מגיעים באותה שיחה.</p>
            <div className="sf-conns">
              <div className="sf-conn"><ClaudeIcon /><b>Claude</b><small>מחובר<i /></small></div>
              <div className="sf-conn"><GptIcon /><b>ChatGPT</b><small>מחובר<i /></small></div>
            </div>
          </div>
          <div className="sf-chat" aria-label="דוגמה לשיחה">
            <div className="sf-chat-h"><ClaudeIcon />שיחה עם SocialFlow MCP · דוגמה</div>
            <div className="sf-chat-b">
              <div className="sf-q">תפעיל אוטומציה על הפוסט האחרון באינסטגרם: מי שכותב "מחיר" יקבל הודעה פרטית עם הקישור לדף הנחיתה.</div>
              <div className="sf-a"><small>SocialFlow</small>האוטומציה נוצרה והופעלה על הפוסט האחרון באינסטגרם.<br />מילת מפתח: מחיר · תגובה ציבורית: פעילה · הודעה פרטית עם הקישור: פעילה · הודעה אחת לכל מגיב.<div className="sf-tags"><span className="sf-tag sf-tag-ok">✓ פעילה</span><span className="sf-tag">אינסטגרם</span></div></div>
              <div className="sf-q">כמה לידים נכנסו מאז?</div>
              <div className="sf-a"><small>SocialFlow</small>מאז ההפעלה נקלטו <b style={{ direction: 'ltr' }}>12</b> לידים חדשים, כולם ממילת המפתח "מחיר".</div>
            </div>
          </div>
        </div>
      </section>

      <section id="log" className="sf-wrap">
        <div className="sf-sec-h"><div className="sf-display">יומן חי</div><span className="sf-tag sf-tag-ok" style={{ fontSize: 14 }}>פעיל עכשיו <i className="sf-dot" style={{ display: 'inline-block' }} /></span><div className="sf-rule" /></div>
        <div className="sf-log">
          <div className="sf-log-scroll">
            <div className="sf-row sf-row-h"><div>זמן</div><div>משתמש</div><div>תגובה</div><div>מילת מפתח</div><div>תגובה פומבית</div><div>סטטוס ליד</div></div>
            {ROWS.map((r) => (
              <div key={r[0] + r[2]} className="sf-row">
                <div className="sf-time"><span className="sf-plat" style={r[1] === 'fb' ? { background: '#1877f2' } : { background: 'linear-gradient(135deg,#f9ce34,#ee2a7b,#6228d7)', fontSize: 11 }}>{r[1] === 'fb' ? 'f' : '◎'}</span>{r[0]}</div>
                <div className="sf-user"><i>{r[3]}</i><span>{r[2]}</span></div>
                <div className="sf-comment">{r[4]}</div>
                <div className="sf-kw">{r[5]}</div>
                <div><span className={`sf-tag ${r[6] === 'ok' ? 'sf-tag-ok' : 'sf-tag-off'}`}>{r[7]}</span></div>
                <div><span className={`sf-tag ${r[8] === 'lead' ? 'sf-tag-lead' : r[8] === 'warn' ? 'sf-tag-warn' : ''}`}>{r[9]}</span></div>
              </div>
            ))}
          </div>
          <div className="sf-log-note">נתוני דוגמה. ביומן האמיתי שמות המגיבים מטושטשים להגנת פרטיות.</div>
        </div>
      </section>

      <section className="sf-wrap">
        <div className="sf-features">
          {FEATURES.map((f) => (
            <div key={f.title} className={`sf-feature${f.vi ? ' sf-feature-vi' : ''}`}>
              <div className="sf-feature-i">{f.icon}</div>
              <div className="sf-display">{f.title}</div>
              <p>{f.desc}</p>
              <div className="sf-tags">{f.tags.map((t) => <span key={t} className="sf-tag">{t}</span>)}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="faq" className="sf-faq">
        <div className="sf-sec-h"><div className="sf-display">שאלות נפוצות</div><div className="sf-rule" /></div>
        <LandingFaq />
      </section>

      <section className="sf-wrap">
        <div className="sf-cta">
          <div className="sf-display">הפוסט הבא שלך כבר יעבוד לבד</div>
          <p>חבר את דף הפייסבוק או חשבון האינסטגרם, בחר מילת מפתח, והאוטומציה הראשונה פעילה.</p>
          <Link href={LOGIN} className="sf-btn sf-btn-primary"><FbMark />התחברות עם פייסבוק</Link>
          <div className="sf-cta-trust">{TRUST.map((t) => <span key={t}>{t}</span>)}</div>
          <div className="sf-slogan">TURN COMMENTS INTO CONVERSIONS</div>
        </div>
      </section>

      <footer className="sf-footer">
        <div className="sf-footer-in">
          <div className="sf-logo"><Logo size={34} /><span className="sf-wordmark" style={{ fontSize: 17 }}>Social<b>Flow</b></span></div>
          <div className="sf-footer-links">
            <a href="#how">איך זה עובד</a><a href="#mcp">MCP</a><a href="#log">יומן חי</a><a href="#faq">שאלות נפוצות</a>
            <Link href="/terms">תנאי שימוש</Link><Link href="/privacy">פרטיות</Link><Link href="/data-deletion">מחיקת נתונים</Link>
          </div>
          <div className="sf-copy">© 2026 SocialFlow. כל הזכויות שמורות.</div>
        </div>
      </footer>
    </div>
  );
}
