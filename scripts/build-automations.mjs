// Build (or rebuild) comment→reply→DM automations for a list of Instagram posts
// from a plan file, through the admin API. Idempotent per run: it deletes any
// existing automation with the same name before creating it, so the plan file
// is the single source of truth after the 20.9 database migration.
//
//   node scripts/build-automations.mjs scripts/automations-plan.json [--dry]
//
// Plan item: { name, shortcode, keywords[], public_replies[], dm_message,
//              dm_link, since? (ISO, backdate to catch existing comments) }
// Items with shortcode "*" create an all_posts catch-all instead.
import fs from 'node:fs';

const BASE = 'https://socialflow-app-delta.vercel.app';
const KEY = 'socialflow_verify_2026';
const PAGE_ID = '101652738570900';

const [, , planPath, flag] = process.argv;
const dry = flag === '--dry';
const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));

async function api(path, init) {
  const r = await fetch(`${BASE}${path}${path.includes('?') ? '&' : '?'}key=${KEY}`, init);
  const text = await r.text();
  try { return { ok: r.ok, status: r.status, json: JSON.parse(text) }; } catch { return { ok: r.ok, status: r.status, json: { raw: text.slice(0, 200) } }; }
}

const existing = (await api('/api/admin/manage')).json.automations || [];
console.log(`existing automations: ${existing.length}`);

for (const item of plan) {
  const dupes = existing.filter((a) => a.name === item.name);
  for (const d of dupes) {
    if (dry) { console.log(`[dry] would delete ${d.id} (${d.name})`); continue; }
    const del = await api('/api/admin/manage', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'delete', id: d.id }) });
    console.log(`deleted ${d.id} (${d.name}) -> ${del.status}`);
  }
  const body = {
    page_id: PAGE_ID,
    name: item.name,
    platform: 'instagram',
    scope: item.shortcode === '*' ? 'all_posts' : 'specific_post',
    shortcode: item.shortcode === '*' ? undefined : item.shortcode,
    keywords: item.keywords || [],
    public_replies: item.public_replies || [],
    dm_message: item.dm_message,
    dm_link: item.dm_link || null,
    since: item.since || null,
  };
  if (dry) { console.log(`[dry] would create`, JSON.stringify(body).slice(0, 160)); continue; }
  const r = await api('/api/admin/create-automation', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  console.log(`${item.name} -> ${r.status} ${JSON.stringify(r.json).slice(0, 160)}`);
  await new Promise((res) => setTimeout(res, 400));
}
console.log('done');
