import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { sql, ensureSchema, hasDb } from '@/lib/db';
import { getSession } from '@/lib/session';
import { requireUserToken, getPageToken } from '@/lib/auth-helpers';
import { listPages } from '@/lib/meta';

// GET /api/automations → list the current user's automations
export async function GET() {
  if (!hasDb) {
    return NextResponse.json({ error: 'db_not_configured', automations: [] });
  }
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  }
  try {
    await ensureSchema();
    const rows = await sql!`
      SELECT * FROM automations
      WHERE owner_id = ${session.userId}
      ORDER BY created_at DESC
    `;
    return NextResponse.json({ automations: rows });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST /api/automations → create an automation
export async function POST(req: NextRequest) {
  if (!hasDb) {
    return NextResponse.json({ error: 'db_not_configured' }, { status: 503 });
  }
  const session = await getSession();
  const userToken = await requireUserToken();
  if (!session.userId || !userToken) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      name,
      platform = 'facebook',
      page_id,
      ig_id = null,
      post_id = null,
      post_scope = 'specific_post',
      keywords = [],
      match_type = 'contains',
      public_reply_enabled = true,
      public_replies = [],
      dm_enabled = false,
      dm_message = null,
      dm_link = null,
      once_per_user = true,
      status = 'active',
    } = body;

    if (!name || !page_id) {
      return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
    }

    await ensureSchema();

    // Resolve & persist the page token + name so the webhook can act later.
    const pages = await listPages(userToken);
    const page = pages.find((p) => p.id === page_id);
    if (!page || !page.access_token) {
      return NextResponse.json({ error: 'page_not_accessible' }, { status: 400 });
    }
    await sql!`
      INSERT INTO page_tokens (page_id, owner_id, page_name, access_token, ig_id)
      VALUES (${page_id}, ${session.userId}, ${page.name}, ${page.access_token}, ${
        page.instagram_business_account?.id ?? null
      })
      ON CONFLICT (page_id) DO UPDATE
        SET access_token = EXCLUDED.access_token,
            page_name = EXCLUDED.page_name,
            ig_id = EXCLUDED.ig_id,
            updated_at = now()
    `;

    const id = randomUUID();
    await sql!`
      INSERT INTO automations (
        id, owner_id, name, platform, page_id, page_name, ig_id, post_id,
        post_scope, keywords, match_type, public_reply_enabled, public_replies,
        dm_enabled, dm_message, dm_link, once_per_user, status
      ) VALUES (
        ${id}, ${session.userId}, ${name}, ${platform}, ${page_id}, ${page.name},
        ${ig_id}, ${post_id}, ${post_scope}, ${keywords}, ${match_type},
        ${public_reply_enabled}, ${public_replies}, ${dm_enabled}, ${dm_message},
        ${dm_link}, ${once_per_user}, ${status}
      )
    `;

    return NextResponse.json({ success: true, id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
