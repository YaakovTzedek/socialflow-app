import type { Locale } from '@/lib/i18n';

/**
 * The guide people receive in the private message after they comment the
 * keyword. It is the first thing a stranger reads about SocialFlow, so it has
 * to be worth the click on its own: the method first, the product second.
 *
 * Kept out of the Messages type on purpose. A long article does not belong in
 * the interface dictionary, and adding it there would force nine translations
 * of prose before a single one of them is needed.
 */
export interface GuideSection { id: string; label: string }

export interface Guide {
  title: string;
  /** The rail on the side, and the ids the body anchors to. */
  tocTitle: string;
  sections: GuideSection[];
  lead: string;
  description: string;
  keywords: string[];
  tldr: string[];
  body: string;
  ctaTitle: string;
  ctaText: string;
}

const he: Guide = {
  title: 'איך להפוך תגובות באינסטגרם ללידים, אוטומטית',
  tocTitle: 'בתוך המדריך',
  sections: [
    { id: 'what-happened', label: 'מה קרה עכשיו' },
    { id: 'why-comments', label: 'למה דווקא תגובות' },
    { id: 'anatomy', label: 'השלד של אוטומציה' },
    { id: 'mistakes', label: 'חמש הטעויות' },
    { id: 'requests', label: 'מה שלא מספרים' },
    { id: 'meta', label: 'מה מטא מרשה' },
    { id: 'now', label: 'ומה עכשיו' },
  ],
  lead: 'המדריך המלא לשיטה שהרגע הופעלה עליך. ארבעה חלקים, דוגמאות מוכנות להעתקה, וחמש הטעויות שהורגות את זה.',
  description: 'מדריך מעשי: איך תגובה על פוסט באינסטגרם הופכת לתשובה ציבורית, להודעה פרטית ולליד שמור. מילות מפתח, נוסחים מוכנים, מה מטא מרשה, וחמש הטעויות הנפוצות.',
  keywords: ['אוטומציה לאינסטגרם', 'תגובה להודעה פרטית', 'לידים מאינסטגרם', 'בוט לאינסטגרם', 'אוטומציה לתגובות'],
  tldr: [
    'תגובה היא הפעולה היקרה ביותר שאדם עושה על פוסט, והיא הפכה לנדירה. לכן שווה לענות על כל אחת.',
    'אוטומציה שעובדת מורכבת מארבעה חלקים: מילת מפתח, תגובה ציבורית, הודעה פרטית, ושמירת הליד.',
    'התגובה הציבורית היא לא נימוס, היא מה שגורם לאנשים אחרים להגיב גם.',
    'הכלל שמונע חסימה: לעבוד דרך ההרשאות הרשמיות של מטא, ולעולם לא דרך שם משתמש וסיסמה.',
  ],
  body: `
<section id="what-happened">
<h2>מה בדיוק קרה לך עכשיו</h2>
<p>כתבת מילה אחת בתגובה לפוסט. בתוך פחות מדקה קרו ארבעה דברים, בלי שאף אדם נגע במקלדת:</p>
<ol class="sfg-ran">
  <li><strong>זיהוי.</strong> המערכת קלטה את התגובה שלך ואת המילה שבה השתמשת.</li>
  <li><strong>תשובה ציבורית.</strong> היא ענתה לך מתחת לתגובה, כדי שכל מי שקורא יראה שיש כאן משהו לקבל.</li>
  <li><strong>הודעה פרטית.</strong> היא שלחה לך את הקישור למדריך הזה.</li>
  <li><strong>ליד.</strong> היא שמרה אותך: שם המשתמש, הפוסט, המילה שהפעילה, והשעה.</li>
</ol>
<p>הסדר הזה לא מקרי, וכל חלק בו עושה עבודה אחרת. נפרק אותו.</p>
</section>

<section id="why-comments">
<h2>למה דווקא תגובות</h2>
<p>לייק לוקח רבע שנייה ולא אומר כמעט כלום. <strong>תגובה דורשת מאמץ</strong>: לעצור, לפתוח מקלדת, לכתוב. מי שטרח לכתוב מילה הוא לא צופה, הוא מישהו שהרים יד.</p>
<blockquote class="sfg-quote">שיעורי המעורבות באינסטגרם יורדים כבר שנים, וכל תגובה שנשארת בלי מענה היא אדם שהרים יד ואף אחד לא הסתכל.</blockquote>
</section>

<section id="anatomy">
<h2>השלד של אוטומציה שעובדת</h2>
<p>ארבעה חלקים. אם אחד מהם חסר, כל השאר לא מציל אותו.</p>

<div class="sfg-step">
  <div class="sfg-step-head"><span class="sfg-step-num">1</span><h3>מילת המפתח</h3></div>
  <p>מילה אחת, קצרה, קלה לאיות, ומחוברת לתוכן. לא "אני רוצה לקבל את המדריך", אלא <strong>מילה אחת</strong>.</p>
  <div class="sfg-kw">
    <div class="sfg-kw-card"><span>קורסים ודיגיטל</span><strong>מדריך</strong></div>
    <div class="sfg-kw-card"><span>קליניקות ומטפלים</span><strong>תור</strong></div>
    <div class="sfg-kw-card"><span>חנויות ואיקומרס</span><strong>מחיר</strong></div>
    <div class="sfg-kw-card"><span>נדל"ן וליווי אישי</span><strong>פרטים</strong></div>
  </div>
  <p class="sfg-tip"><strong>הטיפ שמכפיל תוצאות:</strong> תכתבו את המילה בפוסט עצמו, לא רק בכיתוב. אנשים לא ממציאים מילות מפתח, הם מעתיקים אותן.</p>
</div>

<div class="sfg-step">
  <div class="sfg-step-head"><span class="sfg-step-num">2</span><h3>התגובה הציבורית</h3></div>
  <p>זה החלק שרוב האנשים מזלזלים בו, והוא המנוע של כל הסיפור. התגובה הציבורית לא נועדה למי שהגיב. <strong>היא נועדה לכל מי שקורא את התגובות ועוד לא הגיב.</strong></p>
  <p>היא מוכיחה שזה אמיתי ושבאמת עונים, והיא מאותתת לאלגוריתם שיש כאן שיחה. שלושה נוסחים שעובדים:</p>
  <ul class="sfg-lines">
    <li>שלחתי לך עכשיו בפרטי 💜</li>
    <li>בדרך אליך להודעות. אם לא הגיע, תבדוק בבקשות ההודעות</li>
    <li>יצא! תסתכל בפרטי 👀</li>
  </ul>
  <p class="sfg-tip">השני מונע את תלונת התמיכה הנפוצה ביותר, ותכף נסביר למה.</p>
</div>

<div class="sfg-step">
  <div class="sfg-step-head"><span class="sfg-step-num">3</span><h3>ההודעה הפרטית</h3></div>
  <p>שלושה משפטים, לא יותר. מי שמקבל אותה נמצא בהודעות, לא במצב קריאה.</p>
  <ul class="sfg-lines">
    <li><strong>ראשון:</strong> להזכיר על מה מדובר. "היי, הנה המדריך שביקשת"</li>
    <li><strong>שני:</strong> הקישור. אחד בלבד.</li>
    <li><strong>שלישי:</strong> שאלה פתוחה. "מה הכי מעניין אותך שם?"</li>
  </ul>
  <p>המשפט השלישי הוא זה שהופך הודעה לשיחה, ושיחה היא מה שהופך ליד ללקוח.</p>
</div>

<div class="sfg-step">
  <div class="sfg-step-head"><span class="sfg-step-num sfg-step-done">4</span><h3>הליד</h3></div>
  <p>אם התגובה נענתה וההודעה נשלחה ואף אחד לא שמר את זה בשום מקום, ביצעתם פעולה יפה בלי תוצאה. כל מגיב צריך להישמר עם המילה שהפעילה, הפוסט והשעה, כדי שתדעו <strong>איזה פוסט מביא לקוחות ואיזה רק מביא לייקים</strong>.</p>
</div>
</section>

<section id="mistakes">
<h2>חמש הטעויות שהורגות את זה</h2>
<ul class="sfg-bad">
  <li><strong>מילת מפתח ארוכה מדי.</strong> כל תו נוסף מוריד אחוזים. מילה אחת.</li>
  <li><strong>לא לכתוב את המילה בפוסט עצמו.</strong> אנשים לא מנחשים, הם מעתיקים.</li>
  <li><strong>קישור אחד יותר מדי.</strong> שני קישורים בהודעה אחת מחצי את שיעור ההקלקה.</li>
  <li><strong>לוותר על התגובה הציבורית.</strong> בלעדיה אף אחד אחר לא יודע שיש כאן משהו, והאוטומציה מפסיקה לייצר אוטומציה.</li>
  <li><strong>לא לבדוק שההודעה באמת הגיעה.</strong> הטעות היקרה ביותר, כי היא שקטה.</li>
</ul>
</section>

<section id="requests">
<h2>הדבר שאף אחד לא מספר לכם</h2>
<p>כשאתם שולחים הודעה פרטית למי <strong>שלא עוקב</strong> אחריכם, אינסטגרם לא שמה אותה בתיבה הראשית. היא נוחתת ב<strong>בקשות ההודעות</strong>, מסך שרוב האנשים לא פותחים אף פעם.</p>
<blockquote class="sfg-quote">ההודעה נשלחה, המערכת מדווחת הצלחה, והאדם באמת לא ראה כלום.</blockquote>
<p>לכן התגובה הציבורית חייבת להגיד שנשלחה הודעה. <strong>היא זו ששולחת את האדם לחפש אותה במקום הנכון.</strong></p>
</section>

<section id="meta">
<h2>מה מטא מרשה, ומה גורם לחסימה</h2>
<div class="sfg-rules">
  <div class="sfg-ok">
    <div class="sfg-rules-title">מותר</div>
    <ul>
      <li>ההרשאות הרשמיות של מטא, שבעל החשבון מאשר בעצמו</li>
      <li>תגובה ציבורית לכל מגיב</li>
      <li>הודעה אחת לכל מגיב</li>
    </ul>
  </div>
  <div class="sfg-no">
    <div class="sfg-rules-title">אסור</div>
    <ul>
      <li>כלי שמבקש שם משתמש וסיסמה</li>
      <li>סקריפט שמדמה גלישה אנושית</li>
      <li>רשימות נמענים מיובאות</li>
    </ul>
  </div>
</div>
<p class="sfg-tip">הכלל פשוט: אם כלי מבקש את הסיסמה שלכם לאינסטגרם, זה הסימן לעצור.</p>
</section>

<section id="now">
<h2>ומה עכשיו</h2>
<p>אתם יכולים לקחת את כל מה שכתוב כאן ולהפעיל ידנית. זה עובד, וזה גם בדיוק מה שמתפרק ברגע שפוסט אחד מצליח ומגיעות שבעים תגובות בשעתיים.</p>
<div class="sfg-hand">
  <div class="sfg-hand-mark">פוסט אחד. יותר לקוחות.</div>
  <p>מה שעבר עליכם בדקה האחרונה רץ על SocialFlow, והוא רץ ככה מסביב לשעון.</p>
</div>
</section>
`,
  ctaTitle: 'רוצים שזה יעבוד גם אצלכם?',
  ctaText: 'אנחנו בבטא סגורה ופותחים חשבונות בהדרגה, בלי עלות ובלי כרטיס אשראי. השאירו פרטים ונחזור אליכם.',
};

