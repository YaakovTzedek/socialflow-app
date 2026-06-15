import { NextResponse } from 'next/server';
import { listPages } from '@/lib/meta';
import { requireUserToken } from '@/lib/auth-helpers';

export async function GET() {
  const token = await requireUserToken();
  if (!token) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  }
  try {
    const pages = await listPages(token);
    // Never leak page tokens to the client.
    const safe = pages.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      fan_count: p.fan_count,
      picture: p.picture?.data?.url,
    }));
    return NextResponse.json({ pages: safe });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
