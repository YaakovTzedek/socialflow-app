import { getMessages, localePath, type Locale } from '@/lib/i18n';
import Link from 'next/link';

export async function generateMetadata({ params }: { params: { locale: Locale } }) {
  return { title: `${getMessages(params.locale).legal.deletion.title} · SocialFlow` };
}

export default function Page({ params }: { params: { locale: Locale } }) {
  const m = getMessages(params.locale);
  const L = m.legal.deletion;
  return (
    <main className="sfa-legal">
      <h1>{L.title}</h1>
      <p className="sfa-legal-date">{m.legal.updated}</p>
      <Section title={L.how}>
        <p>{L.howText}</p>
        <ol>
          <li><strong>{L.step1a}</strong> {L.step1b}</li>
          <li><strong>{L.step2a}</strong> {L.step2b}</li>
          <li><strong>{L.step3a}</strong> {L.step3b}</li>
        </ol>
      </Section>
      <Section title={L.what}>{L.whatText}</Section>
      <Section title={m.legal.contact}>{L.contactText}</Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (<section className="sfa-legal-sec"><h2>{title}</h2><div>{children}</div></section>);
}
