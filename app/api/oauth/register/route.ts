import { NextRequest, NextResponse } from 'next/server';
import { registerClient } from '@/lib/oauth';

export const dynamic = 'force-dynamic';
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' };

// Dynamic client registration (RFC 7591): ChatGPT and claude.ai register themselves here.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const client = await registerClient(body);
    return NextResponse.json(client, { status: 201, headers: CORS });
  } catch (e: any) {
    return NextResponse.json({ error: e.code || 'invalid_client_metadata', error_description: e.message }, { status: e.status || 400, headers: CORS });
  }
}
export async function OPTIONS() { return new NextResponse(null, { status: 204, headers: CORS }); }
