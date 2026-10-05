/**
 * Comments on the sponsored (ad) copies of an Instagram post.
 *
 * 5.10.2026 (Tolik): "the bot says my reel has 0 comments, but there are 5 on
 * the profile, all from the paid version". Meta keeps comments made on an ad
 * that runs an Instagram post on a SEPARATE media object (the ad creative's
 * effective_instagram_media_id). The organic `GET /{media}/comments` edge and
 * `comments_count` never include them; Meta's docs say so and point to the
 * Marketing API for the ad media id. What the Instagram permissions SocialFlow
 * has do give us:
 *   - `total_comments_count`: comments on the media across all surfaces,
 *     including its promoted/boosted copies, so we can at least SAY how many
 *     sponsored comments exist;
 *   - `boost_ads_list`: the ACTIVE ads that run this media (ad id + status).
 * Turning an ad id into the ad media id (`GET /{ad}?fields=creative{effective_instagram_media_id}`)
 * needs `ads_read`, which SocialFlow does not request today. When it fails
 * with a permission error we record that, and the ad media can still be linked
 * by hand or from the comments webhook (lib/ad-media.ts).
 *
 * This file has no imports on purpose: it is the pure part (parsing, merging,
 * dedupe) and is unit tested with `node --test` against a mocked Graph.
 */

export interface IgComment {
  id: string;
  text?: string;
  username?: string;
  timestamp?: string;
  like_count?: number;
  replies?: { data?: Array<{ username?: string }> };
}

export interface SurfacedComment extends IgComment {
  /** true = made on an ad copy of the post, not on the post itself. */
  sponsored: boolean;
  /** The media id the comment lives on (the organic id, or the ad media id). */
  source_media_id: string;
  ad_id?: string | null;
}

export interface AdLink { ad_media_id: string; ad_id?: string | null }

export interface AdCheck {
  organic_comments: number | null;
  total_comments: number | null;
  ad_ids: string[];
  /** Meta refused the fields (older Graph version or not available for this media). */
  unsupported: boolean;
}

export type GraphGet = (path: string, params: Record<string, string>) => Promise<any>;

/** boost_ads_list arrives as an array or as {data:[...]}, keys ad_id/ad_status (tolerate id/status). */
export function parseBoostAdsList(v: unknown): Array<{ ad_id: string; ad_status: string | null }> {
  const list: any[] = Array.isArray(v) ? v : Array.isArray((v as any)?.data) ? (v as any).data : [];
  const out: Array<{ ad_id: string; ad_status: string | null }> = [];
  for (const x of list) {
    const id = String(x?.ad_id ?? x?.id ?? '').trim();
    if (id && !out.some((o) => o.ad_id === id)) out.push({ ad_id: id, ad_status: x?.ad_status ?? x?.status ?? null });
  }
  return out;
}

export function parseAdCheck(m: any): AdCheck {
  const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : null);
  return {
    organic_comments: num(m?.comments_count),
    total_comments: num(m?.total_comments_count),
    ad_ids: parseBoostAdsList(m?.boost_ads_list).map((a) => a.ad_id),
    unsupported: false,
  };
}

/** Comments that exist on ad copies, by Meta's own counts (null when unknown). */
export function sponsoredCommentCount(c: Pick<AdCheck, 'organic_comments' | 'total_comments'> | null | undefined): number | null {
  if (!c || c.total_comments == null || c.organic_comments == null) return null;
  return Math.max(0, c.total_comments - c.organic_comments);
}

/** Does this media need its ad copies read? */
export function hasAdSurfaces(c: AdCheck | null | undefined): boolean {
  if (!c) return false;
  return c.ad_ids.length > 0 || (sponsoredCommentCount(c) ?? 0) > 0;
}

export const FIELD_TIERS = ['comments_count,total_comments_count,boost_ads_list', 'comments_count,boost_ads_list'];

/**
 * Ask Meta, in one call per 50 media, for each media's ad information.
 * Never throws: a refused call marks those media `unsupported`.
 */
