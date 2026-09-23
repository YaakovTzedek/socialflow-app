import { localePath, type Locale } from '@/lib/i18n';
import { PLAN_CATALOG, PLAN_ORDER, type PlanId } from '@/lib/plans';

/**
 * /instagram-auto-responder: the flagship page of the English content plan
 * (research/content-plan-en.md, page 1). Target query "instagram auto
 * responder", with "instagram autoresponder", "auto responder for ig" and
 * "instagram auto reply" as secondaries.
 *
 * Kept out of the Messages type for the same reason as the guide and the
 * comparison: long prose does not belong in the interface dictionary. English
 * and Hebrew are written; every other locale falls back to English.
 *
 * Two rules this file must not break:
 *  1. Every SocialFlow price and limit is read from PLAN_CATALOG.
 *  2. Meta App Review is in progress. The page describes a business tool that
 *     answers people who commented or wrote first. Nothing here may suggest
 *     unsolicited messaging, follower growth tricks or bulk sending.
 */

export interface Section { id: string; label: string }
export interface Faq { q: string; a: string }
export interface Source { label: string; url: string }

export interface AutoResponder {
  metaTitle: string;
  title: string;
  description: string;
  keywords: string[];
  lead: string;
  answerTitle: string;
  answer: string[];
  tocTitle: string;
  sections: Section[];
  body: string;
  faqTitle: string;
  faqs: Faq[];
  sourcesTitle: string;
  sourcesNote: string;
  sources: Source[];
  ctaTitle: string;
  ctaText: string;
}

const IMG = '/guide-images/instagram-auto-responder';

/** Meta's own documentation, the source for every platform rule on the page. */
const META = {
  privateReplies: 'https://developers.facebook.com/docs/instagram-platform/private-replies',
  messaging: 'https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api',
  facebookLogin: 'https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login',
};

function shot(src: string, alt: string, caption: string, w: number, h: number) {
  return `<figure class="sfa-shot"><img src="${IMG}/${src}" alt="${alt}" width="${w}" height="${h}" loading="lazy" decoding="async" /><figcaption>${caption}</figcaption></figure>`;
}

const n = (x: number, locale: 'en' | 'he') => x.toLocaleString(locale === 'he' ? 'he-IL' : 'en');

function priceOf(id: PlanId, locale: 'en' | 'he') {
  const p = PLAN_CATALOG[id];
  return locale === 'he' ? `₪${p.priceIls}` : `$${p.priceUsd}`;
}

function pricingTable(locale: 'en' | 'he') {
  const he = locale === 'he';
  const head = he
    ? ['מסלול', 'מחיר לחודש', 'אוטומציות פעילות', 'הודעות פרטיות בחודש', 'חשבונות', 'MCP ופרסום']
    : ['Plan', 'Per month', 'Active automations', 'Private messages a month', 'Accounts', 'MCP and publishing'];
  const rows = PLAN_ORDER.map((id) => {
    const p = PLAN_CATALOG[id];
    const l = p.limits;
    const autos = l.activeAutomations === null ? (he ? 'ללא הגבלה' : 'Unlimited') : String(l.activeAutomations);
    const mcp = l.mcp ? (he ? 'כן' : 'Yes') : (he ? 'לא' : 'No');
    return `<tr><th scope="row">${p.name}</th><td>${priceOf(id, locale)}</td><td>${autos}</td><td>${n(l.dmsPerMonth, locale)}</td><td>${l.accounts}</td><td>${mcp}</td></tr>`;
  }).join('');
  return `<table><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`;
}

/* -------------------------------------------------------------------------- */
/* English                                                                     */
/* -------------------------------------------------------------------------- */

