/**
 * Minimal OAuth 2.1 authorization server for the MCP endpoint, so ChatGPT and
 * claude.ai connectors can connect with a normal "Sign in" instead of a pasted
 * key: discovery documents, dynamic client registration, authorization code
 * with PKCE (S256), token + refresh. Access tokens are rows in api_keys, the
 * same thing /mcp mints by hand, so revoking from /mcp also disconnects the
 * connector.
 */
import { createHash, randomBytes } from 'crypto';
import { sql, ensureSchema } from './db';

export const OAUTH_SCOPES = ['socialflow'];

export function base() {
  return (process.env.NEXT_PUBLIC_BASE_URL || 'https://socialflow-app-delta.vercel.app').replace(/\/$/, '');
}

export function metadata() {
  const b = base();
  return {
    issuer: b,
    authorization_endpoint: `${b}/oauth/authorize`,
    token_endpoint: `${b}/api/oauth/token`,
    registration_endpoint: `${b}/api/oauth/register`,
    revocation_endpoint: `${b}/api/oauth/revoke`,
    response_types_supported: ['code'],
    response_modes_supported: ['query'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none', 'client_secret_post'],
    scopes_supported: OAUTH_SCOPES,
    service_documentation: `${b}/mcp`,
  };
}

export function protectedResource() {
  const b = base();
  return { resource: `${b}/api/mcp`, authorization_servers: [b], scopes_supported: OAUTH_SCOPES, bearer_methods_supported: ['header'], resource_name: 'SocialFlow MCP' };
}

export async function ensureOauthSchema() {
  await ensureSchema();
  await sql!.unsafe(`
    CREATE TABLE IF NOT EXISTS oauth_clients (
      client_id     TEXT PRIMARY KEY,
      client_secret TEXT,
      client_name   TEXT,
      redirect_uris TEXT[] NOT NULL DEFAULT '{}',
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS oauth_codes (
      code           TEXT PRIMARY KEY,
      client_id      TEXT NOT NULL,
      owner_id       TEXT NOT NULL,
      redirect_uri   TEXT NOT NULL,
      code_challenge TEXT,
      scope          TEXT,
      locale         TEXT,
      expires_at     TIMESTAMPTZ NOT NULL,
      used_at        TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS oauth_refresh (
      token      TEXT PRIMARY KEY,
      client_id  TEXT NOT NULL,
      owner_id   TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      revoked_at TIMESTAMPTZ
    );
  `);
}

export async function registerClient(body: any) {
  await ensureOauthSchema();
  const redirectUris: string[] = Array.isArray(body?.redirect_uris) ? body.redirect_uris.map(String).filter((u: string) => /^https?:\/\//.test(u)) : [];
  if (!redirectUris.length) throw Object.assign(new Error('redirect_uris required'), { status: 400, code: 'invalid_redirect_uri' });
  const clientId = 'sfc_' + randomBytes(12).toString('base64url');
  const wantsSecret = body?.token_endpoint_auth_method === 'client_secret_post' || body?.token_endpoint_auth_method === 'client_secret_basic';
  const secret = wantsSecret ? 'sfs_' + randomBytes(24).toString('base64url') : null;
  const name = String(body?.client_name || 'MCP client').slice(0, 80);
  await sql!`INSERT INTO oauth_clients (client_id, client_secret, client_name, redirect_uris) VALUES (${clientId}, ${secret}, ${name}, ${redirectUris})`;
  return {
    client_id: clientId, ...(secret ? { client_secret: secret, client_secret_expires_at: 0 } : {}),
    client_name: name, redirect_uris: redirectUris,
    token_endpoint_auth_method: secret ? 'client_secret_post' : 'none',
    grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'],
  };
}

export async function getClient(clientId: string) {
  await ensureOauthSchema();
  const [c] = await sql!`SELECT * FROM oauth_clients WHERE client_id = ${clientId}`;
  return c as { client_id: string; client_secret: string | null; client_name: string; redirect_uris: string[] } | undefined;
}

export async function issueCode(opts: { clientId: string; ownerId: string; redirectUri: string; codeChallenge: string | null; scope: string | null; locale?: string | null }) {
  const code = 'sfa_' + randomBytes(24).toString('base64url');
  const exp = new Date(Date.now() + 10 * 60 * 1000);
  await sql!`ALTER TABLE oauth_codes ADD COLUMN IF NOT EXISTS locale TEXT`;
  await sql!`INSERT INTO oauth_codes (code, client_id, owner_id, redirect_uri, code_challenge, scope, locale, expires_at)
             VALUES (${code}, ${opts.clientId}, ${opts.ownerId}, ${opts.redirectUri}, ${opts.codeChallenge}, ${opts.scope}, ${opts.locale || null}, ${exp})`;
  return code;
}

function s256(verifier: string) {
  return createHash('sha256').update(verifier).digest('base64url');
}

async function mintAccessToken(ownerId: string, clientName: string, locale?: string | null) {
  const key = 'sf_' + randomBytes(24).toString('base64url');
  await sql!`INSERT INTO api_keys (key, owner_id, label, locale) VALUES (${key}, ${ownerId}, ${('OAuth: ' + clientName).slice(0, 60)}, ${locale || null})`;
  return key;
}

export async function exchange(params: URLSearchParams) {
  await ensureOauthSchema();
  const grant = params.get('grant_type');
  const clientId = params.get('client_id') || '';
  const client = clientId ? await getClient(clientId) : undefined;
  if (!client) throw Object.assign(new Error('unknown client'), { status: 401, code: 'invalid_client' });
  if (client.client_secret && params.get('client_secret') !== client.client_secret) throw Object.assign(new Error('bad client secret'), { status: 401, code: 'invalid_client' });

  if (grant === 'authorization_code') {
    const code = params.get('code') || '';
    const [row] = await sql!`SELECT * FROM oauth_codes WHERE code = ${code} AND client_id = ${clientId}`;
    if (!row || row.used_at || new Date(row.expires_at).getTime() < Date.now()) throw Object.assign(new Error('code invalid or expired'), { status: 400, code: 'invalid_grant' });
    const redirectUri = params.get('redirect_uri');
    if (redirectUri && redirectUri !== row.redirect_uri) throw Object.assign(new Error('redirect_uri mismatch'), { status: 400, code: 'invalid_grant' });
    if (row.code_challenge) {
      const verifier = params.get('code_verifier') || '';
      if (!verifier || s256(verifier) !== row.code_challenge) throw Object.assign(new Error('PKCE verification failed'), { status: 400, code: 'invalid_grant' });
    }
    await sql!`UPDATE oauth_codes SET used_at = now() WHERE code = ${code}`;
    const access = await mintAccessToken(row.owner_id, client.client_name, row.locale);
    const refresh = 'sfr_' + randomBytes(24).toString('base64url');
    await sql!`ALTER TABLE oauth_refresh ADD COLUMN IF NOT EXISTS locale TEXT`;
    await sql!`INSERT INTO oauth_refresh (token, client_id, owner_id, locale) VALUES (${refresh}, ${clientId}, ${row.owner_id}, ${row.locale || null})`;
    return { access_token: access, token_type: 'Bearer', expires_in: 60 * 60 * 24 * 365, refresh_token: refresh, scope: row.scope || OAUTH_SCOPES[0] };
  }

  if (grant === 'refresh_token') {
    const token = params.get('refresh_token') || '';
    const [row] = await sql!`SELECT * FROM oauth_refresh WHERE token = ${token} AND client_id = ${clientId} AND revoked_at IS NULL`;
    if (!row) throw Object.assign(new Error('refresh token invalid'), { status: 400, code: 'invalid_grant' });
    const access = await mintAccessToken(row.owner_id, client.client_name, row.locale);
    return { access_token: access, token_type: 'Bearer', expires_in: 60 * 60 * 24 * 365, refresh_token: token, scope: OAUTH_SCOPES[0] };
  }
  throw Object.assign(new Error('unsupported grant_type'), { status: 400, code: 'unsupported_grant_type' });
}

export async function revoke(token: string) {
  await ensureOauthSchema();
  await sql!`UPDATE api_keys SET revoked_at = now() WHERE key = ${token} AND revoked_at IS NULL`;
  await sql!`UPDATE oauth_refresh SET revoked_at = now() WHERE token = ${token} AND revoked_at IS NULL`;
}
