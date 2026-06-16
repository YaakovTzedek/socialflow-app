import { NextRequest, NextResponse } from 'next/server';
import { listInstagramComments, commentOnInstagramMedia } from '@/lib/meta';
import { requireUserToken, getPageToken } from '@/lib/auth-helpers';

// GET /api/instagram/media/:mediaId/comments?pageId=xxx → list IG comments
export async function GET(
  req: NextRequest,
  { params }: { params: { mediaId: string } }
) {
  const token = await requireUserToken();
  if (!token) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  }
  const pageId = req.nextUrl.searchParams.get('pageId');
  if (!pageId) {
    return NextResponse.json({ error: 'missing_pageId' }, { status: 400 });
  }
  try {
    const pageToken = await getPageToken(token, pageId);
    if (!pageToken) {
      return NextResponse.json({ error: 'page_not_found' }, { status: 404 });
    }
    const comments = await listInstagramComments(params.mediaId, pageToken);
    return NextResponse.json({ comments });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST /api/instagram/media/:mediaId/comments { pageId, message } → comment on IG media
export async function POST(
  req: NextRequest,
  { params }: { params: { mediaId: string } }
) {
  const token = await requireUserToken();
  if (!token) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  }
  try {
    const { pageId, message } = await req.json();
    if (!pageId || !message?.trim()) {
      return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
    }
    const pageToken = await getPageToken(token, pageId);
    if (!pageToken) {
      return NextResponse.json({ error: 'page_not_found' }, { status: 404 });
    }
    const result = await commentOnInstagramMedia(
      params.mediaId,
      message.trim(),
      pageToken
    );
    return NextResponse.json({ success: true, id: result.id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
