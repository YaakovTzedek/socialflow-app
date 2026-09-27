// Comment→reply→DM on the Reelsi 9.90 ad posts (27.9.2026). Ad posts are unpublished (dark) posts,
// so the all_posts scan (published_posts / IG media) never sees them: each ad needs its own
// specific_post automation, on Facebook (effective_object_story_id) and on Instagram
// (effective_instagram_media_id). Idempotent by name.
//   node scripts/reelsi-ads-automations.mjs scripts/reelsi-ads.json [--dry]
import fs from 'node:fs';
const BASE = 'https://socialflow-app-delta.vercel.app';
const KEY = 'socialflow_verify_2026';
const PAGE_ID = '1253073904565824';
const [, , planPath, flag] = process.argv;
const dry = flag === '--dry';
const ads = JSON.parse(fs.readFileSync(planPath, 'utf8'));
const DM = 'היי :) נעים מאוד, אנחנו Reelsi 🎬\nאיתנו אפשר להפוך כל תוכן ארוך שיש לך להמון רילסים ויראליים, עם כתוביות והמיתוג שלך.\n\nאפשר לנסות את רילסי ולראות את התוצר שלנו ב-9.90 ₪ כאן:';
const REPLIES = ['שלחנו לך קישור בפרטי 📩', 'נשלח! בדקו את ההודעות 🙌', 'הקישור מחכה לך בפרטי 🎬'];
async function api(path, init) {
  const r = await fetch(`${BASE}${path}${path.includes('?') ? '&' : '?'}key=${KEY}`, init);
  const t = await r.text();
  try { return { status: r.status, json: JSON.parse(t) }; } catch { return { status: r.status, json: { raw: t.slice(0, 200) } }; }
}
const existing = (await api('/api/admin/manage')).json.automations || [];
for (const ad of ads) {
  for (const [platform, postId] of [['facebook', ad.fb], ['instagram', ad.ig]]) {
    if (!postId) continue;
    const name = `Reelsi ad · ${ad.slug} · ${platform === 'facebook' ? 'FB' : 'IG'}`;
    if (existing.some((a) => a.name === name)) { console.log(`exists: ${name}`); continue; }
    const body = { page_id: PAGE_ID, name, platform, scope: 'specific_post', media_id: postId, keywords: [], public_replies: REPLIES, dm_message: DM,
      dm_link: `https://reelsi.tzedek.media/first?utm_source=${platform}&utm_medium=comment-dm&utm_campaign=reelsi-first-990&utm_content=${ad.slug}`,
      since: '2026-09-27T05:00:00Z' };
    if (dry) { console.log('[dry]', name, postId); continue; }
    const r = await api('/api/admin/create-automation', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    console.log(`${name} -> ${r.status} ${JSON.stringify(r.json).slice(0, 120)}`);
    await new Promise((res) => setTimeout(res, 300));
  }
}
