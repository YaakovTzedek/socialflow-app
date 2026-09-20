'use client';

import { useState } from 'react';

const FAQS: { q: string; a: string }[] = [
  {
    q: 'אתם עובדים עם ה-API הרשמי של Meta?',
    a: 'כן. החיבור נעשה דרך ההרשאות הרשמיות של Meta לדפים ולחשבונות עסקיים באינסטגרם. אין שימוש בסקריפטים או בהתחזות למשתמש, ואין צורך בסיסמה שלך.',
  },
  {
    q: 'אפשר להפעיל את זה על פוסטים ישנים?',
    a: 'כן. אפשר לבחור כל פוסט קיים בדף או בחשבון, להגדיר עליו מילות מפתח, והאוטומציה תתחיל לפעול על תגובות חדשות שיגיעו אליו. תגובות שקדמו לאוטומציה לא מקבלות מענה אוטומטי.',
  },
  {
    q: 'צריך לדעת לתכנת?',
    a: 'לא. ההגדרה נעשית באשף עברי של שישה שלבים: בוחרים דף, פוסט, מילות מפתח, תגובה ציבורית והודעה פרטית. מי שמעדיף, יכול לעשות את אותו הדבר בשיחה עם Claude או ChatGPT.',
  },
  {
    q: 'יש לכם גישה להודעות הפרטיות שלי?',
    a: 'לא. SocialFlow שולח את ההודעה האוטומטית לפונה בלבד, ולא קורא את תיבת ההודעות הפרטיות שלך. בתיעוד נשמרים רק התגובה שהפעילה את האוטומציה והסטטוס שלה.',
  },
];

export function LandingFaq() {
  const [open, setOpen] = useState(0);
  return (
    <div className="sf-faqs">
      {FAQS.map((f, i) => {
        const isOpen = open === i;
        return (
          <div key={f.q} className={`sf-faq-item${isOpen ? ' open' : ''}`}>
            <button type="button" className="sf-faq-q" onClick={() => setOpen(isOpen ? -1 : i)} aria-expanded={isOpen}>
              <i aria-hidden>{isOpen ? '−' : '+'}</i>
              <span>{f.q}</span>
            </button>
            {isOpen && <div className="sf-faq-a">{f.a}</div>}
          </div>
        );
      })}
    </div>
  );
}
