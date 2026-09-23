import { PLAN_CATALOG, TRIAL } from '@/lib/plans';
import { MC, MC_CHECKED, MC_SOURCES, ils, mcMonthCost, rate, type Source } from '@/content/compare';

/**
 * /manychat-pricing: the page for "manychat pricing", "is manychat free" and
 * "manychat cost". English everywhere, Hebrew in Hebrew.
 *
 * Every ManyChat number is read from MC in content/compare.ts and every
 * SocialFlow number from PLAN_CATALOG, so the worked examples recompute
 * themselves when either side changes a price.
 */

export interface PricingPage {
  title: string;
  metaTitle: string;
  description: string;
  keywords: string;
  lead: string;
  checked: string;
  tldrTitle: string;
  tldr: string[];
  tiersTitle: string;
  tiersHead: string[];
  tiers: string[][];
  tiersNote: string;
  body1: string;
  exampleTitle: string;
  exampleHead: string[];
  example: string[][];
  exampleNote: string;
  body2: string;
  usTitle: string;
  usHead: string[];
  us: string[][];
  body3: string;
  faqTitle: string;
  faqs: { q: string; a: string }[];
  sourcesTitle: string;
  sourcesNote: string;
  sources: Source[];
  ctaTitle: string;
  ctaText: string;
  ctaBtn: string;
  ctaSecondary: string;
  relatedTitle: string;
  related: { path: string; label: string }[];
}

const TIERS = ['essential', 'pro', 'business', 'advanced'] as const;
const NAME: Record<(typeof TIERS)[number], string> = { essential: 'Essential', pro: 'Pro', business: 'Business', advanced: 'Advanced' };

const SPIKE = 3000;
const BIG = 10000;
const usd = (n: number) => `$${Number.isInteger(n) ? n.toLocaleString('en') : n.toFixed(2)}`;
const n = (x: number) => x.toLocaleString('en');

const C = PLAN_CATALOG;
const spike = Object.fromEntries(TIERS.map((t) => [t, mcMonthCost(t, SPIKE)])) as Record<(typeof TIERS)[number], ReturnType<typeof mcMonthCost>>;
const big = Object.fromEntries(TIERS.map((t) => [t, mcMonthCost(t, BIG)])) as Record<(typeof TIERS)[number], ReturnType<typeof mcMonthCost>>;

/** The cheapest SocialFlow plan whose monthly message allowance covers `dms`. */
function sfPlanFor(dms: number) {
  return (['free', 'creator', 'pro', 'agency'] as const).map((id) => C[id]).find((p) => p.limits.dmsPerMonth >= dms) ?? C.agency;
}
const sfSpike = sfPlanFor(SPIKE);
const sfBig = sfPlanFor(BIG);

/* -------------------------------------------------------------------------- */
/* English                                                                     */
/* -------------------------------------------------------------------------- */

