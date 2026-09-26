import { NextRequest, NextResponse } from 'next/server';
import { listPagePosts } from '@/lib/meta';
import { requireUserToken, withPageToken } from '@/lib/auth-helpers';

export async function GET(
  _req: NextRequest,
  { params }: { params: { pageId: string } }
) {
  const token = await requireUserToken();
  if (!token) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  }
  try {
    const posts = await withPageToken(token, params.pageId, (pt) => listPagePosts(params.pageId, pt));
    if (!posts) {
      return NextResponse.json({ error: 'page_not_found' }, { status: 404 });
    }
    return NextResponse.json({ posts });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
