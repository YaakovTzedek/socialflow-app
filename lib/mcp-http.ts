import { NextRequest, NextResponse } from 'next/server';
import { hasDb } from './db';
import { handleRpc, resolveApiKey, PROTOCOL_VERSION } from './mcp';
import { getEntitlement } from './entitlements';
import { getMessages, negotiate } from './i18n';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Mcp-Session-Id, MCP-Protocol-Version, Accept',
  'Access-Control-Expose-Headers': 'Mcp-Session-Id',
};

function keyFrom(req: NextRequest, urlKey?: string) {
  const auth = req.headers.get('authorization') || '';
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  return urlKey || req.nextUrl.searchParams.get('key') || req.headers.get('x-api-key') || null;
}

export function mcpOptions() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

/** GET: a human-readable description (clients that open an SSE stream get 405, which tells them to use POST only). */
export function mcpGet(req: NextRequest) {
  const accept = req.headers.get('accept') || '';
  if (accept.includes('text/event-stream')) {
    return new NextResponse('SSE stream not supported; use POST', { status: 405, headers: CORS });
  }
  return NextResponse.json(
    { name: 'socialflow', transport: 'streamable-http', protocolVersion: PROTOCOL_VERSION, docs: 'https://socialflow-app-delta.vercel.app/mcp', auth: 'Authorization: Bearer <api key> or /api/mcp/<api key>' },
    { headers: CORS }
  );
}

export async function mcpPost(req: NextRequest, urlKey?: string) {
  if (!hasDb) return NextResponse.json({ jsonrpc: '2.0', id: null, error: { code: -32000, message: 'db_not_configured' } }, { status: 503, headers: CORS });
  const user = await resolveApiKey(keyFrom(req, urlKey), req.headers.get('accept-language'));
  if (!user) {
    return NextResponse.json({ jsonrpc: '2.0', id: null, error: { code: -32001, message: getMessages(negotiate(req.headers.get('accept-language'))).server.mcpUnauthorized } }, { status: 401, headers: { ...CORS, 'WWW-Authenticate': `Bearer realm="socialflow", resource_metadata="${(process.env.NEXT_PUBLIC_BASE_URL || 'https://socialflow-app-delta.vercel.app').replace(/\/$/, '')}/.well-known/oauth-protected-resource"` } });
  }
  const ent = await getEntitlement(user.owner_id);
  if (!ent.plan.limits.mcp) {
    return NextResponse.json({ jsonrpc: '2.0', id: null, error: { code: -32002, message: getMessages(user.locale).server.mcpNeedsPro } }, { status: 402, headers: CORS });
  }
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, { status: 400, headers: CORS }); }
  const result = await handleRpc(user, body);
  if (result === null) return new NextResponse(null, { status: 202, headers: CORS });
  return NextResponse.json(result, { headers: { ...CORS, 'Mcp-Session-Id': user.key.slice(0, 8) } });
}

export function mcpDelete() {
  return new NextResponse(null, { status: 204, headers: CORS });
}
