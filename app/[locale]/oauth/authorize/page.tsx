import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { getClient } from '@/lib/oauth';
import { getMessages, localePath, type Locale } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

/** OAuth consent screen: the connector (ChatGPT, claude.ai, Claude Code) lands here; the user signs in with Facebook if needed and approves. */
export default async function AuthorizePage({ params, searchParams }: { params: { locale: Locale }; searchParams: Record<string, string | string[] | undefined> }) {
  const m = getMessages(params.locale); const O = m.oauth;
  const q = (k: string) => (Array.isArray(searchParams[k]) ? (searchParams[k] as string[])[0] : (searchParams[k] as string)) || '';
  const clientId = q('client_id'); const redirectUri = q('redirect_uri'); const state = q('state');
  const codeChallenge = q('code_challenge'); const method = q('code_challenge_method'); const scope = q('scope');
  const client = clientId ? await getClient(clientId) : undefined;
  const bad = !client ? O.unknownClient : !client.redirect_uris.includes(redirectUri) ? O.badRedirect : q('response_type') !== 'code' ? O.badResponseType : codeChallenge && method !== 'S256' ? O.badPkce : null;
  const session = await getSession();
  if (!bad && !session.userId) {
    const self = `${localePath(params.locale, '/oauth/authorize')}?${new URLSearchParams(Object.entries(searchParams).map(([k, v]) => [k, Array.isArray(v) ? v[0] || '' : v || ''])).toString()}`;
    redirect(`/api/auth/login?next=${encodeURIComponent(self)}&locale=${params.locale}`);
  }
  return (
    <div className="sfa" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 20 }}>
      <div className="sfa-card" style={{ width: 'min(520px, 100%)' }}>
        <div className="sfa-eyebrow">{O.eyebrow}</div>
        {bad ? (
          <><h2 style={{ margin: '0 0 8px', color: '#fff' }}>{O.cannot}</h2><p className="sfa-sub">{bad}</p></>
        ) : (
          <form method="post" action="/api/oauth/approve">
            <h2 style={{ margin: '0 0 8px', color: '#fff' }}>{O.asks.replace('{client}', client!.client_name)}</h2>
            <p className="sfa-sub">{O.signedInAs} <b style={{ color: '#fff' }}>{session.userName || m.common.user}</b>{O.scopeText}</p>
            <input type="hidden" name="client_id" value={clientId} />
            <input type="hidden" name="redirect_uri" value={redirectUri} />
            <input type="hidden" name="state" value={state} />
            <input type="hidden" name="code_challenge" value={codeChallenge} />
            <input type="hidden" name="scope" value={scope} />
            <input type="hidden" name="locale" value={params.locale} />
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button type="submit" name="decision" value="allow" className="sfa-btn sfa-btn-primary">{O.approve}</button>
              <button type="submit" name="decision" value="deny" className="sfa-btn sfa-btn-ghost">{O.deny}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
