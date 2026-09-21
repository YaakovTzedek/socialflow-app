import { NextRequest, NextResponse } from 'next/server';
import { exchange } from '@/lib/oauth';

export const dynamic = 'force-dynamic';
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' };

async function readParams(req: NextRequest) {
  const ct = req.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    const j = await req.json().catch(() => ({}));
    return new URLSearchParams(Object.entries(j).map(([k, v]) => [k, String(v)]));
  }
  const p = new URLSearchParams(await req.text());
  // client_secret_basic support
  const auth = req.headers.get('authorization') || '';
  if (auth.toLowerCase().startsWith('basic ')) {
    const [id, secret] = Buffer.from(auth.slice(6), 'base64').toString('utf8').split(':');
    if (id && !p.get('client_id')) p.set('client_id', decodeURIComponent(id));
    if (secret && !p.get('client_secret')) p.set('client_secret', decodeURIComponent(secret));
  }
  return p;
}

export async function POST(req: NextRequest) {
  try {
    const params = await readParams(req);
    const token = await exchange(params);
    return NextResponse.json(token, { headers: { ...CORS, 'Cache-Control': 'no-store', Pragma: 'no-cache' } });
  } catch (e: any) {
    return NextResponse.json({ error: e.code || 'invalid_request', error_description: e.message }, { status: e.status || 400, headers: CORS });
  }
}
export async function OPTIONS() { return new NextResponse(null, { status: 204, headers: CORS }); }
