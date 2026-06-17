import { NextRequest, NextResponse } from 'next/server';
import { subscribePageWebhook } from '@/lib/meta';
import { requireUserToken, getPageToken } from '@/lib/auth-helpers';

// POST /api/pages/:pageId/subscribe → subscribe this page to feed webhooks
export async function POST(
  _req: NextRequest,
  { params }: { params: { pageId: string } }
) {
  const token = await requireUserToken();
  if (!token) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  }
  try {
    const pageToken = await getPageToken(token, params.pageId);
    if (!pageToken) {
      return NextResponse.json({ error: 'page_not_found' }, { status: 404 });
    }
    const result = await subscribePageWebhook(params.pageId, pageToken);
    return NextResponse.json({ success: true, result });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
