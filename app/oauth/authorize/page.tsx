import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { getClient } from '@/lib/oauth';

export const dynamic = 'force-dynamic';

/** OAuth consent screen: the connector (ChatGPT, claude.ai, Claude Code) lands here; the user signs in with Facebook if needed and approves. */
export default async function AuthorizePage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const q = (k: string) => (Array.isArray(searchParams[k]) ? (searchParams[k] as string[])[0] : (searchParams[k] as string)) || '';
  const clientId = q('client_id'); const redirectUri = q('redirect_uri'); const state = q('state');
  const codeChallenge = q('code_challenge'); const method = q('code_challenge_method'); const scope = q('scope');
  const client = clientId ? await getClient(clientId) : undefined;
  const bad = !client ? 'לקוח לא מוכר' : !client.redirect_uris.includes(redirectUri) ? 'כתובת חזרה לא רשומה ללקוח הזה' : q('response_type') !== 'code' ? 'response_type חייב להיות code' : codeChallenge && method !== 'S256' ? 'PKCE חייב להיות S256' : null;
  const session = await getSession();
  if (!bad && !session.userId) {
    const self = `/oauth/authorize?${new URLSearchParams(Object.entries(searchParams).map(([k, v]) => [k, Array.isArray(v) ? v[0] || '' : v || ''])).toString()}`;
    redirect(`/api/auth/login?next=${encodeURIComponent(self)}`);
  }
  return (
    <div className="sfa" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 20 }}>
      <div className="sfa-card" style={{ width: 'min(520px, 100%)' }}>
        <div className="sfa-eyebrow">חיבור ל-SocialFlow</div>
        {bad ? (
          <>
            <h2 style={{ margin: '0 0 8px', color: '#fff' }}>אי אפשר להמשיך</h2>
            <p className="sfa-sub">{bad}</p>
          </>
        ) : (
          <form method="post" action="/api/oauth/approve">
            <h2 style={{ margin: '0 0 8px', color: '#fff' }}>{client!.client_name} מבקש גישה לחשבון SocialFlow שלך</h2>
            <p className="sfa-sub">מחובר בתור <b style={{ color: '#fff' }}>{session.userName || 'משתמש'}</b>. הגישה מאפשרת לקרוא את הדפים, הפוסטים והיומן, וליצור, לעדכן ולהשהות אוטומציות. אפשר לבטל בכל רגע בעמוד "חיבור MCP".</p>
            <input type="hidden" name="client_id" value={clientId} />
            <input type="hidden" name="redirect_uri" value={redirectUri} />
            <input type="hidden" name="state" value={state} />
            <input type="hidden" name="code_challenge" value={codeChallenge} />
            <input type="hidden" name="scope" value={scope} />
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button type="submit" name="decision" value="allow" className="sfa-btn sfa-btn-primary">אישור החיבור</button>
              <button type="submit" name="decision" value="deny" className="sfa-btn sfa-btn-ghost">ביטול</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
