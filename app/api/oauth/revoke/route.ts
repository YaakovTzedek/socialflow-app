import { NextRequest, NextResponse } from 'next/server';
import { revoke } from '@/lib/oauth';

export const dynamic = 'force-dynamic';
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' };

export async function POST(req: NextRequest) {
  const p = new URLSearchParams(await req.text().catch(() => ''));
  const token = p.get('token');
  if (token) await revoke(token).catch(() => {});
  return new NextResponse(null, { status: 200, headers: CORS });
}
export async function OPTIONS() { return new NextResponse(null, { status: 204, headers: CORS }); }
