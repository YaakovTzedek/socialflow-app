import { getMessages, localePath, type Locale } from '@/lib/i18n';
import Link from 'next/link';

export async function generateMetadata({ params }: { params: { locale: Locale } }) {
  return { title: `${getMessages(params.locale).legal.terms.title} · SocialFlow` };
}

export default function Page({ params }: { params: { locale: Locale } }) {
  const m = getMessages(params.locale);
  const L = m.legal.terms;
  return (
    <main className="sfa-legal">
      <h1>{L.title}</h1>
      <p className="sfa-legal-date">{m.legal.updated}</p>
      <Section title={L.accept}>{L.acceptText}</Section>
      <Section title={L.service}>{L.serviceText}</Section>
      <Section title={L.fair}>{L.fairText}</Section>
      <Section title={L.billing}>{L.billingText}</Section>
      <Section title={L.liability}>{L.liabilityText}</Section>
      <Section title={m.legal.contact}>{L.contactText}</Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (<section className="sfa-legal-sec"><h2>{title}</h2><div>{children}</div></section>);
}
