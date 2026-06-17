import { NextRequest, NextResponse } from 'next/server';
import { requireUserToken } from '@/lib/auth-helpers';

const V = process.env.META_GRAPH_VERSION || 'v21.0';
const BASE = `https://graph.facebook.com/${V}`;

async function g(path: string, token: string, fields?: string) {
  const url = new URL(`${BASE}/${path}`);
  if (fields) url.searchParams.set('fields', fields);
  url.searchParams.set('limit', '200');
  url.searchParams.set('access_token', token);
  const res = await fetch(url.toString(), { cache: 'no-store' });
  return res.json();
}

// GET /api/debug?page=yaakovtzedekcom  → diagnostic view of what the API returns
export async function GET(req: NextRequest) {
  const token = await requireUserToken();
  if (!token) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
  }

  const pageQuery = req.nextUrl.searchParams.get('page'); // username or id
  const out: any = {};

  // 1. Granted permissions
  try {
    const perms = await g('me/permissions', token);
    out.granted_permissions = (perms.data || [])
      .filter((p: any) => p.status === 'granted')
      .map((p: any) => p.permission);
  } catch (e: any) {
    out.permissions_error = e.message;
  }

  // 2. /me/accounts
  try {
    const acc = await g('me/accounts', token, 'id,name,tasks');
    out.me_accounts_count = (acc.data || []).length;
    out.me_accounts = (acc.data || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      tasks: p.tasks,
    }));
    if (acc.error) out.me_accounts_error = acc.error;
  } catch (e: any) {
    out.me_accounts_error = e.message;
  }

  // 3. Businesses
  try {
    const biz = await g('me/businesses', token, 'id,name');
    out.businesses = biz.data || [];
    if (biz.error) out.businesses_error = biz.error;
    // owned + client pages per business
    out.business_pages = {};
    for (const b of out.businesses) {
      const owned = await g(`${b.id}/owned_pages`, token, 'id,name');
      const client = await g(`${b.id}/client_pages`, token, 'id,name');
      out.business_pages[b.name || b.id] = {
        owned: (owned.data || []).map((p: any) => p.name),
        owned_error: owned.error,
        client: (client.data || []).map((p: any) => p.name),
        client_error: client.error,
      };
    }
  } catch (e: any) {
    out.businesses_error = e.message;
  }

  // 4. Look up the specific page
  if (pageQuery) {
    try {
      const p = await g(
        pageQuery,
        token,
        'id,name,access_token,tasks,category'
      );
      out.target_page = {
        id: p.id,
        name: p.name,
        category: p.category,
        tasks: p.tasks,
        has_access_token: !!p.access_token,
        error: p.error,
      };
    } catch (e: any) {
      out.target_page_error = e.message;
    }
  }

  return NextResponse.json(out, { status: 200 });
}