function en(locale: Locale): AutoResponder {
  const L = (path: string) => localePath(locale, path);
  const free = PLAN_CATALOG.free.limits;
  const pro = PLAN_CATALOG.pro;

  return {
    metaTitle: 'Instagram Auto Responder: Auto-Reply to Comments and DMs',
    title: 'Instagram Auto Responder: auto-reply to comments and DMs',
    description:
      'An Instagram auto responder replies to comments on your posts and sends the commenter one private message with your link, through the official Meta API. How it works, Meta rules, setup in three steps, and pricing.',
    keywords: ['instagram auto responder', 'instagram autoresponder', 'auto responder for ig', 'instagram auto reply', 'instagram comment auto reply', 'comment to dm'],
    lead: 'What an Instagram auto responder does, the rules Meta sets for it, and how to set one up on your own posts in a few minutes.',

    answerTitle: 'The short answer',
    answer: [
      'An Instagram auto responder is a tool that answers people who comment on your post or write to your account, without you typing each reply.',
      'The common setup: someone comments a keyword such as GUIDE, the tool replies to the comment in public and sends that person one private message with the link they asked for.',
      'It runs through the official Instagram API from Meta, only on an Instagram professional account, and only toward people who commented or messaged you first.',
    ],

    tocTitle: 'On this page',
    sections: [
      { id: 'what-is', label: 'What it is' },
      { id: 'how-it-works', label: 'How it works' },
      { id: 'setup', label: 'Setup in three steps' },
      { id: 'meta-rules', label: 'Meta rules and limits' },
      { id: 'mcp', label: 'From Claude or ChatGPT' },
      { id: 'pricing', label: 'Pricing' },
    ],

    body: `
<section id="what-is">
<h2>What is an Instagram auto responder?</h2>
<div class="sfa-def">
  <div class="sfa-def-term">Instagram auto responder</div>
  <p>Software connected to an Instagram professional account that automatically replies to people who interacted with that account first: a comment on a post or reel, or a direct message. It uses the messaging and comment permissions the account owner grants through Meta.</p>
</div>
<p>People also search for it as an <strong>Instagram autoresponder</strong>, an <strong>auto responder for IG</strong> or an <strong>Instagram auto reply</strong> tool. They all describe the same job: the person who asked gets an answer while you are busy, asleep or on another post.</p>
<p>Most businesses use it for one situation. A post asks people to comment a word to receive something: a guide, a price list, a booking link. Without automation, someone has to open every comment and answer it by hand. With it, every person who asked gets the same answer within minutes.</p>
</section>

<section id="how-it-works">
<h2>How does an Instagram auto responder work?</h2>
<p>A comment-based auto responder does three things, in this order.</p>
<ol class="sfg-ran">
  <li><strong>It reads the comment.</strong> The tool checks new comments on the post you chose and looks for your keyword. You decide whether the comment has to contain the word or be exactly the word.</li>
  <li><strong>It replies in public.</strong> A short reply under the comment, such as "Sent you the details in a private message". Other readers see that the offer is real and where the answer went.</li>
  <li><strong>It sends one private message.</strong> The commenter receives a direct message with your text and your link. That is the answer they asked for.</li>
</ol>
${shot('comment-reply-dm-preview.webp', 'SocialFlow process preview: a comment on the post, the public reply under it, the private message with the link, and the lead saved in the log', 'The preview SocialFlow shows while you build an automation: comment, public reply, private message.', 1474, 810)}
<p>SocialFlow also saves each commenter in an activity log with the keyword, the post and the time, so you can see which post brought requests. The same flow works on Facebook Page posts.</p>
</section>

<section id="setup">
<h2>How to set up an Instagram auto responder in three steps</h2>
<p>Before you start you need an Instagram professional account (Business or Creator) that is linked to a Facebook Page, because SocialFlow connects through Facebook Login. You sign in with Facebook once and choose which Page and Instagram account the app may use.</p>

<div class="sfg-step">
  <div class="sfg-step-head"><span class="sfg-step-num">1</span><h3>Choose the account and the post</h3></div>
  <p>Pick the Instagram account, then the post or reel the automation should watch. You can also choose all posts on the account.</p>
</div>

<div class="sfg-step">
  <div class="sfg-step-head"><span class="sfg-step-num">2</span><h3>Add the keyword and the public reply</h3></div>
  <p>Type one short keyword, such as GUIDE, and write the public reply. You can add several reply variants and SocialFlow rotates between them, so the replies under your post do not all read the same.</p>
  ${shot('post-keyword-public-reply.webp', 'SocialFlow new automation screen: a selected Instagram post, the keyword GUIDE, and the public reply text', 'Step 2 in the app: the post, the keyword and the public reply.', 1483, 812)}
</div>

<div class="sfg-step">
  <div class="sfg-step-head"><span class="sfg-step-num sfg-step-done">3</span><h3>Write the private message and activate</h3></div>
  <p>Write the message and paste the link. Placeholders such as the commenter name and the keyword are filled in for each person. Leave "Once per commenter" on, so a person who comments twice still gets one message. Then activate, or save the automation as paused and turn it on later. It handles comments written after activation, not older ones.</p>
  ${shot('private-message-link.webp', 'SocialFlow private message step: message text with a commenter name placeholder, a link field, and the Once per commenter setting', 'Step 3 in the app: the private message, the link, and the setting that limits it to one message per person.', 1568, 728)}
</div>

<p>Once it is live, each automation shows how many times it was triggered and how many public replies and private messages went out.</p>
${shot('automations-dashboard.webp', 'SocialFlow automations list showing active automations with counters for triggers, private messages sent and public replies', 'The automations screen: status, keywords and counters for every automation.', 1383, 442)}
</section>

<section id="meta-rules">
<h2>What rules does Meta set for Instagram auto replies?</h2>
<p>Every rule below comes from Meta's developer documentation, linked in the sources. A tool that runs on the official API has to follow them, whichever tool it is.</p>
<ul>
  <li><strong>One private message per comment.</strong> Meta allows a single private reply to the person who commented. <a href="${META.privateReplies}" target="_blank" rel="noopener">Meta, Private Replies</a></li>
  <li><strong>Within 7 days of the comment.</strong> The private reply has to be sent within seven days of when the comment was made. <a href="${META.privateReplies}" target="_blank" rel="noopener">Meta, Private Replies</a></li>
  <li><strong>The 24-hour window.</strong> You can continue the conversation only if the person answers your message, and then within 24 hours of their answer. <a href="${META.messaging}" target="_blank" rel="noopener">Meta, Messaging API</a></li>
  <li><strong>They contact you first.</strong> A business account can message a person only after that person has messaged the account or commented on its content. An auto responder answers; it never starts a conversation.</li>
  <li><strong>A professional account.</strong> The API works with Instagram professional accounts. Through Facebook Login, which SocialFlow uses, the account must be connected to a Facebook Page. <a href="${META.facebookLogin}" target="_blank" rel="noopener">Meta, Instagram API with Facebook Login</a></li>
</ul>
<p class="sfg-tip"><strong>Worth knowing:</strong> a private message to someone who does not follow you usually lands in their message requests, not the main inbox. That is why the public reply should say a message was sent.</p>
<p>A tool that asks for your Instagram password instead of an official Meta sign-in is not using the API, and it puts the account at risk. SocialFlow never asks for it.</p>
</section>

<section id="mcp">
<h2>Can you run it from Claude or ChatGPT?</h2>
<p>Yes, on the ${pro.name} plan and above. SocialFlow includes an MCP server, the open standard that lets AI assistants use outside tools. Connected to Claude or ChatGPT, you can write "open an automation on my latest reel: whoever comments guide gets this link" and the assistant builds it. It can also pause automations, change the wording, pull a report and publish posts and reels to Instagram and Facebook.</p>
${shot('mcp-tools.webp', 'SocialFlow MCP connection screen listing the tools the server exposes: list_pages, list_posts, list_automations, create_automation, update_automation, delete_automation, get_activity, get_report', 'The MCP screen in the app and the tools it gives Claude and ChatGPT.', 1443, 840)}
<p>One limit to know: the first automation for a Page is created in the app, so the Page permission from Meta is stored. From the second one on, the chat can do the rest.</p>
</section>

<section id="pricing">
<h2>How much does an Instagram auto responder cost?</h2>
<p>SocialFlow bills by private messages sent each month, not by the number of people who commented. The free plan has ${free.activeAutomations} active automations and ${n(free.dmsPerMonth, 'en')} private messages a month, and adds a short "Sent with SocialFlow" line to each message. Paid plans remove it.</p>
${pricingTable('en')}
<p>Annual billing gives two months free. Full details are on the <a href="${L('/pricing')}">pricing page</a>. For a side by side with another tool, see <a href="${L('/manychat-alternative')}">the ManyChat alternative page</a>. For the method behind the keyword and the wording, read the <a href="${L('/guide')}">guide to turning comments into leads</a>.</p>
</section>
`,

    faqTitle: 'Frequently asked questions',
    faqs: [
      {
        q: 'What is an Instagram auto responder?',
        a: 'A tool connected to an Instagram professional account that automatically answers people who commented on a post or sent a message. The most common setup replies to a keyword comment in public and sends the commenter one private message with a link.',
      },
      {
        q: 'Is an Instagram auto responder allowed by Meta?',
        a: 'Yes, when it runs through the official Instagram API with permissions the account owner grants, and follows Meta rules: one private reply per comment, sent within 7 days of the comment, and further messages only if the person answers, within 24 hours. Tools that ask for your password are not using the API.',
      },
      {
        q: 'Can I send a message to someone who did not comment or message me?',
        a: 'No. Through the Instagram API a business can message a person only after that person commented on its content or messaged the account. An auto responder answers people who reached out first.',
      },
      {
        q: 'Does it work with a personal Instagram account?',
        a: 'No. Meta API requires an Instagram professional account, Business or Creator. With SocialFlow the account also has to be linked to a Facebook Page, because the connection goes through Facebook Login.',
      },
      {
        q: 'What happens if the same person comments several times?',
        a: 'With the "Once per commenter" setting on, SocialFlow sends that person one private message, however many times they comment. Meta also allows only one private reply per comment.',
      },
      {
        q: 'Why did the commenter not see my message?',
        a: 'If they do not follow you, Instagram usually places the message in their message requests rather than the main inbox. A public reply that says a message was sent tells them where to look.',
      },
      {
        q: 'How much does SocialFlow cost?',
        a: `There is a free plan with ${free.activeAutomations} active automations and ${n(free.dmsPerMonth, 'en')} private messages a month. Paid plans are ${priceOf('creator', 'en')}, ${priceOf('pro', 'en')} and ${priceOf('agency', 'en')} a month. MCP for Claude and ChatGPT starts on ${pro.name}.`,
      },
    ],

    sourcesTitle: 'Sources',
    sourcesNote:
      'Platform rules were checked against Meta developer documentation on 23 September 2026. Meta updates these pages, so the linked version is the one that counts. SocialFlow prices and limits are read directly from the product plan catalog.',
    sources: [
      { label: 'Meta for Developers: Private Replies (Instagram Platform)', url: META.privateReplies },
      { label: 'Meta for Developers: Instagram Messaging API, sending messages', url: META.messaging },
      { label: 'Meta for Developers: Instagram API with Facebook Login', url: META.facebookLogin },
    ],

    ctaTitle: 'Want an auto responder on your posts?',
    ctaText: 'SocialFlow is in closed beta and opens accounts gradually. Leave your details and we will get back to you.',
  };
}

