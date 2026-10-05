import { sql, ensureSchema } from './db';
import { graphGet } from './meta';
import { fetchAdChecks, resolveAdMedia, hasAdSurfaces, type AdCheck, type AdLink, type GraphGet } from './ad-comments';

/**
 * Which ad media carry comments for an organic Instagram post (see lib/ad-comments.ts).
 *
 * Cached in ad_media_checks (what Meta says about the post's ads, refreshed
 * every 30 minutes, every 6 hours when Meta refuses the fields) and
 * ad_media_links (organic media -> ad media; permanent once known). The poller
 * calls this for every Instagram automation, so a whole run asks the database
 * once per media and Meta once per 50 stale media.
 */

const CHECK_FRESH_MS = 30 * 60_000;
const UNSUPPORTED_RETRY_MS = 6 * 3600_000;

/** META_ADS_GRAPH_VERSION lets the ad fields use a newer Graph version than the rest of the app. */
const adsGet: GraphGet = (path, params) => {
  const v = process.env.META_ADS_GRAPH_VERSION;
  if (!v) return graphGet(path, params);
  const url = new URL(`https://graph.facebook.com/${v}/${path}`);
  Object.entries(params).forEach(([k, val]) => url.searchParams.set(k, val));
  return fetch(url.toString(), { cache: 'no-store' }).then(async (r) => {
    const d = await r.json();
    if (!r.ok || d?.error) throw new Error(`${d?.error?.message || `Graph API error (${r.status})`}${d?.error?.code != null ? ` (code ${d.error.code})` : ''}`);
    return d;
  });
};

export interface AdSurfaceInfo {
  check: (AdCheck & { ads_read_missing: boolean }) | null;
  links: AdLink[];
}

export type AdRunCache = Map<string, AdSurfaceInfo>;

/**
 * For each organic media id: its ad check and the ad media to read.
 * `exclude` = ad media ids that already have their own automation (the manual
 * workaround from 1.10), so a comment there is not answered twice.
 * Never throws; on any failure the media simply has no ad links.
 */
export async function adSurfacesFor(mediaIds: string[], token: string, opts: { cache?: AdRunCache; exclude?: Set<string> } = {}): Promise<Map<string, AdSurfaceInfo>> {
  const out = new Map<string, AdSurfaceInfo>();
  const cache = opts.cache;
  const want = Array.from(new Set(mediaIds.filter(Boolean)));
  const todo = want.filter((id) => !cache?.has(id));
  try {
    if (todo.length) {
      await ensureSchema();
      const rows = await sql!`SELECT * FROM ad_media_checks WHERE media_id = ANY(${todo})`;
      const byId = new Map<string, any>(rows.map((r: any) => [String(r.media_id), r]));
      const now = Date.now();
      const stale = todo.filter((id) => {
        const r = byId.get(id);
        if (!r) return true;
        const age = now - new Date(r.checked_at).getTime();
        return age > (r.unsupported ? UNSUPPORTED_RETRY_MS : CHECK_FRESH_MS);
      });
      const known = await sql!`SELECT media_id, ad_media_id, ad_id FROM ad_media_links WHERE media_id = ANY(${todo})`;
      const linksBy = new Map<string, AdLink[]>();
      for (const l of known as any[]) {
        const arr = linksBy.get(String(l.media_id)) || [];
        arr.push({ ad_media_id: String(l.ad_media_id), ad_id: l.ad_id ? String(l.ad_id) : null });
        linksBy.set(String(l.media_id), arr);
      }

      if (stale.length) {
        const fresh = await fetchAdChecks(stale, token, adsGet);
        for (const id of stale) {
          const c = fresh[id];
          if (!c) continue;
          let adsReadMissing = byId.get(id)?.ads_read_missing ?? false;
          // Resolve ads we have no media for yet (one call per new ad, only when the check is refreshed).
          const linkedAds = new Set((linksBy.get(id) || []).map((l) => l.ad_id).filter(Boolean));
          for (const adId of c.ad_ids.filter((a) => !linkedAds.has(a)).slice(0, 5)) {
            const r = await resolveAdMedia(adId, token, adsGet);
            if (r.ad_media_id) {
              adsReadMissing = false;
              await sql!`INSERT INTO ad_media_links (media_id, ad_media_id, ad_id, source) VALUES (${id}, ${r.ad_media_id}, ${adId}, 'marketing_api') ON CONFLICT DO NOTHING`;
              const arr = linksBy.get(id) || [];
              arr.push({ ad_media_id: r.ad_media_id, ad_id: adId });
              linksBy.set(id, arr);
            } else if (r.permission_missing) {
              adsReadMissing = true;
            }
          }
          await sql!`
            INSERT INTO ad_media_checks (media_id, organic_comments, total_comments, ad_ids, ads_read_missing, unsupported, checked_at)
            VALUES (${id}, ${c.organic_comments}, ${c.total_comments}, ${c.ad_ids}, ${adsReadMissing}, ${c.unsupported}, now())
            ON CONFLICT (media_id) DO UPDATE SET organic_comments = EXCLUDED.organic_comments, total_comments = EXCLUDED.total_comments,
              ad_ids = EXCLUDED.ad_ids, ads_read_missing = EXCLUDED.ads_read_missing, unsupported = EXCLUDED.unsupported, checked_at = now()`;
          byId.set(id, { ...c, ads_read_missing: adsReadMissing });
        }
      }
      for (const id of todo) {
        const r = byId.get(id);
        const check = r ? {
          organic_comments: r.organic_comments ?? null, total_comments: r.total_comments ?? null,
          ad_ids: Array.isArray(r.ad_ids) ? r.ad_ids.map(String) : [], unsupported: !!r.unsupported, ads_read_missing: !!r.ads_read_missing,
        } : null;
        cache?.set(id, { check, links: linksBy.get(id) || [] });
        out.set(id, { check, links: linksBy.get(id) || [] });
      }
    }
  } catch (e) {
    console.error('adSurfacesFor failed', e);
  }
  for (const id of want) {
    const info = out.get(id) || cache?.get(id) || { check: null, links: [] };
    out.set(id, { check: info.check, links: info.links.filter((l) => !opts.exclude?.has(l.ad_media_id)) });
  }
  return out;
}

/** Link an ad media to its organic post by hand or from a webhook (idempotent). */
export async function linkAdMedia(mediaId: string, adMediaId: string, source: 'manual' | 'webhook', adId?: string | null) {
  if (!mediaId || !adMediaId || mediaId === adMediaId) return;
  await ensureSchema();
  await sql!`INSERT INTO ad_media_links (media_id, ad_media_id, ad_id, source) VALUES (${mediaId}, ${adMediaId}, ${adId || null}, ${source}) ON CONFLICT DO NOTHING`;
}

export { hasAdSurfaces };