const en: Guide = {
  title: 'How to turn Instagram comments into leads, automatically',
  tocTitle: 'Inside this guide',
  sections: [
    { id: 'what-happened', label: 'What just happened' },
    { id: 'why-comments', label: 'Why comments' },
    { id: 'anatomy', label: 'The anatomy' },
    { id: 'mistakes', label: 'Five mistakes' },
    { id: 'requests', label: 'What nobody tells you' },
    { id: 'meta', label: 'What Meta allows' },
    { id: 'now', label: 'What now' },
  ],
  lead: 'The full method that was just run on you. Four parts, copy ready examples, and the five mistakes that kill it.',
  description: 'A practical guide: how a comment on an Instagram post becomes a public reply, a private message and a saved lead. Keywords, wording that works, what Meta allows, and the common mistakes.',
  keywords: ['instagram automation', 'comment to dm', 'instagram leads', 'auto reply instagram'],
  tldr: [
    'A comment is the most expensive action a person takes on a post, and it has become rare. That is why every one of them deserves an answer.',
    'A working automation has four parts: a keyword, a public reply, a private message, and a saved lead.',
    'The public reply is not politeness. It is what makes other people comment too.',
    'The rule that keeps you safe: work through Meta official permissions, never through a username and password.',
  ],
  body: `
<section id="what-happened">
<h2>What just happened to you</h2>
<p>You typed one word. Within a minute four things happened, with nobody touching a keyboard:</p>
<ol class="sfg-ran">
  <li><strong>Detection.</strong> The system spotted your comment and the keyword in it.</li>
  <li><strong>Public reply.</strong> It answered under your comment, so everyone reading can see there is something to get.</li>
  <li><strong>Private message.</strong> It sent you the link to this guide.</li>
  <li><strong>Lead.</strong> It saved you: username, post, the word that triggered it, and the time.</li>
</ol>
</section>

<section id="why-comments">
<h2>Why comments</h2>
<p>A like takes a quarter of a second and says almost nothing. <strong>A comment takes effort</strong>: stopping, opening a keyboard, typing. Someone who bothered to type is not a viewer, they raised their hand.</p>
<blockquote class="sfg-quote">Engagement rates have been falling for years, and every comment left unanswered is a person who raised their hand while nobody was looking.</blockquote>
</section>

<section id="anatomy">
<h2>The anatomy of an automation that works</h2>
<p>Four parts. If one is missing, the rest will not save it.</p>

<div class="sfg-step">
  <div class="sfg-step-head"><span class="sfg-step-num">1</span><h3>The keyword</h3></div>
  <p>One word. Short, easy to spell, tied to the content. Not a sentence.</p>
  <div class="sfg-kw">
    <div class="sfg-kw-card"><span>Courses</span><strong>GUIDE</strong></div>
    <div class="sfg-kw-card"><span>Clinics</span><strong>BOOK</strong></div>
    <div class="sfg-kw-card"><span>Ecommerce</span><strong>PRICE</strong></div>
    <div class="sfg-kw-card"><span>Real estate</span><strong>INFO</strong></div>
  </div>
  <p class="sfg-tip"><strong>The tip that doubles results:</strong> put the word inside the post itself, not only in the caption. People do not invent keywords, they copy them.</p>
</div>

<div class="sfg-step">
  <div class="sfg-step-head"><span class="sfg-step-num">2</span><h3>The public reply</h3></div>
  <p>This is the part most people dismiss, and it is the engine. The public reply is not for the person who commented. <strong>It is for everyone reading the comments who has not commented yet.</strong></p>
  <ul class="sfg-lines">
    <li>Just sent it to you 💜</li>
    <li>On its way. If you do not see it, check your message requests</li>
    <li>Sent! Check your DMs 👀</li>
  </ul>
</div>

<div class="sfg-step">
  <div class="sfg-step-head"><span class="sfg-step-num">3</span><h3>The private message</h3></div>
  <p>Three sentences, no more. Remind them what this is, give one link, and ask one open question. The question is what turns a message into a conversation.</p>
</div>

<div class="sfg-step">
  <div class="sfg-step-head"><span class="sfg-step-num sfg-step-done">4</span><h3>The lead</h3></div>
  <p>If the reply went out and the message was sent and nobody stored it anywhere, you performed a nice trick with no outcome. Save every commenter with the trigger word, the post and the time, so you know <strong>which post brings customers and which only brings likes</strong>.</p>
</div>
</section>

<section id="mistakes">
<h2>The five mistakes that kill it</h2>
<ul class="sfg-bad">
  <li><strong>A keyword that is too long.</strong> Every extra character costs you.</li>
  <li><strong>Not writing the word in the post itself.</strong> People do not guess.</li>
  <li><strong>One link too many.</strong> Two links in one message halves the click rate.</li>
  <li><strong>Skipping the public reply.</strong> Without it nobody else knows anything is on offer.</li>
  <li><strong>Never checking the message actually arrived.</strong> The most expensive one, because it is silent.</li>
</ul>
</section>

<section id="requests">
<h2>The thing nobody tells you</h2>
<p>When you send a private message to someone who <strong>does not follow you</strong>, Instagram does not put it in the main inbox. It lands in <strong>message requests</strong>, a screen most people never open.</p>
<blockquote class="sfg-quote">The message was sent, the system reports success, and the person genuinely saw nothing.</blockquote>
<p>That is why the public reply must say a message was sent. <strong>It is what sends the person to look in the right place.</strong></p>
</section>

<section id="meta">
<h2>What Meta allows, and what gets you blocked</h2>
<div class="sfg-rules">
  <div class="sfg-ok">
    <div class="sfg-rules-title">Allowed</div>
    <ul>
      <li>Meta official permissions, approved by the account owner</li>
      <li>A public reply to every commenter</li>
      <li>One message per commenter</li>
    </ul>
  </div>
  <div class="sfg-no">
    <div class="sfg-rules-title">Not allowed</div>
    <ul>
      <li>A tool that asks for a username and password</li>
      <li>A script imitating a human browsing</li>
      <li>Imported recipient lists</li>
    </ul>
  </div>
</div>
<p class="sfg-tip">Simple rule: if a tool asks for your Instagram password, stop.</p>
</section>

<section id="now">
<h2>What now</h2>
<p>You can take everything here and run it by hand. It works, and it is also exactly what falls apart the moment one post lands and seventy comments arrive in two hours.</p>
<div class="sfg-hand">
  <div class="sfg-hand-mark">One post. More customers.</div>
  <p>What you went through in the last minute runs on SocialFlow, around the clock.</p>
</div>
</section>
`,
  ctaTitle: 'Want this running on your account?',
  ctaText: 'We are in closed beta and opening accounts gradually, at no cost and with no card. Leave your details and we will come back to you.',
};

/** Hebrew for he, English for everyone else until a real translation exists. */
export function guideFor(locale: Locale): Guide {
  return locale === 'he' ? he : en;
}
