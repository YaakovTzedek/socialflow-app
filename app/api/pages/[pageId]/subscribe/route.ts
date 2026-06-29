import { NextRequest, NextResponse } from 'next/server';
import { subscribePageWebhook, listPages } from '@/lib/meta';
import { requireUserToken } from '@/lib/auth-helpers';
import { getSession } from '@/lib/session';
import { sql, ensureSchema, hasDb } from '@/lib/db';

// POST /api/pages/:pageId/subscribe → subscribe this page to feed webhooks,
// and refresh the stored page token (with a freshly-granted permission set).
export async function POST(
  _req: NextRequest,
  { params }: { params: { pageId: string } }
) {
  const token = await requireUserToken();
  const session = await getSession();
  if (!token || !session.userId) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  }
  try {
    const pages = await listPages(token);
    const page = pages.find((p) => p.id === params.pageId);
    if (!page?.access_token) {
      return NextResponse.json({ error: 'page_not_found' }, { status: 404 });
    }

    // Refresh the stored page token so the webhook acts with a current token.
    if (hasDb) {
      await ensureSchema();
      await sql!`
        INSERT INTO page_tokens (page_id, owner_id, page_name, access_token, ig_id)
        VALUES (${page.id}, ${session.userId}, ${page.name}, ${page.access_token}, ${
          page.instagram_business_account?.id ?? null
        })
        ON CONFLICT (page_id) DO UPDATE
          SET access_token = EXCLUDED.access_token, page_name = EXCLUDED.page_name,
              ig_id = EXCLUDED.ig_id, updated_at = now()
      `;
    }

    const result = await subscribePageWebhook(page.id, page.access_token);
    return NextResponse.json({ success: true, result });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
