import { PLAN_CATALOG, TRIAL } from '@/lib/plans';
import { MC, MC_CHECKED, MC_SOURCES, compareFor, mcMonthCost, rate, type CompareGroup, type Source } from '@/content/compare';

/**
 * /manychat-alternative: the English home for "manychat alternative",
 * "alternatives to manychat", "manychat free alternative" and, in the
 * #vs-chatfuel section, "manychat vs chatfuel". It absorbed the old
 * /vs/manychat comparison, whose table it reuses from content/compare.ts.
 *
 * House rule for this page: it argues for SocialFlow only. Every statement
 * about ManyChat or Chatfuel must be checkable against a source listed at
 * the bottom; anything that cannot be checked is left out rather than guessed.
 */

/** Chatfuel figures, checked by hand on chatfuel.com. */
export const CF_CHECKED = { en: '23 September 2026' };
const CF = {
  /** Business plan: list price, and the monthly equivalent billed yearly under the offer shown on the day of the check. */
  businessList: 69,
  businessOffer: 18,
  businessOfferYear: 216,
  offerUntil: '30 September 2026',
  aiCredits: 20,
  agencyS: 90,
};

export interface AlternativePage {
  title: string;
  metaTitle: string;
  description: string;
  keywords: string;
  lead: string;
  checked: string;
  tldrTitle: string;
  tldr: string[];
  body1: string;
  tableTitle: string;
  colUs: string;
  colThem: string;
  groups: CompareGroup[];
  body2: string;
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

const C = PLAN_CATALOG;
const n = (x: number) => x.toLocaleString('en');
const pro3k = mcMonthCost('pro', 3000);
const ess3k = mcMonthCost('essential', 3000);

const IMG = '/guide-images/manychat';
function shot(file: string, w: number, h: number, alt: string, caption: string) {
  return `<figure style="margin:8px 0 28px"><img src="${IMG}/${file}" width="${w}" height="${h}" alt="${alt}" loading="lazy" decoding="async" style="display:block;width:100%;height:auto;border-radius:14px;border:1px solid rgba(255,255,255,.12)" /><figcaption style="font-size:14px;line-height:1.6;color:#B3A3C0;margin-top:8px">${caption}</figcaption></figure>`;
}

const cmp = compareFor('en');

const en: AlternativePage = {
  title: 'ManyChat Alternative: Why Teams Switch to SocialFlow (2026)',
  metaTitle: 'ManyChat Alternative: Why Teams Switch to SocialFlow (2026)',
  description: `Looking for a ManyChat alternative? SocialFlow answers Instagram and Facebook comments with a public reply and a private message, bills per message instead of per active contact, never adds overage, and runs from Claude and ChatGPT through MCP. Free plan with ${C.free.limits.dmsPerMonth} messages a month.`,
  keywords: 'manychat alternative, alternatives to manychat, manychat free alternative, manychat alternative free, manychat vs chatfuel, instagram comment to dm, instagram auto responder',
  lead: `SocialFlow is a ManyChat alternative for Instagram and Facebook: when someone comments on your post, it posts a public reply and sends them a private message with your link. Teams switch because it bills per private message sent instead of per active contact, stops at the limit instead of adding overage, has a built-in MCP server for Claude and ChatGPT, and works right to left in nine languages. The free plan includes ${n(C.free.limits.dmsPerMonth)} messages a month.`,
  checked: `ManyChat prices checked on ${MC_CHECKED.en}, Chatfuel on ${CF_CHECKED.en}. Sources at the bottom of the page.`,

  tldrTitle: 'In short',
  tldr: [
    'ManyChat bills per active contact, meaning every person who interacted with you this month. SocialFlow bills per private message it actually sent.',
    `Pass your quota on ManyChat and automations keep running while the overage goes on your next invoice. On SocialFlow sending pauses and you get an alert.`,
    `A month where a reel brings 3,000 commenters: $${pro3k.total} on ManyChat Pro. The same 3,000 messages fit in SocialFlow ${C.creator.name} at $${C.creator.priceUsd}.`,
    'SocialFlow has an official MCP server built in. ManyChat has none; only third-party wrappers over its API.',
    'Right-to-left is built in, and the interface speaks nine languages. ManyChat has an open community request for Hebrew and Arabic support.',
    'Switching is one sign-in through the same official Meta connection, and a first automation takes minutes.',
  ],

  body1: `
<h2 id="why-people-leave">Why people look for a ManyChat alternative</h2>
<p>Most people who search for a ManyChat alternative already use it for one job: someone comments a keyword on a post and gets a link in a private message. The reasons they look elsewhere are about how that job is billed and run, not about whether it works.</p>

<h3>1. You pay for people, not for work done</h3>
<p>ManyChat bills by <strong>active contacts</strong>: anyone who interacted with your account through ManyChat during the billing month. Someone who commented once and never returned counts exactly like a customer. The better your content does, the more you pay.</p>

<h3>2. The price jumps with your reach</h3>
<p>Each tier covers a band of contacts: ${n(MC.essential.contacts)} on Essential at $${MC.essential.usd}, ${n(MC.pro.contacts)} on Pro at $${MC.pro.usd}, ${n(MC.business.contacts)} on Business at $${MC.business.usd}. To choose a tier you have to guess next month's audience. The full breakdown, with worked examples, is on the <a href="/manychat-pricing">ManyChat pricing</a> page.</p>

<h3>3. Overage runs quietly</h3>
<p>Per ManyChat's help centre, when you pass the included contacts your automations keep running and the extra contacts are added automatically to your next bill: $${rate(MC.essential.over)} each on Essential, $${rate(MC.pro.over)} on Pro. A 3,000 commenter month on Essential comes to $${ess3k.total} on a $${MC.essential.usd} plan.</p>

<h3>4. A flow builder for a one step job</h3>
<p>ManyChat is built around a visual flow editor. For comment, reply and message, that is more machinery than the job needs. In SocialFlow the whole automation is one screen: post, keywords, public reply, private message.</p>

<h3>5. No official MCP server</h3>
<p>ManyChat has no official MCP server. Third-party wrappers over its public API exist, and they need an API key and a manual config entry. Its own community carries an open request for an "API for the AI agent era".</p>

<h3>6. No right to left</h3>
<p>ManyChat has no built-in right-to-left support. There is an open community request for Hebrew and Arabic, and the common workaround is a third-party Chrome extension.</p>

<h2 id="what-socialflow-does">What SocialFlow does differently</h2>
<p>SocialFlow is a business messaging tool for Instagram and Facebook built on Meta's official API, with the account owner's permission. It only ever answers people who commented on your post or wrote to you first.</p>

<h3>One screen from post to message</h3>
<p>Pick a post or reel, add the keywords that should trigger it, and write the public reply. You can add several reply variants and SocialFlow rotates between them so replies do not look identical. Leave the keywords empty and every comment on that post triggers it.</p>
${shot('post-keyword-public-reply.webp', 1483, 812, 'SocialFlow automation editor: choosing a post, the keyword GUIDE and a public reply', 'The automation editor: choose the post, add a keyword, write the public reply.')}

<h3>The private message, with your link</h3>
<p>The private message can use the commenter's name, the keyword and your page name, and carries the link you want to send. Two settings matter in practice: <strong>once per commenter</strong>, so a person who comments three times gets one message, and <strong>ignore comments that predate the automation</strong>, so switching it on does not message people from last month.</p>
${shot('private-message-link.webp', 1568, 728, 'SocialFlow private message settings with name placeholder, link field and the once per commenter option', 'The private message, the link, and the once per commenter setting.')}
${shot('comment-reply-dm-preview.webp', 1474, 810, 'Preview of a comment, the public reply and the private message in SocialFlow', 'The preview shows exactly what the commenter will see, and each person is saved as a lead.')}

<h3>Run it from Claude or ChatGPT</h3>
<p>From the ${C.pro.name} plan, SocialFlow exposes an MCP server. Connect it once and you can ask, in plain language, to create an automation on your latest reel, pause one, change its keywords, or get a report for the last seven days. The first automation for each page is created in the app so the Meta permission is stored; after that, everything can be done from the chat.</p>
${shot('mcp-tools.webp', 1443, 840, 'SocialFlow MCP connection screen listing the tools Claude or ChatGPT can use', 'The MCP tools Claude or ChatGPT can call: list posts, create, update or pause automations, pull reports.')}

<h3>Counters you can read at a glance</h3>
<p>Every automation shows how many times it triggered, how many private messages and public replies it sent, and when it last ran.</p>
${shot('automations-dashboard.webp', 1383, 442, 'SocialFlow automations list with trigger, private message and public reply counters', 'The automations list, with counters per automation.')}

<h2 id="use-cases">Three ways teams use it</h2>
<h3>A creator running a reel with a keyword</h3>
<p>The reel ends with "comment GUIDE and I will send it to you". One automation on that reel, keyword GUIDE, a public reply that says the link is on its way, and a private message with the link. Because the meter counts messages, a reel that takes off does not change the plan you need until you pass your monthly allowance.</p>
<h3>A business answering price questions in comments</h3>
<p>People ask "price?" and "how much?" under posts. An automation with those keywords replies publicly that the details are in their messages, and sends the price list or a booking link privately. The person who asked gets an answer in seconds, and the conversation moves to the inbox where it belongs.</p>
<h3>An agency on several accounts</h3>
<p>${C.pro.name} connects ${C.pro.limits.accounts} accounts with ${C.pro.limits.seats} users, and ${C.agency.name} connects ${C.agency.limits.accounts} accounts with ${C.agency.limits.seats} users. Through MCP an account manager can list every connected page, see each automation's counters and pull a seven day report, without clicking through each account.</p>
`,

  tableTitle: 'SocialFlow vs ManyChat, row by row',
  colUs: cmp.colUs,
  colThem: cmp.colThem,
  groups: cmp.groups,

  body2: `
<h2 id="switching">Switching from ManyChat, in practice</h2>
<ol>
<li><strong>Sign in with Facebook.</strong> SocialFlow connects through the same official Meta interface you approved for ManyChat. Pick the page and the Instagram business account.</li>
<li><strong>Rebuild the automations you use.</strong> For each one: pick the post, type the keyword, paste the link. Minutes, not a project.</li>
<li><strong>Pause the ManyChat automation on that post</strong>, so each commenter gets one reply.</li>
<li><strong>Optional, on ${C.pro.name}:</strong> connect Claude or ChatGPT through MCP and create the rest in plain language.</li>
</ol>
<p>There is no export or import step, and no month where you pay for both. New customers can try ${C.pro.name} for ${TRIAL.days} days for $${TRIAL.priceUsd}.</p>

<h2 id="free-alternative">Is there a free ManyChat alternative?</h2>
<p>Yes. SocialFlow's free plan needs no card and includes <strong>${n(C.free.limits.dmsPerMonth)} private messages a month</strong> with ${C.free.limits.activeAutomations} active automations on ${C.free.limits.accounts} account. ManyChat's free plan counts ${MC.free.contacts} active contacts a month. When you outgrow it, ${C.creator.name} is $${C.creator.priceUsd} a month for ${n(C.creator.limits.dmsPerMonth)} messages with no SocialFlow branding. All plans are on the <a href="/pricing">pricing page</a>.</p>

<h2 id="vs-chatfuel">ManyChat vs Chatfuel, and where SocialFlow fits</h2>
<p>People comparing ManyChat and Chatfuel are usually choosing a billing model as much as a tool. Here is what each one publishes, checked on ${CF_CHECKED.en}.</p>
<ul>
<li><strong>ManyChat</strong> bills per active contact, in five tiers from free to $${MC.advanced.usd} a month, with overage per contact past each tier's quota.</li>
<li><strong>Chatfuel</strong> sells a Business plan and an Agency tier. On the day of the check its pricing page listed Business at US$${CF.businessList}, shown as US$${CF.businessOffer} a month billed yearly (US$${CF.businessOfferYear} a year) under a limited offer running until ${CF.offerUntil}, and Agency S at US$${CF.agencyS} a month billed yearly. Its plans start with a free trial; the pricing page lists no permanent free plan. Business includes US$${CF.aiCredits} of AI credits a month, and the page leads with WhatsApp and AI assistant features. Chatfuel's site is published in English, Spanish and Portuguese.</li>
</ul>
<p><strong>Where SocialFlow fits:</strong> if the job is answering comments on Instagram and Facebook with a reply and a private message, SocialFlow does that one job, with a permanent free plan, a meter based on messages sent, a hard stop instead of overage, an interface in nine languages including right to left, and an official MCP server for Claude and ChatGPT.</p>
`,

  faqTitle: 'Frequently asked questions',
  faqs: [
    {
      q: 'What is the best ManyChat alternative for Instagram comments?',
      a: `SocialFlow is built for exactly that job: it answers people who comment on your Instagram or Facebook posts with a public reply and a private message containing your link. It bills per message sent rather than per active contact, stops at the limit instead of billing overage, and has a free plan with ${n(C.free.limits.dmsPerMonth)} messages a month.`,
    },
    {
      q: 'Is there a free alternative to ManyChat?',
      a: `Yes. SocialFlow's free plan includes ${n(C.free.limits.dmsPerMonth)} private messages a month and ${C.free.limits.activeAutomations} active automations, with no card required. Paid plans start at $${C.creator.priceUsd} a month.`,
    },
    {
      q: 'How much does SocialFlow cost compared to ManyChat?',
      a: `SocialFlow Pro is $${C.pro.priceUsd} a month for ${n(C.pro.limits.dmsPerMonth)} private messages. ManyChat Pro is $${MC.pro.usd} a month on monthly billing for ${n(MC.pro.contacts)} active contacts, plus $${rate(MC.pro.over)} per contact past that.`,
    },
    {
      q: 'What happens when I reach my monthly limit?',
      a: 'On SocialFlow sending pauses and you get an alert, with no extra charge. On ManyChat automations keep running and the overage is added automatically to your next invoice.',
    },
    {
      q: 'Does ManyChat have an MCP server?',
      a: 'There is no official MCP server from ManyChat. Third-party wrappers over its public API exist and need an API key and manual configuration. SocialFlow has an MCP server built into the product from the Pro plan.',
    },
    {
      q: 'Can I move from ManyChat to SocialFlow without losing my accounts?',
      a: 'Yes. SocialFlow connects through the same official Meta interface, so the page and Instagram business account you already use come across in one sign-in. Automations are rebuilt, which takes minutes each.',
    },
    {
      q: 'ManyChat vs Chatfuel: which is cheaper?',
      a: `They price differently. ManyChat charges per active contact, from $${MC.essential.usd} a month on Essential with overage past each quota. Chatfuel's pricing page, checked on ${CF_CHECKED.en}, showed its Business plan at US$${CF.businessOffer} a month billed yearly under a limited offer, with a free trial rather than a free plan. SocialFlow has a permanent free plan and charges per message sent, from $${C.creator.priceUsd} a month.`,
    },
    {
      q: 'Does SocialFlow message people who did not contact me?',
      a: 'No. SocialFlow only answers people who commented on your post or wrote to you first, through Meta\'s official API and with the account owner\'s permission.',
    },
  ],

  sourcesTitle: 'Sources',
  sourcesNote: `ManyChat prices and limits were checked on ${MC_CHECKED.en} against ManyChat's help centre and a 2026 pricing roundup, and reflect the structure launched on 2 March 2026. Chatfuel figures were checked on ${CF_CHECKED.en} on chatfuel.com; the Business price shown was a limited offer. Pricing changes, so confirm with each vendor before deciding. SocialFlow figures are read directly from the product plan catalogue.`,
  sources: [
    ...MC_SOURCES.en,
    { label: 'Chatfuel pricing page', url: 'https://chatfuel.com/pricing' },
    { label: 'Chatfuel: understanding usage limits', url: 'https://limits.chatfuel.com/en' },
  ],

  ctaTitle: 'Try it on your next post',
  ctaText: `The free plan asks for no card: ${n(C.free.limits.dmsPerMonth)} private messages a month. Connect a page, build one automation, and see how it runs on your next reel.`,
  ctaBtn: 'Start free',
  ctaSecondary: 'See pricing',
  relatedTitle: 'Related',
  related: [
    { path: '/manychat-pricing', label: 'ManyChat pricing in 2026: what it actually costs' },
    { path: '/instagram-auto-responder', label: 'Instagram auto responder for comments and DMs' },
    { path: '/pricing', label: 'SocialFlow pricing' },
    { path: '/guide', label: 'The setup guide' },
    { path: '/blog/comment-link-and-ill-send-it', label: 'How the comment to DM funnel works' },
  ],
};

export function manychatAlternativeFor(): AlternativePage {
  return en;
}
