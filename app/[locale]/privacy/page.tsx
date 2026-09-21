import { getMessages, localePath, type Locale } from '@/lib/i18n';
import Link from 'next/link';

export async function generateMetadata({ params }: { params: { locale: Locale } }) {
  return { title: `${getMessages(params.locale).legal.privacy.title} · SocialFlow` };
}

export default function Page({ params }: { params: { locale: Locale } }) {
  const m = getMessages(params.locale);
  const L = m.legal.privacy;
  return (
    <main className="sfa-legal">
      <h1>{L.title}</h1>
      <p className="sfa-legal-date">{m.legal.updated}</p>
      <Section title={L.who}>{L.whoText}</Section>
      <Section title={L.collect}><ul>{L.collectItems.map((x) => <li key={x}>{x}</li>)}</ul></Section>
      <Section title={L.use}>{L.useText}</Section>
      <Section title={L.storage}>{L.storageText}</Section>
      <Section title={L.deletion}>{L.deletionText}<Link href={localePath(params.locale, '/data-deletion')}>{L.deletionLink}</Link>{L.deletionText2}</Section>
      <Section title={m.legal.contact}>{L.contactText}</Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (<section className="sfa-legal-sec"><h2>{title}</h2><div>{children}</div></section>);
}
