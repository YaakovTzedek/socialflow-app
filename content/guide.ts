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
export interface Guide {
  title: string;
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
<h2>מה בדיוק קרה לך עכשיו</h2>
<p>כתבת מילה אחת בתגובה לפוסט. בתוך פחות מדקה קרו ארבעה דברים, בלי שאף אדם נגע במקלדת:</p>
<ol>
  <li>המערכת <strong>זיהתה</strong> את התגובה שלך ואת המילה שבה השתמשת.</li>
  <li>היא <strong>ענתה לך בפומבי</strong> מתחת לתגובה, כדי שכל מי שקורא יראה שיש כאן משהו לקבל.</li>
  <li>היא <strong>שלחה לך הודעה פרטית</strong> עם הקישור למדריך הזה.</li>
  <li>היא <strong>שמרה אותך כליד</strong>: שם המשתמש, הפוסט, המילה שהפעילה, והשעה.</li>
</ol>
<p>הסדר הזה לא מקרי, וכל חלק בו עושה עבודה אחרת. נפרק אותו.</p>

<h2>למה דווקא תגובות</h2>
<p>לייק לוקח רבע שנייה ולא אומר כמעט כלום. <strong>תגובה דורשת מאמץ</strong>: לעצור, לפתוח מקלדת, לכתוב. מי שטרח לכתוב מילה הוא לא צופה, הוא מישהו שהרים יד.</p>
<p>ובדיוק בגלל זה זה קורה מעט. שיעורי המעורבות באינסטגרם יורדים כבר שנים, וכל תגובה שנשארת בלי מענה היא אדם שהרים יד ואף אחד לא הסתכל.</p>

<h2>השלד של אוטומציה שעובדת</h2>
<h3>1. מילת המפתח</h3>
<p>מילה אחת, קצרה, קלה לאיות, ומחוברת לתוכן. לא "אני רוצה לקבל את המדריך", אלא <strong>מילה אחת</strong>.</p>
<ul>
  <li>קורסים ודיגיטל: <strong>מדריך</strong></li>
  <li>קליניקות ומטפלים: <strong>תור</strong></li>
  <li>חנויות ואיקומרס: <strong>מחיר</strong></li>
  <li>נדל"ן וליווי אישי: <strong>פרטים</strong></li>
</ul>
<p>טיפ שמכפיל תוצאות: <strong>תכתבו את המילה בפוסט עצמו</strong>, לא רק בכיתוב. אנשים לא ממציאים מילות מפתח, הם מעתיקים אותן.</p>

<h3>2. התגובה הציבורית</h3>
<p>זה החלק שרוב האנשים מזלזלים בו, והוא המנוע של כל הסיפור. התגובה הציבורית לא נועדה למי שהגיב. <strong>היא נועדה לכל מי שקורא את התגובות ועוד לא הגיב.</strong></p>
<p>היא עושה שני דברים: מוכיחה שזה אמיתי ושבאמת עונים, ומאותתת לאלגוריתם שיש כאן שיחה. שלושה נוסחים שעובדים:</p>
<ul>
  <li>"שלחתי לך עכשיו בפרטי 💜"</li>
  <li>"בדרך אליך להודעות. אם לא הגיע, תבדוק בבקשות ההודעות"</li>
  <li>"יצא! תסתכל בפרטי 👀"</li>
</ul>
<p>שימו לב לשני: הוא מונע את תלונת התמיכה הנפוצה ביותר, וכבר תכף נסביר למה.</p>

<h3>3. ההודעה הפרטית</h3>
<p>שלושה משפטים, לא יותר. מי שמקבל אותה נמצא בהודעות, לא במצב קריאה.</p>
<ul>
  <li><strong>משפט ראשון:</strong> להזכיר על מה מדובר. "היי, הנה המדריך שביקשת"</li>
  <li><strong>משפט שני:</strong> הקישור. אחד בלבד.</li>
  <li><strong>משפט שלישי:</strong> שאלה פתוחה. "מה הכי מעניין אותך שם?"</li>
</ul>
<p>המשפט השלישי הוא זה שהופך הודעה לשיחה, ושיחה היא מה שהופך ליד ללקוח.</p>

<h3>4. הליד</h3>
<p>אם התגובה נענתה וההודעה נשלחה ואף אחד לא שמר את זה בשום מקום, ביצעתם פעולה יפה בלי תוצאה. כל מגיב צריך להישמר עם המילה שהפעילה, הפוסט והשעה, כדי שתדעו <strong>איזה פוסט מביא לקוחות ואיזה רק מביא לייקים</strong>.</p>

<h2>חמש הטעויות שהורגות את זה</h2>
<ol>
  <li><strong>מילת מפתח ארוכה מדי.</strong> כל תו נוסף מוריד אחוזים. מילה אחת.</li>
  <li><strong>לא לכתוב את המילה בפוסט עצמו.</strong> אנשים לא מנחשים.</li>
  <li><strong>קישור אחד יותר מדי.</strong> שני קישורים בהודעה אחת מחצי את שיעור ההקלקה.</li>
  <li><strong>לוותר על התגובה הציבורית.</strong> בלעדיה אף אחד אחר לא יודע שיש כאן משהו, והאוטומציה מפסיקה לייצר אוטומציה.</li>
  <li><strong>לא לבדוק שההודעה באמת הגיעה.</strong> וזו הטעות היקרה ביותר, כי היא שקטה.</li>
</ol>

<h2>הדבר שאף אחד לא מספר לכם</h2>
<p>כשאתם שולחים הודעה פרטית למי <strong>שלא עוקב</strong> אחריכם, אינסטגרם לא שמה אותה בתיבה הראשית. היא נוחתת ב<strong>בקשות ההודעות</strong>, מסך שרוב האנשים לא פותחים אף פעם.</p>
<p>ההודעה נשלחה, המערכת מדווחת הצלחה, והאדם באמת לא ראה כלום.</p>
<p>לכן התגובה הציבורית חייבת להגיד שנשלחה הודעה. <strong>היא זו ששולחת את האדם לחפש אותה במקום הנכון.</strong></p>

<h2>מה מטא מרשה, ומה גורם לחסימה</h2>
<p>העבודה דרך הממשק הרשמי של מטא, שבו בעל החשבון מאשר את ההרשאות בעצמו, היא פעולה מותרת לחלוטין. זה מה שעומד מאחורי התהליך שעברת עכשיו.</p>
<p>מה שמסוכן הוא כלים שמבקשים מכם <strong>שם משתמש וסיסמה</strong> ומדמים גלישה אנושית. זו הפרה מפורשת של תנאי השימוש, ושם נמצאות החסימות. הכלל פשוט: אם כלי מבקש את הסיסמה שלכם לאינסטגרם, זה הסימן לעצור.</p>

<h2>ומה עכשיו</h2>
<p>אתם יכולים לקחת את כל מה שכתוב כאן ולהפעיל ידנית. זה עובד, וזה גם בדיוק מה שמתפרק ברגע שפוסט אחד מצליח ומגיעות שבעים תגובות בשעתיים.</p>
<p>מה שעבר עליכם בדקה האחרונה רץ על SocialFlow, והוא רץ ככה מסביב לשעון.</p>
`,
  ctaTitle: 'רוצים שזה יעבוד גם אצלכם?',
  ctaText: 'אנחנו בבטא סגורה ופותחים חשבונות בהדרגה, בלי עלות ובלי כרטיס אשראי. השאירו פרטים ונחזור אליכם.',
};

const en: Guide = {
  title: 'How to turn Instagram comments into leads, automatically',
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
<h2>What just happened to you</h2>
<p>You typed one word. Within a minute four things happened, with nobody touching a keyboard:</p>
<ol>
  <li>The system <strong>spotted</strong> your comment and the keyword in it.</li>
  <li>It <strong>replied in public</strong> under your comment, so everyone reading can see there is something to get.</li>
  <li>It <strong>sent you a private message</strong> with the link to this guide.</li>
  <li>It <strong>saved you as a lead</strong>: username, post, the word that triggered it, and the time.</li>
</ol>

<h2>Why comments</h2>
<p>A like takes a quarter of a second and says almost nothing. <strong>A comment takes effort</strong>: stopping, opening a keyboard, typing. Someone who bothered to type is not a viewer, they raised their hand.</p>
<p>And that is exactly why it is rare. Every comment left unanswered is a person who raised their hand while nobody was looking.</p>

<h2>The anatomy of an automation that works</h2>
<h3>1. The keyword</h3>
<p>One word. Short, easy to spell, tied to the content. Not a sentence.</p>
<p>The tip that doubles results: <strong>put the word inside the post itself</strong>, not only in the caption. People do not invent keywords, they copy them.</p>

<h3>2. The public reply</h3>
<p>This is the part most people dismiss, and it is the engine. The public reply is not for the person who commented. <strong>It is for everyone reading the comments who has not commented yet.</strong></p>
<p>It proves this is real, and it tells the algorithm there is a conversation here.</p>

<h3>3. The private message</h3>
<p>Three sentences, no more. Remind them what this is, give one link, and ask one open question. The question is what turns a message into a conversation.</p>

<h3>4. The lead</h3>
<p>If the reply went out and the message was sent and nobody stored it anywhere, you performed a nice trick with no outcome. Save every commenter with the trigger word, the post and the time, so you know <strong>which post brings customers and which only brings likes</strong>.</p>

<h2>The five mistakes that kill it</h2>
<ol>
  <li><strong>A keyword that is too long.</strong> Every extra character costs you.</li>
  <li><strong>Not writing the word in the post itself.</strong> People do not guess.</li>
  <li><strong>One link too many.</strong> Two links in one message halves the click rate.</li>
  <li><strong>Skipping the public reply.</strong> Without it nobody else knows anything is on offer.</li>
  <li><strong>Never checking the message actually arrived.</strong> The most expensive one, because it is silent.</li>
</ol>

<h2>The thing nobody tells you</h2>
<p>When you send a private message to someone who <strong>does not follow you</strong>, Instagram does not put it in the main inbox. It lands in <strong>message requests</strong>, a screen most people never open.</p>
<p>The message was sent, the system reports success, and the person genuinely saw nothing. That is why the public reply must say a message was sent. <strong>It is what sends the person to look in the right place.</strong></p>

<h2>What Meta allows, and what gets you blocked</h2>
<p>Working through Meta official interface, where the account owner approves the permissions themselves, is entirely allowed. That is what ran on you a minute ago.</p>
<p>What is dangerous are tools that ask for your <strong>username and password</strong> and imitate a human browsing. That is an explicit breach of the terms, and that is where blocks come from. Simple rule: if a tool asks for your Instagram password, stop.</p>

<h2>What now</h2>
<p>You can take everything here and run it by hand. It works, and it is also exactly what falls apart the moment one post lands and seventy comments arrive in two hours.</p>
<p>What you went through in the last minute runs on SocialFlow, around the clock.</p>
`,
  ctaTitle: 'Want this running on your account?',
  ctaText: 'We are in closed beta and opening accounts gradually, at no cost and with no card. Leave your details and we will come back to you.',
};

/** Hebrew for he, English for everyone else until a real translation exists. */
export function guideFor(locale: Locale): Guide {
  return locale === 'he' ? he : en;
}
