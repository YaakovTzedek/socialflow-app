import { NextRequest, NextResponse } from 'next/server';
import { replyToInstagramComment } from '@/lib/meta';
import { requireUserToken, getPageToken } from '@/lib/auth-helpers';

// POST /api/instagram/comments/:commentId/reply { pageId, message } → reply to IG comment
export async function POST(
  req: NextRequest,
  { params }: { params: { commentId: string } }
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
    const result = await replyToInstagramComment(
      params.commentId,
      message.trim(),
      pageToken
    );
    return NextResponse.json({ success: true, id: result.id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
