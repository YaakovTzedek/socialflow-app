import Link from 'next/link';
import type { CompareGroup, Source } from '@/content/compare';

/**
 * Building blocks shared by the ManyChat pages (/manychat-alternative,
 * /manychat-pricing, /he/manychat). Server components, no client JS.
 */

export function CompareTable({ id, title, colUs, colThem, groups }: {
  id?: string; title: string; colUs: string; colThem: string; groups: CompareGroup[];
}) {
  return (
    <section className="sfc" id={id}>
      <h2 className="sfc-title">{title}</h2>
      <div className="sfc-scroll">
        <table className="sfc-table">
          <thead>
            <tr>
              <th />
              <th className="sfc-us">{colUs}</th>
              <th>{colThem}</th>
            </tr>
          </thead>
          {groups.map((g) => (
            <tbody key={g.title}>
              <tr className="sfc-group">
                <th colSpan={3} scope="colgroup">{g.title}</th>
              </tr>
              {g.rows.map((r) => (
                <tr key={r.label} className={r.key ? 'sfc-key' : undefined}>
                  <th scope="row">{r.label}</th>
                  <td className="sfc-us">{r.us}</td>
                  <td>{r.them}</td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </section>
  );
}

export function Tldr({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="sfp-tldr">
      <div className="sfp-tldr-title">{title}</div>
      <ul>{lines.map((line) => <li key={line}>{line}</li>)}</ul>
    </div>
  );
}

export function Body({ html }: { html: string }) {
  return <article className="sfp-body" dangerouslySetInnerHTML={{ __html: html }} />;
}

export function Faq({ title, faqs }: { title: string; faqs: { q: string; a: string }[] }) {
  return (
    <section className="sfp-faq" id="faq">
      <h2>{title}</h2>
      {faqs.map((f) => (
        <div className="sfp-faq-item" key={f.q}>
          <h3>{f.q}</h3>
          <p>{f.a}</p>
        </div>
      ))}
    </section>
  );
}

export function Sources({ title, note, sources }: { title: string; note: string; sources: Source[] }) {
  return (
    <section className="sfc-sources">
      <h2>{title}</h2>
      <p>{note}</p>
      <ul>
        {sources.map((s) => (
          <li key={s.url}>
            <a href={s.url} target="_blank" rel="noopener nofollow">{s.label}</a>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Related({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <nav className="sfp-body" aria-label={title} style={{ marginBlockStart: 40 }}>
      <h2>{title}</h2>
      <ul>
        {links.map((l) => (
          <li key={l.href}><Link href={l.href}>{l.label}</Link></li>
        ))}
      </ul>
    </nav>
  );
}

export function Cta({ title, text, primary, secondary }: {
  title: string; text: string;
  primary: { href: string; label: string };
  secondary: { href: string; label: string };
}) {
  return (
    <section className="sfp-cta">
      <div className="sfp-cta-title">{title}</div>
      <p>{text}</p>
      <div className="sfc-cta-row">
        <Link href={primary.href} className="sf-btn sf-btn-primary">{primary.label}</Link>
        <Link href={secondary.href} className="sf-btn sf-btn-ghost">{secondary.label}</Link>
      </div>
    </section>
  );
}

/** WebPage + FAQPage structured data for one page. */
export function pageJsonLd({ url, name, description, inLanguage, faqs, dateModified }: {
  url: string; name: string; description: string; inLanguage: string;
  faqs: { q: string; a: string }[]; dateModified: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${url}#webpage`,
        url,
        name,
        description,
        inLanguage,
        dateModified,
        isPartOf: { '@id': `${url.replace(/^(https?:\/\/[^/]+).*$/, '$1')}/#website` },
      },
      {
        '@type': 'FAQPage',
        '@id': `${url}#faq`,
        inLanguage,
        mainEntity: faqs.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
    ],
  };
}

export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}
