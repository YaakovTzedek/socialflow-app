'use client';

import { useEffect, useState } from 'react';

/**
 * The "inside this guide" rail. Highlights the section currently on screen.
 *
 * The observer watches a band across the upper half of the viewport rather
 * than the whole of it, so the active item changes when a heading reaches
 * reading position and not the moment it appears at the bottom edge.
 */
export function GuideToc({ title, sections }: { title: string; sections: { id: string; label: string }[] }) {
  const [active, setActive] = useState(sections[0]?.id ?? '');

  useEffect(() => {
    const targets = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => !!el);
    if (!targets.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length) setActive(visible[0].target.id);
      },
      { rootMargin: '-12% 0px -60% 0px', threshold: 0 },
    );
    for (const t of targets) io.observe(t);
    return () => io.disconnect();
  }, [sections]);

  return (
    <nav className="sfg-toc" aria-label={title}>
      <div className="sfg-toc-title">{title}</div>
      <ul>
        {sections.map((s) => (
          <li key={s.id}>
            <a href={`#${s.id}`} className={s.id === active ? 'on' : undefined}>
              <i aria-hidden="true" />
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
