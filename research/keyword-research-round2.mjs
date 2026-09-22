import { readFileSync, writeFileSync } from "node:fs";
for (const l of readFileSync("/Users/tzedekmedia/marketing-os/.env.local","utf8").split("\n")) { const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if(m&&!process.env[m[1]]) process.env[m[1]]=m[2].replace(/^["']|["']$/g,""); }
const SU=process.env.NEXT_PUBLIC_SUPABASE_URL, SK=process.env.SUPABASE_SERVICE_ROLE_KEY;
let S={}; { const r=await fetch(SU+"/storage/v1/object/settings/agency-keys.json",{headers:{apikey:SK,Authorization:"Bearer "+SK}}); if(r.ok) S=await r.json(); }
const sec=k=>S[k]??process.env[k];
const tok=await (await fetch("https://oauth2.googleapis.com/token",{method:"POST",body:new URLSearchParams({client_id:sec("GOOGLE_OAUTH_CLIENT_ID"),client_secret:sec("GOOGLE_OAUTH_CLIENT_SECRET"),refresh_token:sec("GOOGLE_OAUTH_REFRESH_TOKEN"),grant_type:"refresh_token"})})).json();
if(!tok.access_token){ console.log("❌ טוקן:",tok.error_description||tok.error); process.exit(2); }
const H={Authorization:`Bearer ${tok.access_token}`,"developer-token":sec("GOOGLE_ADS_DEVELOPER_TOKEN"),"login-customer-id":"8285213443","Content-Type":"application/json","x-goog-user-project":(sec("GOOGLE_ADS_QUOTA_PROJECT")||"").replace(/^"|"$/g,"")};
const CID="5652227291";
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function ideas(seeds,geo,lang,attempt=1){
  const r=await fetch(`https://googleads.googleapis.com/v22/customers/${CID}:generateKeywordIdeas`,{method:"POST",headers:H,
    body:JSON.stringify({keywordSeed:{keywords:seeds},geoTargetConstants:[geo],language:lang,keywordPlanNetwork:"GOOGLE_SEARCH",includeAdultKeywords:false})});
  if(r.status===429&&attempt<=4){ const w=attempt*20000; console.log(`     429, ${w/1000}ש`); await sleep(w); return ideas(seeds,geo,lang,attempt+1); }
  if(!r.ok){ console.log(`  ⚠️ ${seeds[0]}: ${r.status}`); return null; }
  return await r.json();
}
const RUNS=[
 {name:"עברית · ישראל · סבב 2", geo:"geoTargetConstants/2376", lang:"languageConstants/1027", file:"sf-he2.tsv", seeds:[
   ["מאני צאט","מאניצאט","manychat מחיר","manychat בעברית","חלופה ל manychat"],
   ["מענה אוטומטי","בוט מכירות","שירות לקוחות אוטומטי","בוט לעסק","צאט בוט לאתר"],
   ["וואטסאפ עסקי","whatsapp business","לידים מפייסבוק","אוטומציה לעסקים","כלי שיווק דיגיטלי"],
   ["אינסטגרם לעסקים","עוקבים באינסטגרם","סטורי באינסטגרם","רילס","פרסום באינסטגרם"],
 ]},
 {name:"אנגלית · ארה\"ב · סבב 2", geo:"geoTargetConstants/2840", lang:"languageConstants/1000", file:"sf-en2.tsv", seeds:[
   ["chatfuel","instachamp","respond.io","tidio","landbot"],
   ["manychat pricing","manychat review","manychat vs","is manychat free","manychat tutorial"],
   ["wati","botpenguin","sendpulse","chatrace","manybot"],
   ["best instagram automation tool","instagram automation software","social media inbox","unified inbox","customer messaging platform"],
 ]},
];
for(const run of RUNS){
  console.log(`════ ${run.name} ════`);
  const all=new Map();
  for(const seed of run.seeds){
    const j=await ideas(seed,run.geo,run.lang);
    if(j) for(const x of j.results||[]){
      const m=x.keywordIdeaMetrics||{};
      if(!all.has(x.text)) all.set(x.text,{kw:x.text,v:Number(m.avgMonthlySearches||0),c:m.competition||"—",
        lo:Number(m.lowTopOfPageBidMicros||0)/1e6,hi:Number(m.highTopOfPageBidMicros||0)/1e6});
    }
    console.log(`  ✓ ${seed[0]} → ${all.size}`);
    await sleep(8000);
  }
  const rows=[...all.values()].sort((a,b)=>b.v-a.v);
  writeFileSync("/private/tmp/claude-501/-Users-tzedekmedia-tzedek-me/5fc309b6-7f16-446b-932a-b0f5dd897f88/scratchpad/"+run.file,
    "keyword\tvolume\tcompetition\tcpc_low\tcpc_high\n"+rows.map(r=>`${r.kw}\t${r.v}\t${r.c}\t${r.lo.toFixed(2)}\t${r.hi.toFixed(2)}`).join("\n"));
  console.log(`  📊 ${rows.length} → ${run.file}\n`);
}
