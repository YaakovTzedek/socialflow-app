import { NextRequest, NextResponse } from 'next/server';
import { listInstagramMedia } from '@/lib/meta';
import { requireUserToken, withPageToken } from '@/lib/auth-helpers';

// GET /api/pages/:pageId/instagram/media?igId=xxx → list IG media
export async function GET(
  req: NextRequest,
  { params }: { params: { pageId: string } }
) {
  const token = await requireUserToken();
  if (!token) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  }
  const igId = req.nextUrl.searchParams.get('igId');
  if (!igId) {
    return NextResponse.json({ error: 'missing_igId' }, { status: 400 });
  }
  try {
    const media = await withPageToken(token, params.pageId, (pt) => listInstagramMedia(igId, pt));
    if (!media) {
      return NextResponse.json({ error: 'page_not_found' }, { status: 404 });
    }
    return NextResponse.json({ media });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
