'use client';

import { useState } from 'react';
import { useI18n } from './I18nProvider';

export function LandingFaq() {
  const { m } = useI18n();
  const [open, setOpen] = useState(0);
  return (
    <div className="sf-faqs">
      {m.landing.faqs.map((f, i) => {
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