export async function fetchAdChecks(mediaIds: string[], token: string, get: GraphGet): Promise<Record<string, AdCheck>> {
  const out: Record<string, AdCheck> = {};
  const uniq = Array.from(new Set(mediaIds.filter(Boolean)));
  for (let i = 0; i < uniq.length; i += 50) {
    const chunk = uniq.slice(i, i + 50);
    let data: any = null;
    // Newest fields first; an older Graph version refuses an unknown field for the whole call, so step down.
    for (const fields of FIELD_TIERS) {
      try { data = await get('', { ids: chunk.join(','), fields, access_token: token }); break; }
      catch { data = null; }
    }
    for (const id of chunk) out[id] = data && typeof data[id] === 'object' ? parseAdCheck(data[id]) : { organic_comments: null, total_comments: null, ad_ids: [], unsupported: true };
  }
  return out;
}

/** "(#10)", "(#200)".."(#299)", code 10/2xx, or the word permission: the token lacks ads_read (or the ad account). */
export function isPermissionError(message: unknown): boolean {
  return /\(#(10|2\d\d)\)|\bcode[":\s]*(10|2\d\d)\b(?!\d)|permission/i.test(String(message || ''));
}

/** Ad id -> the media id its comments live on. Needs ads_read on the token. */
export async function resolveAdMedia(adId: string, token: string, get: GraphGet): Promise<{ ad_media_id: string | null; permission_missing: boolean; error?: string }> {
  try {
    const d = await get(adId, { fields: 'creative{effective_instagram_media_id}', access_token: token });
    const id = d?.creative?.effective_instagram_media_id ? String(d.creative.effective_instagram_media_id) : null;
    return { ad_media_id: id, permission_missing: false };
  } catch (e: any) {
    return { ad_media_id: null, permission_missing: isPermissionError(e?.message), error: String(e?.message || e) };
  }
}

/**
 * Organic comments first, then each ad copy's, deduplicated by comment id
 * (an id seen on the organic edge stays organic). An ad media equal to the
 * organic id is skipped. Newest first.
 */
export function mergeComments(organicMediaId: string, organic: IgComment[], ads: Array<AdLink & { comments: IgComment[] }>): SurfacedComment[] {
  const seen = new Set<string>();
  const out: SurfacedComment[] = [];
  for (const c of organic || []) {
    if (!c?.id || seen.has(c.id)) continue;
    seen.add(c.id);
    out.push({ ...c, sponsored: false, source_media_id: organicMediaId });
  }
  const adSeen = new Set<string>();
  for (const ad of ads || []) {
    if (!ad?.ad_media_id || ad.ad_media_id === organicMediaId || adSeen.has(ad.ad_media_id)) continue;
    adSeen.add(ad.ad_media_id);
    for (const c of ad.comments || []) {
      if (!c?.id || seen.has(c.id)) continue;
      seen.add(c.id);
      out.push({ ...c, sponsored: true, source_media_id: ad.ad_media_id, ad_id: ad.ad_id ?? null });
    }
  }
  const t = (c: SurfacedComment) => (c.timestamp ? Date.parse(c.timestamp) || 0 : 0);
  return out.map((c, i) => ({ c, i })).sort((a, b) => t(b.c) - t(a.c) || a.i - b.i).map((x) => x.c);
}

/**
 * Read a post's comments on every surface we know: the organic edge (an error
 * there throws, as before) and each linked ad media (errors collected, never thrown).
 */
export async function collectComments(
  organicMediaId: string,
  links: AdLink[],
  list: (mediaId: string) => Promise<IgComment[]>,
): Promise<{ comments: SurfacedComment[]; ad_errors: Array<{ ad_media_id: string; error: string }> }> {
  const organic = await list(organicMediaId);
  const ad_errors: Array<{ ad_media_id: string; error: string }> = [];
  const ads = await Promise.all((links || []).filter((l) => l.ad_media_id && l.ad_media_id !== organicMediaId).map(async (l) => {
    try { return { ...l, comments: await list(l.ad_media_id) }; }
    catch (e: any) { ad_errors.push({ ad_media_id: l.ad_media_id, error: String(e?.message || e) }); return { ...l, comments: [] as IgComment[] }; }
  }));
  return { comments: mergeComments(organicMediaId, organic, ads), ad_errors };
}