const en: PricingPage = {
  title: 'ManyChat Pricing in 2026: What It Actually Costs',
  metaTitle: 'ManyChat Pricing in 2026: What It Actually Costs',
  description: `ManyChat pricing in 2026: a free plan with ${MC.free.contacts} active contacts, then Essential $${MC.essential.usd}, Pro $${MC.pro.usd}, Business $${MC.business.usd} and Advanced $${MC.advanced.usd} a month, plus overage per contact. Is ManyChat free, what ManyChat costs in a busy month, and a worked example.`,
  keywords: 'manychat pricing, is manychat free, manychat cost, manychat price, manychat plans, manychat free plan, manychat active contacts, manychat overage',
  lead: `ManyChat has a free plan and four paid tiers: Essential at $${MC.essential.usd}, Pro at $${MC.pro.usd}, Business at $${MC.business.usd} and Advanced at $${MC.advanced.usd} a month on monthly billing, or $${MC.essential.yearly}, $${MC.pro.yearly}, $${MC.business.yearly} and $${MC.advanced.yearly} a month billed yearly. Each tier includes a set number of active contacts, and every contact past it is billed as overage on your next invoice.`,
  checked: `Prices checked on ${MC_CHECKED.en}. Sources at the bottom of the page.`,

  tldrTitle: 'The short answer',
  tldr: [
    `Is ManyChat free? Yes, up to ${MC.free.contacts} active contacts a month, with "Powered by Manychat" branding on your messages.`,
    `Paid plans start at $${MC.essential.usd} a month (Essential, ${n(MC.essential.contacts)} contacts), and Pro is $${MC.pro.usd} (${n(MC.pro.contacts)} contacts).`,
    'You pay per active contact: anyone who interacted with your account this billing month. One comment is enough to count.',
    `Past the included contacts, automations keep running and each extra contact is billed: $${rate(MC.essential.over)} on Essential, $${rate(MC.pro.over)} on Pro, $${rate(MC.business.over)} on Business.`,
    `A month where one reel brings ${n(SPIKE)} commenters costs ${usd(spike.pro.total)} on Pro and ${usd(spike.essential.total)} on Essential.`,
    `SocialFlow bills per private message sent instead, and stops at the limit rather than billing overage. ${n(SPIKE)} messages fit in ${sfSpike.name} at $${sfSpike.priceUsd} a month.`,
  ],

  tiersTitle: 'ManyChat plans and prices, 2026',
  tiersHead: ['Plan', 'Monthly billing', 'Billed yearly, per month', 'Active contacts included', 'Each extra contact (monthly / yearly)'],
  tiers: [
    ['Free', '$0', '$0', n(MC.free.contacts), 'No overage, upgrade to grow'],
    ...TIERS.map((t) => [NAME[t], `$${MC[t].usd}`, `$${MC[t].yearly}`, n(MC[t].contacts), `$${rate(MC[t].over)} / $${rate(MC[t].overYearly)}`]),
  ],
  tiersNote: 'Prices in US dollars, before any sales tax. ManyChat moved to this five-plan structure on 2 March 2026; older accounts may still be on legacy pricing.',

  body1: `
<h2 id="is-manychat-free">Is ManyChat free?</h2>
<p>Yes, there is a permanent free plan. It is small: <strong>${MC.free.contacts} active contacts a month</strong>, up to ${MC.free.automations} live automations, ${MC.free.channels} channels and ${MC.free.seats} user seat.</p>
<p>What it does not include: AI features, broadcasts, WhatsApp, SMS and email. Messages carry "Powered by Manychat" branding. There is no overage on the free plan, so once you pass ${MC.free.contacts} contacts the answer is an upgrade.</p>
<p>For a comment to DM funnel, ${MC.free.contacts} contacts is roughly one post that gets a little traction. Treat it as a test, not a plan.</p>

<h2 id="active-contacts">What an active contact is, and why it drives the price</h2>
<p>ManyChat does not bill by messages or by automations. It bills by <strong>active contacts</strong>: every person who interacted with your account through ManyChat during the current billing month.</p>
<p>A person who commented once on a reel and never came back counts exactly like a buyer. The same person writing five times still counts as one. The count resets at the start of each billing cycle.</p>
<p>So the number that sets your bill is how many different people engaged with you this month. The better a post performs, the higher that number goes.</p>

<h2 id="where-the-price-jumps">Where the price jumps</h2>
<p>The price moves in two ways, and both depend on your audience rather than on you.</p>
<ul>
<li><strong>Tier steps.</strong> Essential covers ${n(MC.essential.contacts)} contacts, Pro ${n(MC.pro.contacts)}, Business ${n(MC.business.contacts)}, Advanced ${n(MC.advanced.contacts)}. Growing from one band to the next is a step from $${MC.essential.usd} to $${MC.pro.usd} to $${MC.business.usd} to $${MC.advanced.usd}.</li>
<li><strong>Overage inside a tier.</strong> Pass your included contacts and, per ManyChat's help centre, your automations keep running and the extra contacts are added automatically to your next bill. ManyChat sends notices at ${MC.alerts.join('%, ')}% of the quota, but nothing stops the meter.</li>
</ul>
<p>Overage on the lower tiers is the expensive part. On Essential every extra contact costs $${rate(MC.essential.over)}, which is why a single busy month on the entry plan can cost more than a year of it.</p>
`,

  exampleTitle: `Worked example: a month where one reel brings ${n(SPIKE)} commenters`,
  exampleHead: ['ManyChat plan', 'Base price', `Contacts past the quota`, 'Overage', `Bill for ${n(SPIKE)} contacts`, `Bill for ${n(BIG)} contacts`],
  example: TIERS.map((t) => [
    NAME[t],
    usd(spike[t].base),
    n(spike[t].extra),
    usd(spike[t].overage),
    usd(spike[t].total),
    usd(big[t].total),
  ]),
  exampleNote: `Monthly billing, each commenter counted once. ${n(SPIKE)} people comment a keyword and each gets a private message: every one of them is an active contact. The last column shows the same month at ${n(BIG)} contacts.`,

  body2: `
<h2 id="reading-the-example">What the example shows</h2>
<p>On <strong>Pro</strong>, ${n(SPIKE)} commenters is ${n(spike.pro.extra)} contacts past the ${n(MC.pro.contacts)} included, at $${rate(MC.pro.over)} each: ${usd(spike.pro.overage)} on top of $${MC.pro.usd}, so ${usd(spike.pro.total)} for the month.</p>
<p>On <strong>Essential</strong> the same month is ${n(spike.essential.extra)} extra contacts at $${rate(MC.essential.over)}: ${usd(spike.essential.overage)} of overage and a ${usd(spike.essential.total)} bill on a $${MC.essential.usd} plan.</p>
<p>At ${n(BIG)} contacts, Pro reaches ${usd(big.pro.total)}, and Business at ${usd(big.business.total)} becomes the cheaper choice. In other words you have to guess next month's audience to pick the right tier, and the reel that went well is the one that costs you.</p>

<h2 id="socialflow-pricing">How SocialFlow prices the same job</h2>
<p><a href="/">SocialFlow</a> answers people who comment on your Instagram and Facebook posts, with a public reply and a private message containing your link. It bills on a different meter.</p>
<ul>
<li><strong>Per private message sent, not per person.</strong> The meter is what the system did for you. If the same person comments five times and gets one message, that is one message.</li>
<li><strong>It stops at the limit instead of billing overage.</strong> When you reach your monthly allowance, sending pauses and you get an alert. No line appears on next month's invoice that nobody approved.</li>
<li><strong>Shekels or dollars.</strong> In Israel you pay in shekels, VAT included, with a local invoice. Everywhere else you pay in US dollars.</li>
<li><strong>A free plan that fits a real test.</strong> ${n(C.free.limits.dmsPerMonth)} private messages a month, no card.</li>
</ul>
`,

  usTitle: 'SocialFlow plans',
  usHead: ['Plan', 'USD a month', 'ILS a month, VAT included', 'Private messages a month', 'At the limit'],
  us: (['free', 'creator', 'pro', 'agency'] as const).map((id) => [
    C[id].name,
    `$${C[id].priceUsd}`,
    `₪${C[id].priceIls}`,
    n(C[id].limits.dmsPerMonth),
    'Sending pauses, you get an alert',
  ]),

  body3: `
<h2 id="same-month-on-socialflow">The same month on SocialFlow</h2>
<p>${n(SPIKE)} commenters who each get one private message is ${n(SPIKE)} messages. That fits in <strong>${sfSpike.name}</strong>, which includes ${n(sfSpike.limits.dmsPerMonth)} a month, at <strong>$${sfSpike.priceUsd}</strong>. Pro includes ${n(C.pro.limits.dmsPerMonth)} messages at $${C.pro.priceUsd}, so even the ${n(BIG)} month is ${sfBig.name} at $${sfBig.priceUsd}, the same bill as a quiet month.</p>
<p>Pro also carries the parts that are not about price: a built-in MCP server so you can run automations from Claude or ChatGPT, publishing posts and reels from the chat, and ${C.pro.limits.accounts} connected accounts. New customers can try Pro for ${TRIAL.days} days for $${TRIAL.priceUsd}.</p>
<p>For the full side by side, see <a href="/manychat-alternative">SocialFlow as a ManyChat alternative</a>. To see what an automation looks like before you sign up, read <a href="/guide">the setup guide</a>, or the <a href="/instagram-auto-responder">Instagram auto responder</a> page.</p>
`,

  faqTitle: 'ManyChat pricing questions',
  faqs: [
    {
      q: 'Is ManyChat free?',
      a: `ManyChat has a permanent free plan with up to ${MC.free.contacts} active contacts a month, up to ${MC.free.automations} live automations and ${MC.free.channels} channels. It has no AI features and no broadcasts, and messages carry "Powered by Manychat" branding. Past ${MC.free.contacts} contacts you need a paid plan.`,
    },
    {
      q: 'How much does ManyChat cost per month?',
      a: `On monthly billing: Essential $${MC.essential.usd}, Pro $${MC.pro.usd}, Business $${MC.business.usd}, Advanced $${MC.advanced.usd}. Billed yearly the monthly equivalent is $${MC.essential.yearly}, $${MC.pro.yearly}, $${MC.business.yearly} and $${MC.advanced.yearly}. Overage for contacts past the included number is added on top.`,
    },
    {
      q: 'What is an active contact on ManyChat?',
      a: 'Anyone who interacted with your account through ManyChat during the current billing month. One comment is enough to count, repeat interactions by the same person count once, and the count resets each billing cycle.',
    },
    {
      q: 'What happens if I go over my ManyChat contact limit?',
      a: `Per ManyChat's help centre, automations keep running and the extra contacts are billed automatically on your next invoice: $${rate(MC.essential.over)} each on Essential, $${rate(MC.pro.over)} on Pro, $${rate(MC.business.over)} on Business and $${rate(MC.advanced.over)} on Advanced, on monthly billing. Notifications go out at ${MC.alerts.join('%, ')}% of the quota.`,
    },
    {
      q: `How much does ManyChat cost for ${n(SPIKE)} contacts?`,
      a: `On monthly billing, ${usd(spike.essential.total)} on Essential, ${usd(spike.pro.total)} on Pro, and $${MC.business.usd} on Business, where ${n(SPIKE)} is inside the quota. On SocialFlow, ${n(SPIKE)} private messages fit in ${sfSpike.name} at $${sfSpike.priceUsd} a month.`,
    },
    {
      q: 'Is ManyChat cheaper on annual billing?',
      a: `Yes. Billed yearly, Pro works out at $${MC.pro.yearly} a month instead of $${MC.pro.usd}, and the overage rate drops to $${rate(MC.pro.overYearly)} per contact. You commit to the year up front.`,
    },
    {
      q: 'Is there a cheaper alternative to ManyChat for Instagram comments?',
      a: `SocialFlow answers Instagram and Facebook comments with a public reply and a private message, and bills per message sent rather than per contact. Plans are Free (${n(C.free.limits.dmsPerMonth)} messages), Creator $${C.creator.priceUsd}, Pro $${C.pro.priceUsd} and Agency $${C.agency.priceUsd} a month, and sending stops at the limit instead of billing overage.`,
    },
  ],

  sourcesTitle: 'Sources',
  sourcesNote: `ManyChat prices and limits were checked on ${MC_CHECKED.en} against ManyChat's help centre plan articles and a 2026 pricing roundup, and reflect the structure ManyChat launched on 2 March 2026. Pricing changes, so confirm with ManyChat before deciding. SocialFlow figures are read directly from the product plan catalogue.`,
  sources: MC_SOURCES.en,

  ctaTitle: 'Try it on your next post',
  ctaText: `The free plan needs no card: ${n(C.free.limits.dmsPerMonth)} private messages a month. Connect a page, set up one automation, and see how it runs.`,
  ctaBtn: 'Start free',
  ctaSecondary: 'SocialFlow pricing',
  relatedTitle: 'Related',
  related: [
    { path: '/manychat-alternative', label: 'ManyChat alternative: why teams switch to SocialFlow' },
    { path: '/instagram-auto-responder', label: 'Instagram auto responder for comments and DMs' },
    { path: '/pricing', label: 'SocialFlow pricing' },
    { path: '/guide', label: 'The setup guide' },
    { path: '/blog/manychat-2026-pricing-active-contacts', label: 'What active contacts cost under the 2026 pricing' },
  ],
};