/* -------------------------------------------------------------------------- */
/* Hebrew                                                                      */
/* -------------------------------------------------------------------------- */

function he(): AutoResponder {
  const L = (path: string) => localePath('he', path);
  const free = PLAN_CATALOG.free.limits;
  const pro = PLAN_CATALOG.pro;

  return {
    metaTitle: 'מענה אוטומטי באינסטגרם (Instagram Auto Responder): תגובות והודעות פרטיות',
    title: 'מענה אוטומטי באינסטגרם: תשובה לתגובות ולהודעות',
    description:
      'מענה אוטומטי באינסטגרם (Instagram auto responder) עונה לתגובות על הפוסטים שלכם ושולח למגיב הודעה פרטית אחת עם הקישור, דרך ה-API הרשמי של מטא. איך זה עובד, הכללים של מטא, הגדרה בשלושה צעדים ומחירים.',
    keywords: ['מענה אוטומטי באינסטגרם', 'instagram auto responder', 'תגובה אוטומטית באינסטגרם', 'הודעה אוטומטית באינסטגרם', 'אוטומציה לתגובות'],
    lead: 'מה עושה מענה אוטומטי באינסטגרם, אילו כללים מטא קובעת לו, ואיך מפעילים אותו על הפוסטים שלכם בכמה דקות.',

    answerTitle: 'התשובה הקצרה',
    answer: [
      'מענה אוטומטי באינסטגרם הוא כלי שעונה למי שהגיב על פוסט או כתב לחשבון, בלי שתקלידו כל תשובה בעצמכם.',
      'השימוש הנפוץ: מישהו מגיב מילת מפתח כמו "מדריך", והכלי עונה לו בתגובה ציבורית ושולח לו הודעה פרטית אחת עם הקישור שביקש.',
      'זה רץ דרך ה-API הרשמי של מטא, רק על חשבון אינסטגרם מקצועי, ורק מול אנשים שהגיבו או כתבו לכם קודם.',
    ],

    tocTitle: 'בעמוד הזה',
    sections: [
      { id: 'what-is', label: 'מה זה' },
      { id: 'how-it-works', label: 'איך זה עובד' },
      { id: 'setup', label: 'הגדרה בשלושה צעדים' },
      { id: 'meta-rules', label: 'הכללים של מטא' },
      { id: 'mcp', label: 'מתוך Claude או ChatGPT' },
      { id: 'pricing', label: 'מחירים' },
    ],

    body: `
<section id="what-is">
<h2>מה זה מענה אוטומטי באינסטגרם?</h2>
<div class="sfa-def">
  <div class="sfa-def-term">מענה אוטומטי באינסטגרם (Instagram auto responder)</div>
  <p>תוכנה שמחוברת לחשבון אינסטגרם מקצועי ועונה אוטומטית לאנשים שפנו לחשבון קודם: תגובה על פוסט או ריל, או הודעה ישירה. היא עובדת עם הרשאות התגובות וההודעות שבעל החשבון מאשר דרך מטא.</p>
</div>
<p>באנגלית מחפשים את זה גם כ-<strong>Instagram autoresponder</strong>, <strong>auto responder for IG</strong> או <strong>Instagram auto reply</strong>. כולם מתארים את אותה עבודה: מי ששאל מקבל תשובה גם כשאתם עסוקים, ישנים או בפוסט אחר.</p>
<p>רוב העסקים משתמשים בזה למצב אחד. פוסט מבקש מהקוראים להגיב מילה כדי לקבל משהו: מדריך, מחירון, קישור לקביעת תור. בלי אוטומציה מישהו צריך לפתוח כל תגובה ולענות ידנית. עם אוטומציה כל מי שביקש מקבל את אותה תשובה תוך דקות.</p>
</section>

<section id="how-it-works">
<h2>איך עובד מענה אוטומטי באינסטגרם?</h2>
<p>מענה אוטומטי שמבוסס על תגובות עושה שלושה דברים, בסדר הזה.</p>
<ol class="sfg-ran">
  <li><strong>קורא את התגובה.</strong> הכלי בודק תגובות חדשות על הפוסט שבחרתם ומחפש את מילת המפתח. אתם מחליטים אם התגובה צריכה להכיל את המילה או להיות בדיוק המילה.</li>
  <li><strong>עונה בפומבי.</strong> תשובה קצרה מתחת לתגובה, למשל "שלחתי לך את הפרטים בהודעה פרטית". שאר הקוראים רואים שההצעה אמיתית ולאן הלכה התשובה.</li>
  <li><strong>שולח הודעה פרטית אחת.</strong> המגיב מקבל הודעה ישירה עם הטקסט והקישור שלכם. זו התשובה שהוא ביקש.</li>
</ol>
${shot('comment-reply-dm-preview.webp', 'תצוגה מקדימה ב-SocialFlow: תגובה על הפוסט, תשובה ציבורית מתחתיה, הודעה פרטית עם הקישור, וליד שנשמר ביומן', 'התצוגה המקדימה ש-SocialFlow מציגה בזמן בניית אוטומציה: תגובה, תשובה ציבורית, הודעה פרטית.', 1474, 810)}
<p>SocialFlow גם שומרת כל מגיב ביומן הפעילות עם מילת המפתח, הפוסט והשעה, כדי שתראו איזה פוסט הביא פניות. אותו תהליך עובד גם על פוסטים בדף פייסבוק.</p>
</section>

<section id="setup">
<h2>איך מגדירים מענה אוטומטי באינסטגרם בשלושה צעדים</h2>
<p>לפני שמתחילים צריך חשבון אינסטגרם מקצועי (עסקי או יוצר תוכן) שמקושר לדף פייסבוק, כי SocialFlow מתחברת דרך התחברות עם פייסבוק. מתחברים פעם אחת ובוחרים איזה דף ואיזה חשבון אינסטגרם האפליקציה רשאית להפעיל.</p>

<div class="sfg-step">
  <div class="sfg-step-head"><span class="sfg-step-num">1</span><h3>בוחרים חשבון ופוסט</h3></div>
  <p>בוחרים את חשבון האינסטגרם, ואז את הפוסט או הריל שהאוטומציה תעקוב אחריו. אפשר גם לבחור את כל הפוסטים בחשבון.</p>
</div>

<div class="sfg-step">
  <div class="sfg-step-head"><span class="sfg-step-num">2</span><h3>מוסיפים מילת מפתח ותשובה ציבורית</h3></div>
  <p>כותבים מילת מפתח אחת וקצרה, למשל "מדריך", ואת התשובה הציבורית. אפשר להוסיף כמה נוסחים ו-SocialFlow מחליפה ביניהם, כך שהתשובות מתחת לפוסט לא נראות זהות.</p>
  ${shot('post-keyword-public-reply.webp', 'מסך אוטומציה חדשה ב-SocialFlow: פוסט אינסטגרם שנבחר, מילת המפתח GUIDE ונוסח התשובה הציבורית', 'צעד 2 באפליקציה: הפוסט, מילת המפתח והתשובה הציבורית (הממשק כאן באנגלית, הוא קיים גם בעברית).', 1483, 812)}
</div>

<div class="sfg-step">
  <div class="sfg-step-head"><span class="sfg-step-num sfg-step-done">3</span><h3>כותבים הודעה פרטית ומפעילים</h3></div>
  <p>כותבים את ההודעה ומדביקים את הקישור. משתנים כמו שם המגיב ומילת המפתח מתמלאים לכל אדם. משאירים את "פעם אחת לכל מגיב" דלוק, כך שמי שמגיב פעמיים עדיין מקבל הודעה אחת. אחר כך מפעילים, או שומרים את האוטומציה מושהית ומדליקים אותה מאוחר יותר. היא מטפלת בתגובות שנכתבו מרגע ההפעלה, לא בתגובות ישנות.</p>
  ${shot('private-message-link.webp', 'שלב ההודעה הפרטית ב-SocialFlow: טקסט ההודעה עם משתנה לשם המגיב, שדה קישור, וההגדרה פעם אחת לכל מגיב', 'צעד 3 באפליקציה: ההודעה הפרטית, הקישור, וההגדרה שמגבילה להודעה אחת לכל אדם.', 1568, 728)}
</div>

<p>אחרי שהאוטומציה באוויר, כל אחת מציגה כמה פעמים הופעלה וכמה תשובות ציבוריות והודעות פרטיות יצאו.</p>
${shot('automations-dashboard.webp', 'רשימת האוטומציות ב-SocialFlow עם אוטומציות פעילות ומונים של הפעלות, הודעות פרטיות ותשובות ציבוריות', 'מסך האוטומציות: סטטוס, מילות מפתח ומונים לכל אוטומציה.', 1383, 442)}
</section>

<section id="meta-rules">
<h2>אילו כללים מטא קובעת למענה אוטומטי באינסטגרם?</h2>
<p>כל הכללים כאן לקוחים מתיעוד המפתחים של מטא, עם קישור במקורות. כל כלי שעובד דרך ה-API הרשמי חייב לעמוד בהם, לא משנה איזה כלי.</p>
<ul>
  <li><strong>הודעה פרטית אחת לכל תגובה.</strong> מטא מאפשרת תשובה פרטית אחת למי שהגיב. <a href="${META.privateReplies}" target="_blank" rel="noopener">מטא, Private Replies</a></li>
  <li><strong>עד 7 ימים מהתגובה.</strong> את ההודעה הפרטית צריך לשלוח בתוך שבעה ימים מרגע שנכתבה התגובה. <a href="${META.privateReplies}" target="_blank" rel="noopener">מטא, Private Replies</a></li>
  <li><strong>חלון 24 השעות.</strong> אפשר להמשיך את השיחה רק אם האדם ענה להודעה, ורק בתוך 24 שעות מהתשובה שלו. <a href="${META.messaging}" target="_blank" rel="noopener">מטא, Messaging API</a></li>
  <li><strong>הם פונים ראשונים.</strong> חשבון עסקי יכול לשלוח הודעה לאדם רק אחרי שהאדם כתב לחשבון או הגיב על התוכן שלו. מענה אוטומטי עונה, הוא אף פעם לא פותח שיחה.</li>
  <li><strong>חשבון מקצועי.</strong> ה-API עובד עם חשבונות אינסטגרם מקצועיים. בהתחברות דרך פייסבוק, שבה SocialFlow משתמשת, החשבון חייב להיות מקושר לדף פייסבוק. <a href="${META.facebookLogin}" target="_blank" rel="noopener">מטא, Instagram API with Facebook Login</a></li>
</ul>
<p class="sfg-tip"><strong>כדאי לדעת:</strong> הודעה פרטית למי שלא עוקב אחריכם נוחתת בדרך כלל בבקשות ההודעות ולא בתיבה הראשית. לכן התשובה הציבורית צריכה להגיד שנשלחה הודעה.</p>
<p>כלי שמבקש את הסיסמה שלכם לאינסטגרם במקום התחברות רשמית דרך מטא לא עובד דרך ה-API, והוא מסכן את החשבון. SocialFlow לא מבקשת אותה אף פעם.</p>
</section>

<section id="mcp">
<h2>אפשר להפעיל את זה מתוך Claude או ChatGPT?</h2>
<p>כן, ממסלול ${pro.name} ומעלה. ל-SocialFlow יש שרת MCP, התקן הפתוח שמאפשר לעוזרי AI להפעיל כלים חיצוניים. אחרי החיבור ל-Claude או ל-ChatGPT אפשר לכתוב "תפתח אוטומציה על הריל האחרון: מי שמגיב מדריך מקבל את הקישור הזה", והעוזר בונה אותה. הוא יכול גם להשהות אוטומציות, לשנות נוסחים, להביא דוח ולפרסם פוסטים וריילס לאינסטגרם ולפייסבוק.</p>
${shot('mcp-tools.webp', 'מסך חיבור ה-MCP ב-SocialFlow עם רשימת הכלים שהשרת חושף: list_pages, list_posts, list_automations, create_automation, update_automation, delete_automation, get_activity, get_report', 'מסך ה-MCP באפליקציה והכלים שהוא נותן ל-Claude ול-ChatGPT.', 1443, 840)}
<p>מגבלה אחת שכדאי להכיר: האוטומציה הראשונה לכל דף נוצרת באפליקציה, כדי שהרשאת הדף ממטא תישמר. מהשנייה והלאה הצ'אט יכול לעשות את השאר.</p>
</section>

<section id="pricing">
<h2>כמה עולה מענה אוטומטי באינסטגרם?</h2>
<p>SocialFlow מחייבת לפי הודעות פרטיות שנשלחו בחודש, לא לפי מספר האנשים שהגיבו. במסלול החינמי יש ${free.activeAutomations} אוטומציות פעילות ו-${n(free.dmsPerMonth, 'he')} הודעות פרטיות בחודש, ובכל הודעה מופיעה שורה קצרה "נשלח עם SocialFlow". במסלולים בתשלום היא יורדת. המחירים כוללים מע"מ.</p>
${pricingTable('he')}
<p>בתשלום שנתי מקבלים חודשיים במתנה. כל הפרטים ב<a href="${L('/pricing')}">עמוד המחירים</a>. להשוואה מול כלי אחר יש את <a href="${L('/manychat')}">SocialFlow מול ManyChat</a>. ולשיטה שמאחורי מילת המפתח והנוסחים, <a href="${L('/guide')}">המדריך להפיכת תגובות ללידים</a>.</p>
</section>
`,

    faqTitle: 'שאלות נפוצות',
    faqs: [
      {
        q: 'מה זה מענה אוטומטי באינסטגרם?',
        a: 'כלי שמחובר לחשבון אינסטגרם מקצועי ועונה אוטומטית לאנשים שהגיבו על פוסט או שלחו הודעה. השימוש הנפוץ עונה לתגובה עם מילת מפתח בפומבי ושולח למגיב הודעה פרטית אחת עם קישור.',
      },
      {
        q: 'מטא מרשה מענה אוטומטי באינסטגרם?',
        a: 'כן, כשהוא עובד דרך ה-API הרשמי של אינסטגרם עם הרשאות שבעל החשבון מאשר, ועומד בכללים של מטא: תשובה פרטית אחת לכל תגובה, בתוך 7 ימים מהתגובה, והודעות נוספות רק אם האדם ענה, בתוך 24 שעות. כלי שמבקש סיסמה לא עובד דרך ה-API.',
      },
      {
        q: 'אפשר לשלוח הודעה למי שלא הגיב ולא כתב לי?',
        a: 'לא. דרך ה-API של אינסטגרם עסק יכול לשלוח הודעה לאדם רק אחרי שהאדם הגיב על התוכן שלו או כתב לחשבון. מענה אוטומטי עונה למי שפנה קודם.',
      },
      {
        q: 'זה עובד עם חשבון אינסטגרם פרטי?',
        a: 'לא. ה-API של מטא דורש חשבון אינסטגרם מקצועי, עסקי או יוצר תוכן. ב-SocialFlow החשבון גם צריך להיות מקושר לדף פייסבוק, כי החיבור עובר דרך התחברות עם פייסבוק.',
      },
      {
        q: 'מה קורה אם אותו אדם מגיב כמה פעמים?',
        a: 'כשההגדרה "פעם אחת לכל מגיב" דלוקה, SocialFlow שולחת לאדם הודעה פרטית אחת, לא משנה כמה פעמים הגיב. גם מטא מאפשרת רק תשובה פרטית אחת לכל תגובה.',
      },
      {
        q: 'למה המגיב לא ראה את ההודעה?',
        a: 'אם הוא לא עוקב אחריכם, אינסטגרם בדרך כלל שמה את ההודעה בבקשות ההודעות ולא בתיבה הראשית. תשובה ציבורית שאומרת שנשלחה הודעה מכוונת אותו לחפש שם.',
      },
      {
        q: 'כמה עולה SocialFlow?',
        a: `יש מסלול חינמי עם ${free.activeAutomations} אוטומציות פעילות ו-${n(free.dmsPerMonth, 'he')} הודעות פרטיות בחודש. המסלולים בתשלום עולים ${priceOf('creator', 'he')}, ${priceOf('pro', 'he')} ו-${priceOf('agency', 'he')} לחודש, כולל מע"מ. חיבור MCP ל-Claude ול-ChatGPT מתחיל במסלול ${pro.name}.`,
      },
    ],

    sourcesTitle: 'מקורות',
    sourcesNote:
      'הכללים נבדקו מול תיעוד המפתחים של מטא ב-23 בספטמבר 2026. מטא מעדכנת את העמודים האלה, ולכן הגרסה המקושרת היא הקובעת. המחירים והמגבלות של SocialFlow נקראים ישירות מקטלוג המסלולים של המוצר.',
    sources: [
      { label: 'Meta for Developers: Private Replies', url: META.privateReplies },
      { label: 'Meta for Developers: Instagram Messaging API', url: META.messaging },
      { label: 'Meta for Developers: Instagram API with Facebook Login', url: META.facebookLogin },
    ],

    ctaTitle: 'רוצים מענה אוטומטי על הפוסטים שלכם?',
    ctaText: 'SocialFlow בבטא סגורה ופותחת חשבונות בהדרגה. השאירו פרטים ונחזור אליכם.',
  };
}

/** Hebrew for he, English for everyone else until a real translation exists. */
export function autoResponderFor(locale: Locale): AutoResponder {
  return locale === 'he' ? he() : en(locale);
}
