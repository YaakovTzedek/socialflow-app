import { NextRequest, NextResponse } from 'next/server';
import { listPagePosts } from '@/lib/meta';
import { requireUserToken, getPageToken } from '@/lib/auth-helpers';

export async function GET(
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
    const posts = await listPagePosts(params.pageId, pageToken);
    return NextResponse.json({ posts });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