/* -------------------------------------------------------------------------- */
/* Hebrew                                                                      */
/* -------------------------------------------------------------------------- */

const he: PricingPage = {
  title: "מחירי ManyChat (מאני צ'אט) ב-2026: כמה זה עולה באמת",
  metaTitle: "מחירי ManyChat (מאני צ'אט) ב-2026: כמה זה עולה באמת",
  description: `כמה עולה ManyChat ב-2026: מסלול חינמי עד ${MC.free.contacts} אנשי קשר, ואז Essential ב-${MC.essential.usd} דולר, Pro ב-${MC.pro.usd}, Business ב-${MC.business.usd} ו-Advanced ב-${MC.advanced.usd} לחודש, ועוד חריגה לכל איש קשר. האם מאני צ'אט חינמי, ודוגמה מחושבת לחודש עמוס.`,
  keywords: "מחירי ManyChat, כמה עולה ManyChat, מאני צ'אט מחיר, מאניצאט, ManyChat חינם, אנשי קשר פעילים, חריגה ManyChat",
  lead: `ל-ManyChat יש מסלול חינמי וארבעה מסלולים בתשלום: Essential ב-${MC.essential.usd} דולר (בערך ${ils(MC.essential.usd)} ש"ח), Pro ב-${MC.pro.usd} דולר (בערך ${ils(MC.pro.usd)} ש"ח), Business ב-${MC.business.usd} ו-Advanced ב-${MC.advanced.usd} דולר לחודש בחיוב חודשי. כל מסלול כולל מכסה של אנשי קשר פעילים, וכל איש קשר מעבר לה מחויב בחשבונית הבאה.`,
  checked: `המחירים נבדקו ב-${MC_CHECKED.he}. המקורות בתחתית העמוד.`,

  tldrTitle: 'התשובה הקצרה',
  tldr: [
    `האם מאני צ'אט חינמי? כן, עד ${MC.free.contacts} אנשי קשר פעילים בחודש, עם המיתוג "Powered by Manychat" בהודעות.`,
    `המסלולים בתשלום מתחילים ב-${MC.essential.usd} דולר לחודש (Essential, ${n(MC.essential.contacts)} אנשי קשר), ו-Pro עולה ${MC.pro.usd} דולר (${n(MC.pro.contacts)} אנשי קשר).`,
    'משלמים לפי איש קשר פעיל: כל מי שיצר אינטראקציה עם החשבון בחודש החיוב. מספיקה תגובה אחת.',
    `מעבר למכסה האוטומציות ממשיכות לרוץ וכל איש קשר נוסף מחויב: ${rate(MC.essential.over)} דולר ב-Essential, ${rate(MC.pro.over)} ב-Pro, ${rate(MC.business.over)} ב-Business.`,
    `חודש שבו ריל אחד מביא ${n(SPIKE)} מגיבים עולה ${usd(spike.pro.total)} ב-Pro ו-${usd(spike.essential.total)} ב-Essential.`,
    `ב-SocialFlow משלמים לפי הודעה פרטית שנשלחה, בשקלים כולל מע"מ, והשליחה נעצרת במכסה במקום חיוב חריגה. ${n(SPIKE)} הודעות נכנסות ב-${sfSpike.name} ב-${sfSpike.priceIls} ש"ח לחודש.`,
  ],

  tiersTitle: 'המסלולים והמחירים של ManyChat ב-2026',
  tiersHead: ['מסלול', 'חיוב חודשי', 'חיוב שנתי, לחודש', 'אנשי קשר כלולים', 'כל איש קשר נוסף (חודשי / שנתי)'],
  tiers: [
    ['חינם', '0 דולר', '0 דולר', n(MC.free.contacts), 'אין חריגה, משדרגים'],
    ...TIERS.map((t) => [NAME[t], `${MC[t].usd} דולר (כ-${ils(MC[t].usd)} ש"ח)`, `${MC[t].yearly} דולר`, n(MC[t].contacts), `${rate(MC[t].over)} / ${rate(MC[t].overYearly)} דולר`]),
  ],
  tiersNote: 'המחירים בדולרים ולא כוללים מע"מ. ההמרה לשקלים היא הערכה בלבד. מבנה חמשת המסלולים הושק ב-2 במרץ 2026, וחשבונות ותיקים עשויים להיות עדיין על תמחור קודם.',

  body1: `
<h2 id="is-manychat-free">האם מאני צ'אט חינמי?</h2>
<p>כן, יש מסלול חינמי קבוע. הוא קטן: <strong>${MC.free.contacts} אנשי קשר פעילים בחודש</strong>, עד ${MC.free.automations} אוטומציות פעילות, ${MC.free.channels} ערוצים ומשתמש אחד.</p>
<p>מה אין בו: יכולות AI, שליחת הודעות תפוצה, וואטסאפ, SMS ומייל. ההודעות יוצאות עם המיתוג "Powered by Manychat". אין בו חריגה, אז אחרי ${MC.free.contacts} אנשי קשר התשובה היא שדרוג.</p>
<p>למשפך של תגובה והודעה פרטית, ${MC.free.contacts} אנשי קשר הם בערך פוסט אחד שתפס קצת. זה מספיק לניסיון, לא לעבודה שוטפת.</p>

<h2 id="active-contacts">מה זה איש קשר פעיל, ולמה הוא קובע את המחיר</h2>
<p>ManyChat לא מחייבת לפי הודעות ולא לפי אוטומציות. היא מחייבת לפי <strong>אנשי קשר פעילים</strong>: כל אדם שיצר אינטראקציה עם החשבון שלכם דרך המערכת במהלך חודש החיוב.</p>
<p>מי שהגיב פעם אחת על ריל ולא חזר נספר בדיוק כמו לקוח שקנה. אותו אדם שכתב חמש פעמים נספר פעם אחת. הספירה מתאפסת בתחילת כל מחזור חיוב.</p>
<p>כלומר המספר שקובע את החשבון הוא כמה אנשים שונים הגיבו לכם החודש. ככל שפוסט מצליח יותר, המספר עולה.</p>

<h2 id="where-the-price-jumps">איפה המחיר קופץ</h2>
<p>המחיר זז בשתי דרכים, ושתיהן תלויות בקהל ולא בכם.</p>
<ul>
<li><strong>מדרגות מסלול.</strong> Essential מכסה ${n(MC.essential.contacts)} אנשי קשר, Pro מכסה ${n(MC.pro.contacts)}, Business מכסה ${n(MC.business.contacts)} ו-Advanced מכסה ${n(MC.advanced.contacts)}. מעבר ממדרגה למדרגה הוא קפיצה מ-${MC.essential.usd} ל-${MC.pro.usd}, ל-${MC.business.usd} ול-${MC.advanced.usd} דולר.</li>
<li><strong>חריגה בתוך המסלול.</strong> לפי מרכז העזרה של ManyChat, כשעוברים את המכסה האוטומציות ממשיכות לרוץ ואנשי הקשר הנוספים מתווספים אוטומטית לחשבונית הבאה. יש התראות ב-${MC.alerts.join('%, ')}% מהמכסה, אבל שום דבר לא עוצר את המונה.</li>
</ul>
<p>החריגה במסלולים הנמוכים היא החלק היקר. ב-Essential כל איש קשר נוסף עולה ${rate(MC.essential.over)} דולר, ולכן חודש עמוס אחד במסלול הכניסה יכול לעלות יותר משנה שלמה שלו.</p>
`,

  exampleTitle: `דוגמה מחושבת: חודש שבו ריל אחד מביא ${n(SPIKE)} מגיבים`,
  exampleHead: ['מסלול ManyChat', 'מחיר בסיס', 'אנשי קשר מעל המכסה', 'חריגה', `החשבון על ${n(SPIKE)}`, `החשבון על ${n(BIG)}`],
  example: TIERS.map((t) => [
    NAME[t],
    usd(spike[t].base),
    n(spike[t].extra),
    usd(spike[t].overage),
    `${usd(spike[t].total)} (כ-${ils(spike[t].total)} ש"ח)`,
    usd(big[t].total),
  ]),
  exampleNote: `חיוב חודשי, כל מגיב נספר פעם אחת. ${n(SPIKE)} אנשים מגיבים במילת מפתח וכל אחד מקבל הודעה פרטית, כלומר כל אחד מהם הוא איש קשר פעיל. העמודה האחרונה מראה את אותו חודש עם ${n(BIG)} אנשי קשר.`,

  body2: `
<h2 id="reading-the-example">מה הדוגמה מראה</h2>
<p>ב-<strong>Pro</strong>, ${n(SPIKE)} מגיבים הם ${n(spike.pro.extra)} אנשי קשר מעל ${n(MC.pro.contacts)} הכלולים, ב-${rate(MC.pro.over)} דולר כל אחד: ${usd(spike.pro.overage)} מעל ${MC.pro.usd} דולר, כלומר ${usd(spike.pro.total)} לחודש.</p>
<p>ב-<strong>Essential</strong> אותו חודש הוא ${n(spike.essential.extra)} אנשי קשר נוספים ב-${rate(MC.essential.over)} דולר: ${usd(spike.essential.overage)} חריגה וחשבון של ${usd(spike.essential.total)} על מסלול של ${MC.essential.usd} דולר.</p>
<p>ב-${n(BIG)} אנשי קשר Pro מגיע ל-${usd(big.pro.total)}, ו-Business ב-${usd(big.business.total)} הופך לזול יותר. כלומר צריך לנחש מראש את הקהל של החודש הבא כדי לבחור מסלול, והריל שהצליח הוא זה שעולה לכם כסף.</p>

<h2 id="socialflow-pricing">איך SocialFlow מתמחרת את אותה עבודה</h2>
<p><a href="/he">SocialFlow</a> עונה למי שמגיב על הפוסטים שלכם באינסטגרם ובפייסבוק, בתגובה ציבורית ובהודעה פרטית עם הקישור. המונה שלה שונה.</p>
<ul>
<li><strong>לפי הודעה פרטית שנשלחה, לא לפי אדם.</strong> המדד הוא מה שהמערכת עשתה בשבילכם. אם אותו אדם הגיב חמש פעמים וקיבל הודעה אחת, נספרה הודעה אחת.</li>
<li><strong>עוצרת במכסה במקום לחייב חריגה.</strong> כשמגיעים להקצאה החודשית השליחה נעצרת ואתם מקבלים התראה. שום שורה לא נכנסת לחשבונית בלי שאישרתם.</li>
<li><strong>שקלים, כולל מע"מ.</strong> בישראל משלמים בשקלים עם חשבונית ישראלית. מחוץ לישראל בדולרים.</li>
<li><strong>מסלול חינמי שמספיק לבדיקה אמיתית.</strong> ${n(C.free.limits.dmsPerMonth)} הודעות פרטיות בחודש, בלי כרטיס אשראי.</li>
</ul>
`,

  usTitle: 'המסלולים של SocialFlow',
  usHead: ['מסלול', 'שקלים לחודש, כולל מע"מ', 'דולרים לחודש', 'הודעות פרטיות בחודש', 'במכסה'],
  us: (['free', 'creator', 'pro', 'agency'] as const).map((id) => [
    C[id].name,
    `${C[id].priceIls} ש"ח`,
    `$${C[id].priceUsd}`,
    n(C[id].limits.dmsPerMonth),
    'השליחה נעצרת, מקבלים התראה',
  ]),

  body3: `
<h2 id="same-month-on-socialflow">אותו חודש ב-SocialFlow</h2>
<p>${n(SPIKE)} מגיבים שכל אחד מקבל הודעה פרטית אחת הם ${n(SPIKE)} הודעות. זה נכנס ב-<strong>${sfSpike.name}</strong>, שכולל ${n(sfSpike.limits.dmsPerMonth)} הודעות בחודש, ב-<strong>${sfSpike.priceIls} ש"ח</strong>. Pro כולל ${n(C.pro.limits.dmsPerMonth)} הודעות ב-${C.pro.priceIls} ש"ח, כך שגם החודש של ${n(BIG)} הוא ${sfBig.name} ב-${sfBig.priceIls} ש"ח, אותו חשבון כמו בחודש שקט.</p>
<p>ב-Pro יש גם דברים שאינם מחיר: שרת MCP מובנה שמאפשר לתפעל אוטומציות מתוך Claude או ChatGPT, פרסום פוסטים ורילס מהצ'אט, ו-${C.pro.limits.accounts} חשבונות מחוברים. לקוחות חדשים יכולים לנסות את Pro ל-${TRIAL.days} יום בשקל אחד.</p>
<p>ההשוואה המלאה נמצאת בעמוד <a href="/he/manychat">מאני צ'אט בעברית: מה זה ומה החלופה</a>. רוצים לראות איך אוטומציה נראית לפני שנרשמים? <a href="/he/guide">המדריך המלא</a> מראה את כל הדרך, ועמוד <a href="/he/instagram-auto-responder">המענה האוטומטי לאינסטגרם</a> מסביר איך זה עובד.</p>
`,

  faqTitle: 'שאלות על המחירים של ManyChat',
  faqs: [
    {
      q: "האם מאני צ'אט חינמי?",
      a: `ל-ManyChat יש מסלול חינמי קבוע עם עד ${MC.free.contacts} אנשי קשר פעילים בחודש, עד ${MC.free.automations} אוטומציות ו-${MC.free.channels} ערוצים. אין בו יכולות AI ואין הודעות תפוצה, וההודעות יוצאות עם המיתוג "Powered by Manychat". מעבר ל-${MC.free.contacts} אנשי קשר צריך מסלול בתשלום.`,
    },
    {
      q: 'כמה עולה ManyChat לחודש?',
      a: `בחיוב חודשי: Essential ב-${MC.essential.usd} דולר, Pro ב-${MC.pro.usd}, Business ב-${MC.business.usd} ו-Advanced ב-${MC.advanced.usd}. בחיוב שנתי המחיר לחודש הוא ${MC.essential.yearly}, ${MC.pro.yearly}, ${MC.business.yearly} ו-${MC.advanced.yearly} דולר. על זה מתווספת חריגה על אנשי קשר מעבר למכסה, ומע"מ.`,
    },
    {
      q: 'מה זה איש קשר פעיל ב-ManyChat?',
      a: 'כל מי שיצר אינטראקציה עם החשבון שלכם דרך ManyChat במהלך חודש החיוב. מספיקה תגובה אחת כדי להיספר, אותו אדם נספר פעם אחת גם אם פנה כמה פעמים, והספירה מתאפסת בכל מחזור חיוב.',
    },
    {
      q: 'מה קורה כשעוברים את מכסת אנשי הקשר ב-ManyChat?',
      a: `לפי מרכז העזרה שלהם האוטומציות ממשיכות לרוץ ואנשי הקשר הנוספים מחויבים אוטומטית בחשבונית הבאה: ${rate(MC.essential.over)} דולר לכל אחד ב-Essential, ${rate(MC.pro.over)} ב-Pro, ${rate(MC.business.over)} ב-Business ו-${rate(MC.advanced.over)} ב-Advanced, בחיוב חודשי.`,
    },
    {
      q: `כמה עולה ManyChat על ${n(SPIKE)} אנשי קשר?`,
      a: `בחיוב חודשי: ${usd(spike.essential.total)} ב-Essential, ${usd(spike.pro.total)} ב-Pro, ו-${MC.business.usd} דולר ב-Business שבו ${n(SPIKE)} עדיין בתוך המכסה. ב-SocialFlow, ${n(SPIKE)} הודעות פרטיות נכנסות ב-${sfSpike.name} ב-${sfSpike.priceIls} ש"ח לחודש כולל מע"מ.`,
    },
    {
      q: 'יש חלופה זולה יותר ל-ManyChat בעברית?',
      a: `SocialFlow עונה לתגובות באינסטגרם ובפייסבוק בתגובה ציבורית ובהודעה פרטית, בממשק בעברית, ומחייבת לפי הודעה שנשלחה ולא לפי איש קשר. המסלולים: חינם (${n(C.free.limits.dmsPerMonth)} הודעות), Creator ב-${C.creator.priceIls}, Pro ב-${C.pro.priceIls} ו-Agency ב-${C.agency.priceIls} ש"ח לחודש כולל מע"מ.`,
    },
  ],

  sourcesTitle: 'מקורות',
  sourcesNote: `המחירים והמגבלות של ManyChat נבדקו ב-${MC_CHECKED.he} מול מאמרי המסלולים במרכז העזרה שלהם וסקירת מחירים מ-2026, ונכונים למבנה שהושק ב-2 במרץ 2026. תמחור משתנה, ולכן שווה לוודא מולם לפני החלטה. ההמרה לשקלים היא הערכה בלבד ולא כוללת מע"מ. המספרים של SocialFlow נקראים ישירות מקטלוג המסלולים של המוצר.`,
  sources: MC_SOURCES.he,

  ctaTitle: 'נסו על הפוסט הבא',
  ctaText: `המסלול החינמי לא מבקש כרטיס אשראי: ${n(C.free.limits.dmsPerMonth)} הודעות פרטיות בחודש. מחברים דף, מקימים אוטומציה אחת, ורואים איך זה רץ.`,
  ctaBtn: 'להתחיל בחינם',
  ctaSecondary: 'המחירים של SocialFlow',
  relatedTitle: 'עוד בנושא',
  related: [
    { path: '/manychat-alternative', label: "מאני צ'אט בעברית: מה זה ומה החלופה" },
    { path: '/instagram-auto-responder', label: 'מענה אוטומטי לתגובות באינסטגרם' },
    { path: '/pricing', label: 'המחירים של SocialFlow' },
    { path: '/guide', label: 'המדריך המלא' },
    { path: '/blog/manychat-alternatives-hebrew', label: 'האלטרנטיבות ל-ManyChat בעברית' },
  ],
};

export function manychatPricingFor(locale: string): PricingPage {
  return locale === 'he' ? he : en;
}
