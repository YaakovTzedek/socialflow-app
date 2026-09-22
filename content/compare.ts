import type { Locale } from '@/lib/i18n';
import { PLAN_CATALOG } from '@/lib/plans';

/**
 * The ManyChat comparison page.
 *
 * Kept out of the Messages type for the same reason as the guide: long prose
 * does not belong in the interface dictionary, and nine translations of a
 * comparison nobody outside Israel is searching for yet would be waste.
 *
 * Every number about ManyChat below is sourced and dated in SOURCES, and every
 * number about SocialFlow is read from PLAN_CATALOG so the page cannot drift
 * away from what the billing screen actually charges. If a claim here cannot
 * be checked against one of those two, it does not belong on the page.
 */

/** Indicative only, reviewed by hand like USD_RATES in lib/plans. */
const ILS_PER_USD = 3.7;
const ils = (usd: number) => Math.round((usd * ILS_PER_USD) / 5) * 5;

/** Checked 23.9.2026. */
const MC = {
  free: { usd: 0, contacts: 25, automations: 4 },
  essential: { usd: 17, yearly: 14, contacts: 250, over: 0.10, seats: 2 },
  pro: { usd: 39, yearly: 29, contacts: 2500, over: 0.05, seats: 3 },
  business: { usd: 99, yearly: 69, contacts: 7500, over: 0.025, seats: 5 },
  advanced: { usd: 199, yearly: 139, contacts: 25000, seats: 10 },
};

export interface CompareRow {
  label: string;
  us: string;
  them: string;
  /** Marks the row where the difference is the point, not a detail. */
  key?: boolean;
}
export interface CompareGroup { title: string; rows: CompareRow[] }
export interface Source { label: string; url: string }

export interface Compare {
  title: string;
  metaTitle: string;
  description: string;
  keywords: string;
  lead: string;
  tldr: string[];
  tableTitle: string;
  colUs: string;
  colThem: string;
  groups: CompareGroup[];
  body: string;
  faqTitle: string;
  faqs: { q: string; a: string }[];
  sourcesTitle: string;
  sourcesNote: string;
  sources: Source[];
  ctaTitle: string;
  ctaText: string;
  ctaBtn: string;
}

/* -------------------------------------------------------------------------- */
/* Hebrew                                                                      */
/* -------------------------------------------------------------------------- */

const he: Compare = {
  title: 'SocialFlow מול ManyChat (מנישאט): ההשוואה המלאה',
  metaTitle: 'SocialFlow מול ManyChat (מנישאט): השוואת מחירים, יכולות ו-MCP, בעברית',
  description:
    'השוואה מלאה בין SocialFlow ל-ManyChat: מה בדיוק אתם משלמים עליו בכל אחד מהם, כמה זה עולה בשקלים, מה קורה כשעוברים את המגבלה, ולמה יש לנו שרת MCP מובנה ולהם אין. כל המספרים עם מקור ותאריך.',
  keywords:
    'ManyChat, מנישאט, ManyChat בעברית, אלטרנטיבה ל-ManyChat, אוטומציה לתגובות באינסטגרם, תגובה להודעה פרטית, SocialFlow, MCP, מחירי ManyChat',
  lead: 'שתי המערכות עושות את אותו הדבר הבסיסי: מישהו מגיב על פוסט, ומקבל הודעה פרטית עם הקישור. ההבדל הוא במה שאתם משלמים עליו, באיזו שפה המערכת מדברת אליכם, ובמה אפשר לעשות בלי לפתוח אותה בכלל.',

  tldr: [
    'ManyChat מחייבת לפי אנשי קשר פעילים, כלומר לפי מספר האנשים שיצרו איתכם קשר החודש. SocialFlow מחייבת לפי הודעות פרטיות שנשלחו בפועל.',
    `מסלול מקצועי: ${PLAN_CATALOG.pro.priceIls} שקלים כולל מע"מ אצלנו, מול ${MC.pro.usd} דולר לחודש ב-ManyChat, בערך ${ils(MC.pro.usd)} שקלים.`,
    'כשעוברים את המגבלה ב-ManyChat האוטומציות ממשיכות לרוץ והתוספת נכנסת לחשבון הבא. אצלנו השליחה נעצרת ואתם מקבלים התראה, בלי חיוב מפתיע.',
    'ל-SocialFlow יש שרת MCP מובנה: אפשר להקים ולתפעל אוטומציות מתוך Claude ו-ChatGPT בשפה חופשית. ל-ManyChat אין שרת רשמי, רק עטיפות של צד שלישי מעל ה-API.',
    'ל-ManyChat אין תמיכה בכיווניות ימין לשמאל. בקהילה שלהם פתוחה בקשה לתמיכה בעברית ובערבית, והפתרון בפועל הוא תוסף כרום. SocialFlow נבנתה בעברית מהיום הראשון.',
    'המעבר הוא התחברות אחת דרך אותו ממשק רשמי של Meta. החשבונות שכבר מחוברים אצלכם עוברים כמו שהם.',
  ],

  tableTitle: 'ההשוואה, שורה מול שורה',
  colUs: 'SocialFlow',
  colThem: 'ManyChat',

  groups: [
    {
      title: 'מה אתם משלמים עליו',
      rows: [
        {
          label: 'יחידת החיוב',
          us: 'הודעות פרטיות שנשלחו בחודש',
          them: 'אנשי קשר פעילים, כל מי שיצר קשר החודש',
          key: true,
        },
        {
          label: 'כשעוברים את המגבלה',
          us: 'השליחה נעצרת ואתם מקבלים התראה',
          them: 'האוטומציות ממשיכות, התוספת נכנסת לחשבון הבא',
          key: true,
        },
        {
          label: 'תעריף חריגה',
          us: 'אין. משדרגים מסלול או ממתינים לחודש הבא',
          them: `${MC.essential.over} דולר לאיש קשר ב-Essential, ${MC.pro.over} ב-Pro, ${MC.business.over} ב-Business`,
        },
        { label: 'מטבע החיוב', us: 'שקלים, כולל מע"מ, עם חשבונית', them: 'דולרים, מע"מ בנפרד', key: true },
      ],
    },
    {
      title: 'מחירים',
      rows: [
        {
          label: 'חינם',
          us: `0 ש"ח, ${PLAN_CATALOG.free.limits.activeAutomations} אוטומציות פעילות, ${PLAN_CATALOG.free.limits.dmsPerMonth} הודעות בחודש`,
          them: `0 דולר, ${MC.free.automations} אוטומציות, ${MC.free.contacts} אנשי קשר פעילים`,
          key: true,
        },
        {
          label: 'מסלול כניסה',
          us: `Creator, ${PLAN_CATALOG.creator.priceIls} ש"ח לחודש`,
          them: `Essential, ${MC.essential.usd} דולר לחודש, בערך ${ils(MC.essential.usd)} ש"ח`,
        },
        {
          label: 'מסלול מקצועי',
          us: `Pro, ${PLAN_CATALOG.pro.priceIls} ש"ח לחודש`,
          them: `Pro, ${MC.pro.usd} דולר לחודש, בערך ${ils(MC.pro.usd)} ש"ח`,
          key: true,
        },
        {
          label: 'מסלול סוכנות',
          us: `Agency, ${PLAN_CATALOG.agency.priceIls} ש"ח לחודש`,
          them: `Business ${MC.business.usd} דולר, Advanced ${MC.advanced.usd} דולר`,
        },
        {
          label: 'הנחה שנתית',
          us: 'חודשיים חינם בתשלום שנתי',
          them: 'המחיר המפורסם באתר הוא כבר התעריף השנתי',
        },
        { label: 'תקופת התנסות', us: 'חודש של Pro בשקל אחד', them: 'מסלול חינם קבוע, בלי תקופת ניסיון בתשלום' },
      ],
    },
    {
      title: 'עברית וישראל',
      rows: [
        { label: 'ממשק בעברית', us: 'כן, נבנה בעברית', them: 'לא', key: true },
        {
          label: 'כיווניות ימין לשמאל',
          us: 'כן, בכל המערכת',
          them: 'אין תמיכה מובנית. בקהילה שלהם פתוחה בקשה, והמעקף הוא תוסף כרום',
          key: true,
        },
        { label: 'חשבונית ישראלית', us: 'כן', them: 'לא' },
        { label: 'תמיכה בעברית', us: 'כן', them: 'לא' },
        { label: 'שפות נוספות בממשק', us: '9 שפות', them: 'אנגלית' },
      ],
    },
    {
      title: 'הפעלה מתוך Claude ו-ChatGPT',
      rows: [
        {
          label: 'שרת MCP רשמי',
          us: `כן, מובנה במוצר, ממסלול ${PLAN_CATALOG.pro.name}`,
          them: 'לא. יש עטיפות של צד שלישי מעל ה-API',
          key: true,
        },
        { label: 'מה צריך כדי לחבר', us: 'התחברות אחת, בלי מפתחות ובלי קובץ הגדרות', them: 'טוקן API והגדרה ידנית בקובץ' },
        { label: 'הקמת אוטומציה בשפה חופשית', us: 'כן', them: 'לא במוצר עצמו' },
        { label: 'פרסום פוסטים ורילס מתוך הצ\'אט', us: `כן, ממסלול ${PLAN_CATALOG.pro.name}`, them: 'לא' },
        { label: 'שליפת נתוני ביצועים לצ\'אט', us: 'כן', them: 'לא במוצר עצמו' },
      ],
    },
    {
      title: 'יכולות',
      rows: [
        { label: 'תגובה ציבורית והודעה פרטית', us: 'כן', them: 'כן' },
        { label: 'אינסטגרם ופייסבוק', us: 'כן', them: 'כן' },
        { label: 'מיתוג המערכת בהודעות', us: `מוסר החל מ-${PLAN_CATALOG.creator.name}`, them: '"Powered by Manychat" במסלול החינמי', key: true },
        { label: 'זמן הקמה של אוטומציה ראשונה', us: 'דקות, או משפט אחד לצ\'אט', them: 'בניית תרחיש בממשק' },
      ],
    },
    {
      title: 'מגבלות לפי מסלול',
      rows: [
        {
          label: 'המסלול המקצועי, נפח',
          us: `${PLAN_CATALOG.pro.limits.dmsPerMonth.toLocaleString('he-IL')} הודעות פרטיות בחודש`,
          them: `${MC.pro.contacts.toLocaleString('he-IL')} אנשי קשר פעילים בחודש`,
        },
        {
          label: 'שמירת יומן פעילות',
          us: `${PLAN_CATALOG.pro.limits.logDays} ימים ב-Pro`,
          them: 'לא מפורסם כמגבלת מסלול',
        },
        {
          label: 'כמה עולה להגיע ל-3,000 פניות בחודש',
          us: `${PLAN_CATALOG.pro.priceIls} ש"ח, בתוך המסלול`,
          them: `${MC.pro.usd} דולר ועוד ${Math.round((3000 - MC.pro.contacts) * MC.pro.over)} דולר חריגה`,
          key: true,
        },
      ],
    },
  ],

  body: `
<h2>מה ההבדל האמיתי, במשפט אחד</h2>
<p>ManyChat מחייבת אתכם על <strong>אנשים</strong>. SocialFlow מחייבת אתכם על <strong>הודעות</strong>. כל שאר ההבדלים נגזרים מזה.</p>

<h2>למה יחידת החיוב היא ההחלטה הכי חשובה</h2>
<p>איש קשר פעיל ב-ManyChat הוא כל מי שיצר איתכם אינטראקציה במהלך חודש החיוב. אדם שהגיב פעם אחת על ריל ולא חזר נספר בדיוק כמו לקוח שקנה.</p>
<p>המשמעות המעשית: ככל שהתוכן שלכם עובד טוב יותר, אתם משלמים יותר. ריל שעושה חיים ומביא 3,000 מגיבים בשבוע אחד הוא הצלחה שיווקית, והוא גם שורה בחשבון.</p>
<p>אצלנו המדד הוא מה שהמערכת עשתה בשבילכם: כמה הודעות פרטיות היא שלחה. אם אותו אדם הגיב חמש פעמים והמערכת שלחה לו הודעה אחת, נספרה הודעה אחת.</p>

<h2>מה קורה כשעוברים את המגבלה</h2>
<p>זה ההבדל שהכי קל לפספס ושהכי מרגישים בסוף החודש.</p>
<p>ב-ManyChat, לפי מרכז העזרה שלהם, האוטומציות <strong>ממשיכות לרוץ</strong> כשחורגים מהמכסה, ותוספת התשלום נכנסת אוטומטית לחשבונית הבאה. בשקט. במסלול Pro זה חמישה סנט לכל איש קשר מעבר ל-2,500.</p>
<p>ב-SocialFlow השליחה <strong>נעצרת</strong> כשמגיעים למכסה ואתם מקבלים התראה. זה פחות נוח, ואנחנו יודעים את זה: אם פספסתם את ההתראה, אוטומציה שהייתה אמורה לרוץ לא רצה. בחרנו בזה כי חיוב שאף אחד לא אישר הוא הדבר היחיד שגרוע יותר.</p>

<h2>MCP: להפעיל את המערכת בלי לפתוח אותה</h2>
<p>ל-SocialFlow יש שרת MCP מובנה. משמעות הדבר שאפשר לחבר את החשבון ל-Claude או ל-ChatGPT ולהגיד בשפה חופשית "תקים אוטומציה על הפוסט האחרון, מילת המפתח מדריך, ותשלח את הקישור לעמוד המדריכים". המערכת מקימה אותה.</p>
<p>ל-ManyChat אין שרת MCP רשמי. מה שקיים הוא עטיפות של צד שלישי מעל ה-API הציבורי שלהם: פרויקט קוד פתוח, ומחברים אצל ספקי אוטומציה. הן עובדות, אבל הן דורשות מפתח API, הגדרה ידנית בקובץ, והן לא נתמכות על ידי ManyChat. בקהילה שלהם פתוחה בקשה רשמית ל"API לעידן סוכני ה-AI".</p>
<p>אצלנו זה לא תוסף. זה חלק מהמוצר, והחיבור הוא לחיצה אחת בלי מפתחות ובלי קבצים.</p>

<h2>עברית, וזה לא עניין של נוחות</h2>
<p>ל-ManyChat אין תמיכה מובנית בכיווניות ימין לשמאל. בפורום הקהילה שלהם יש בקשה פתוחה שכותרתה "בקשה דחופה: הוסיפו תמיכה בימין לשמאל לעברית ולערבית", והפתרון שהשוק מצא הוא תוסף כרום של צד שלישי.</p>
<p>כלומר כדי לכתוב הודעה בעברית בלי שהפיסוק יקפוץ לצד הלא נכון, אתם מתקינים תוסף בדפדפן. זה עובד. זה גם אומר משהו על סדר העדיפויות.</p>
<p>SocialFlow נכתבה עם כיווניות לוגית מהשורה הראשונה, ומדברת תשע שפות. עברית היא אחת מהן, לא תרגום שהודבק בסוף.</p>

<h2>כמה זה באמת עולה, על חודש אחד טוב</h2>
<p>נניח ריל שעבד: 3,000 אנשים הגיבו החודש וקיבלו הודעה פרטית.</p>
<p>ב-SocialFlow זה <strong>בתוך המסלול</strong>. Pro כולל 20,000 הודעות בחודש, כלומר החשבון הוא 99 שקלים, בדיוק כמו בחודש שקט.</p>
<p>ב-ManyChat, Pro כולל 2,500 אנשי קשר פעילים. 500 הנוספים הם חריגה של חמישה סנט לכל אחד, כלומר 25 דולר מעל ה-39. החודש הבא שוב תלוי בכמה אנשים הגיבו.</p>
<p>זה לא הבדל של אחוזים. זו השאלה אם התמחור שלכם צפוי או שהוא נגזרת של ההצלחה השיווקית שלכם.</p>

<h2>המעבר לוקח דקות, לא פרויקט</h2>
<p>החיבור עובר דרך אותו ממשק רשמי של Meta שכבר אישרתם פעם. מתחברים עם הפייסבוק, בוחרים את הדף ואת חשבון האינסטגרם העסקי, וזהו.</p>
<p>את האוטומציות בונים מחדש, וזה לוקח דקות: בוחרים פוסט, כותבים מילת מפתח, מדביקים קישור. או, אם אתם על Pro, מחברים את החשבון ל-Claude או ל-ChatGPT ומבקשים מהם להקים את הכול בשפה חופשית.</p>
<p>אין ייצוא, אין ייבוא, אין תקופת חפיפה שבה משלמים על שתי מערכות.</p>

<h2>למי SocialFlow מתאים</h2>
<ul>
<li><strong>עסקים ישראליים</strong> שרוצים ממשק בעברית, חשבונית בשקלים, ותמיכה שעונה בעברית.</li>
<li><strong>יוצרי תוכן</strong> שמפרסמים הרבה ולא רוצים שכל ריל מוצלח ייצור שורה נוספת בחשבון.</li>
<li><strong>מי שעובד עם Claude או ChatGPT</strong> ומעדיף לנהל את המערכת בשיחה במקום בממשק.</li>
<li><strong>סוכנויות</strong> שמנהלות כמה לקוחות תחת חשבון אחד, עם 15 חשבונות ועשרה משתמשים במסלול Agency.</li>
</ul>
`,

  faqTitle: 'שאלות נפוצות',
  faqs: [
    {
      q: 'מה זה איש קשר פעיל ב-ManyChat?',
      a: 'כל אדם שיצר איתכם אינטראקציה דרך המערכת במהלך חודש החיוב הנוכחי. אם אותו אדם פנה חמש פעמים באותו חודש הוא עדיין נספר כאחד, אבל מספיק שהוא הגיב פעם אחת כדי להיספר. במסלול Pro נכללים 2,500, ומעבר לזה התעריף הוא חמישה סנט לאיש קשר.',
    },
    {
      q: 'כמה עולה SocialFlow בהשוואה ל-ManyChat?',
      a: `המסלול המקצועי שלנו עולה ${PLAN_CATALOG.pro.priceIls} שקלים לחודש כולל מע"מ. המסלול המקביל ב-ManyChat עולה ${MC.pro.usd} דולר לחודש, בערך ${ils(MC.pro.usd)} שקלים לפני מע"מ. יש לנו גם מסלול חינמי עם ${PLAN_CATALOG.free.limits.dmsPerMonth} הודעות בחודש, ותקופת התנסות של חודש ב-Pro בשקל אחד.`,
    },
    {
      q: 'האם ל-ManyChat יש MCP?',
      a: 'אין שרת MCP רשמי מטעם ManyChat. קיימות עטיפות של צד שלישי מעל ה-API הציבורי שלהם, שדורשות מפתח API והגדרה ידנית. ל-SocialFlow יש שרת MCP מובנה במוצר, שמאפשר להקים ולתפעל אוטומציות מתוך Claude ו-ChatGPT בשפה חופשית.',
    },
    {
      q: 'האם ManyChat עובדת בעברית?',
      a: 'הממשק באנגלית, ואין תמיכה מובנית בכיווניות ימין לשמאל. בקהילת ManyChat פתוחה בקשה לתמיכה בעברית ובערבית, והמעקף הנפוץ הוא תוסף כרום של צד שלישי. SocialFlow בעברית מלאה, כולל כיווניות, ובעוד שמונה שפות.',
    },
    {
      q: 'מה קורה אם אני עובר את המכסה החודשית?',
      a: 'ב-SocialFlow השליחה נעצרת ואתם מקבלים התראה, בלי חיוב נוסף. ב-ManyChat האוטומציות ממשיכות לרוץ והתוספת מתווספת אוטומטית לחשבונית הבאה.',
    },
    {
      q: 'כמה עולה חודש שבו ריל אחד עשה חיים?',
      a: `אם 3,000 אנשים הגיבו וקיבלו הודעה, ב-SocialFlow זה בתוך המסלול: Pro כולל ${PLAN_CATALOG.pro.limits.dmsPerMonth.toLocaleString('he-IL')} הודעות בחודש, אז החשבון נשאר ${PLAN_CATALOG.pro.priceIls} שקלים. ב-ManyChat אותם 3,000 הם 500 אנשי קשר מעבר למכסת Pro, כלומר 25 דולר חריגה מעל ה-39.`,
    },
    {
      q: 'אפשר לעבור מ-ManyChat ל-SocialFlow?',
      a: 'כן. החיבור הוא דרך אותו ממשק רשמי של Meta, אז החשבונות שכבר מחוברים אצלכם עוברים בהתחברות אחת. את האוטומציות בונים מחדש, וזה לוקח דקות, או שמבקשים מהצ\'אט לבנות אותן דרך MCP.',
    },
  ],

  sourcesTitle: 'מקורות',
  sourcesNote:
    'המחירים והמגבלות של ManyChat נבדקו ב-23 בספטמבר 2026 ונכונים למבנה התמחור שהם השיקו במרץ 2026. תמחור משתנה, ולכן שווה לוודא מולם לפני החלטה. ההמרה לשקלים היא הערכה בלבד ולא כוללת מע"מ. המספרים של SocialFlow נקראים ישירות מקטלוג המסלולים של המוצר.',
  sources: [
    { label: 'ManyChat, עמוד התמחור הרשמי', url: 'https://manychat.com/pricing' },
    { label: 'ManyChat, מרכז העזרה: אנשי קשר פעילים', url: 'https://help.manychat.com/hc/en-us/articles/25800323349020-Active-Contacts' },
    { label: 'ManyChat, מרכז העזרה: מסלול Pro', url: 'https://help.manychat.com/hc/en-us/articles/25800228332572-Pro-plan' },
    { label: 'ManyChat, קהילה: בקשה לתמיכה בעברית ובערבית', url: 'https://community.manychat.com/ideas/urgent-request-add-right-to-left-rtl-support-for-hebrew-arabic-5124' },
    { label: 'ManyChat, קהילה: בקשה ל-API לעידן סוכני AI', url: 'https://community.manychat.com/ideas/manychat-api-for-the-ai-agent-era-broadcast-templates-metrics-flow-management-9298' },
  ],

  ctaTitle: 'רוצים לבדוק בעצמכם?',
  ctaText: 'המסלול החינמי לא מבקש כרטיס אשראי. מחברים דף, מקימים אוטומציה אחת, ורואים על הריל הבא אם זה עובד לכם.',
  ctaBtn: 'להתחיל בחינם',
};

/* -------------------------------------------------------------------------- */
/* English                                                                     */
/* -------------------------------------------------------------------------- */

const en: Compare = {
  title: 'SocialFlow vs ManyChat: the full comparison',
  metaTitle: 'SocialFlow vs ManyChat: pricing, features and MCP compared',
  description:
    'A full comparison of SocialFlow and ManyChat: what each one actually bills you for, what it costs, what happens when you pass the limit, and why one has a built-in MCP server and the other does not. Every number sourced and dated.',
  keywords: 'ManyChat, ManyChat alternative, ManyChat pricing, Instagram comment automation, comment to DM, SocialFlow, MCP',
  lead: 'Both tools do the same basic thing: someone comments on a post and gets a private message with your link. The difference is what you are billed for, what language the product speaks to you in, and what you can do without opening it at all.',

  tldr: [
    'ManyChat bills per active contact, meaning per person who interacted with you this month. SocialFlow bills per private message actually sent.',
    `The professional tier: $${PLAN_CATALOG.pro.priceUsd} a month here, against $${MC.pro.usd} a month on ManyChat.`,
    'Pass the limit on ManyChat and your automations keep running while the overage lands on your next invoice. Here, sending stops and you get an alert. No surprise bill.',
    'SocialFlow has a built-in MCP server: set up and run automations from Claude and ChatGPT in plain language. ManyChat has no official server, only third-party wrappers over its API.',
    'ManyChat has no built-in right-to-left support. There is an open request in their community for Hebrew and Arabic, and the working answer is a Chrome extension.',
    'Switching is one sign-in through the same official Meta interface. Accounts you already have connected come across as they are.',
  ],

  tableTitle: 'The comparison, row by row',
  colUs: 'SocialFlow',
  colThem: 'ManyChat',

  groups: [
    {
      title: 'What you are billed for',
      rows: [
        { label: 'Billing unit', us: 'Private messages sent this month', them: 'Active contacts, anyone who interacted this month', key: true },
        { label: 'Passing the limit', us: 'Sending stops and you get an alert', them: 'Automations keep running, overage goes on the next invoice', key: true },
        { label: 'Overage rate', us: 'None. Upgrade, or wait for next month', them: `$${MC.essential.over} per contact on Essential, $${MC.pro.over} on Pro, $${MC.business.over} on Business` },
        { label: 'Billing currency', us: 'Shekels in Israel, dollars elsewhere', them: 'Dollars' },
      ],
    },
    {
      title: 'Pricing',
      rows: [
        {
          label: 'Free',
          us: `$0, ${PLAN_CATALOG.free.limits.activeAutomations} active automations, ${PLAN_CATALOG.free.limits.dmsPerMonth} messages a month`,
          them: `$0, ${MC.free.automations} automations, ${MC.free.contacts} active contacts`,
          key: true,
        },
        { label: 'Entry tier', us: `Creator, $${PLAN_CATALOG.creator.priceUsd} a month`, them: `Essential, $${MC.essential.usd} a month` },
        { label: 'Professional tier', us: `Pro, $${PLAN_CATALOG.pro.priceUsd} a month`, them: `Pro, $${MC.pro.usd} a month`, key: true },
        { label: 'Agency tier', us: `Agency, $${PLAN_CATALOG.agency.priceUsd} a month`, them: `Business $${MC.business.usd}, Advanced $${MC.advanced.usd}` },
        { label: 'Annual discount', us: 'Two months free on annual billing', them: 'The advertised price is already the annual rate' },
        { label: 'Trial', us: 'A month of Pro for one unit of currency', them: 'A permanent free tier, no paid trial' },
      ],
    },
    {
      title: 'Language',
      rows: [
        { label: 'Interface languages', us: '9 languages', them: 'English', key: true },
        { label: 'Right-to-left support', us: 'Yes, throughout', them: 'Not built in. An open community request, worked around with a Chrome extension', key: true },
        { label: 'Local invoicing in Israel', us: 'Yes', them: 'No' },
      ],
    },
    {
      title: 'Running it from Claude and ChatGPT',
      rows: [
        { label: 'Official MCP server', us: `Yes, built in, from the ${PLAN_CATALOG.pro.name} tier`, them: 'No. Third-party wrappers over the API exist', key: true },
        { label: 'What connecting takes', us: 'One sign-in, no keys and no config file', them: 'An API token and a manual config entry' },
        { label: 'Building an automation in plain language', us: 'Yes', them: 'Not in the product itself' },
        { label: 'Publishing posts and reels from the chat', us: `Yes, from the ${PLAN_CATALOG.pro.name} tier`, them: 'No' },
        { label: 'Pulling performance data into the chat', us: 'Yes', them: 'Not in the product itself' },
      ],
    },
    {
      title: 'Features',
      rows: [
        { label: 'Public reply plus private message', us: 'Yes', them: 'Yes' },
        { label: 'Instagram and Facebook', us: 'Yes', them: 'Yes' },
        { label: 'Branding on messages', us: `Removed from ${PLAN_CATALOG.creator.name} up`, them: '"Powered by Manychat" on the free tier', key: true },
        { label: 'Time to a first automation', us: 'Minutes, or one sentence to the chat', them: 'Building a flow in the editor' },
      ],
    },
    {
      title: 'Limits by tier',
      rows: [
        { label: 'Professional tier volume', us: `${PLAN_CATALOG.pro.limits.dmsPerMonth.toLocaleString('en')} private messages a month`, them: `${MC.pro.contacts.toLocaleString('en')} active contacts a month` },
        { label: 'Activity log retention', us: `${PLAN_CATALOG.pro.limits.logDays} days on Pro`, them: 'Not published as a tier limit' },
        {
          label: 'Cost of a month with 3,000 enquiries',
          us: `$${PLAN_CATALOG.pro.priceUsd}, inside the tier`,
          them: `$${MC.pro.usd} plus $${Math.round((3000 - MC.pro.contacts) * MC.pro.over)} in overage`,
          key: true,
        },
      ],
    },
  ],

  body: `
<h2>The real difference, in one sentence</h2>
<p>ManyChat bills you for <strong>people</strong>. SocialFlow bills you for <strong>messages</strong>. Every other difference follows from that.</p>

<h2>Why the billing unit is the decision that matters</h2>
<p>An active contact on ManyChat is anyone who interacted with you through the platform during the billing month. Someone who commented once on a reel and never came back counts exactly like a paying customer.</p>
<p>In practice: the better your content performs, the more you pay. A reel that lands and brings 3,000 commenters in a week is a marketing win, and it is also a line on the invoice.</p>
<p>Here the meter is what the system did for you: how many private messages it sent. If the same person commented five times and the system sent one message, that is one message.</p>

<h2>What happens when you pass the limit</h2>
<p>This is the difference that is easiest to miss and hardest to ignore at the end of the month.</p>
<p>On ManyChat, per their own help centre, automations <strong>keep running</strong> past the quota and the overage is added automatically to your next invoice. Quietly. On Pro that is five cents per contact past 2,500.</p>
<p>On SocialFlow, sending <strong>stops</strong> at the quota and you get an alert. That is less convenient, and we know it: miss the alert and an automation that should have run did not. We chose it because a charge nobody approved is the only thing worse.</p>

<h2>MCP: running the product without opening it</h2>
<p>SocialFlow has a built-in MCP server. Connect the account to Claude or ChatGPT and say, in plain language, "set up an automation on my latest post, keyword guide, and send the link to the guides page". It gets built.</p>
<p>ManyChat has no official MCP server. What exists are third-party wrappers over their public API: an open-source project, and connectors from automation vendors. They work, but they need an API key, a manual config entry, and they are not supported by ManyChat. Their own community carries an open request for an "API for the AI agent era".</p>
<p>Here it is not an add-on. It is part of the product, and connecting is one click with no keys and no files.</p>

<h2>What one good month actually costs</h2>
<p>Say a reel lands: 3,000 people comment this month and each gets a private message.</p>
<p>On SocialFlow that is <strong>inside the tier</strong>. Pro includes 20,000 messages a month, so the invoice is the same as in a quiet month.</p>
<p>On ManyChat, Pro includes 2,500 active contacts. The other 500 are overage at five cents each, $25 on top of the $39. Next month depends again on how many people replied.</p>
<p>That is not a difference in percentages. It is whether your pricing is predictable or a derivative of your own marketing success.</p>

<h2>Switching takes minutes, not a project</h2>
<p>The connection runs through the same official Meta interface you have already approved once. Sign in with Facebook, pick the page and the Instagram business account, done.</p>
<p>Automations are rebuilt, and that takes minutes: pick a post, type a keyword, paste a link. Or, on Pro, connect the account to Claude or ChatGPT and ask them to set the whole thing up in plain language.</p>
<p>No export, no import, no overlap month where you pay for two systems.</p>

<h2>Who SocialFlow is for</h2>
<ul>
<li><strong>Businesses</strong> that want the interface, the invoice and the support in their own language.</li>
<li><strong>Creators</strong> who publish a lot and do not want every reel that works to add a line to the invoice.</li>
<li><strong>People who work in Claude or ChatGPT</strong> and would rather run the system in conversation than in an editor.</li>
<li><strong>Agencies</strong> running several clients under one account, with 15 accounts and ten seats on Agency.</li>
</ul>
`,

  faqTitle: 'Frequently asked questions',
  faqs: [
    {
      q: 'What is an active contact on ManyChat?',
      a: 'Anyone who interacted with you through the platform during the current billing month. The same person reaching out five times still counts as one, but a single comment is enough to count. Pro includes 2,500, and past that the rate is five cents per contact.',
    },
    {
      q: 'How much does SocialFlow cost compared to ManyChat?',
      a: `Our professional tier is $${PLAN_CATALOG.pro.priceUsd} a month. The comparable ManyChat tier is $${MC.pro.usd} a month. We also have a free tier with ${PLAN_CATALOG.free.limits.dmsPerMonth} messages a month.`,
    },
    {
      q: 'Does ManyChat have an MCP server?',
      a: 'There is no official MCP server from ManyChat. Third-party wrappers over their public API exist and require an API key and manual configuration. SocialFlow has an MCP server built into the product, which lets you set up and run automations from Claude and ChatGPT in plain language.',
    },
    {
      q: 'Does ManyChat work in Hebrew?',
      a: 'The interface is English, and there is no built-in right-to-left support. ManyChat community carries an open request for Hebrew and Arabic support, and the common workaround is a third-party Chrome extension. SocialFlow is fully right-to-left, in Hebrew and Arabic among nine languages.',
    },
    {
      q: 'What happens if I pass the monthly quota?',
      a: 'On SocialFlow sending stops and you get an alert, with no extra charge. On ManyChat automations keep running and the overage is added automatically to your next invoice.',
    },
    {
      q: 'What does a month with one viral reel cost?',
      a: `If 3,000 people comment and each gets a message, on SocialFlow that is inside the tier: Pro includes ${PLAN_CATALOG.pro.limits.dmsPerMonth.toLocaleString('en')} messages a month, so the invoice stays $${PLAN_CATALOG.pro.priceUsd}. On ManyChat those same 3,000 are 500 contacts past the Pro quota, which is $25 of overage on top of the $39.`,
    },
    {
      q: 'Can I move from ManyChat to SocialFlow?',
      a: 'Yes. The connection runs through the same official Meta interface, so accounts you already have connected come across in one sign-in. Automations are rebuilt, which takes minutes, or you ask the chat to build them through MCP.',
    },
  ],

  sourcesTitle: 'Sources',
  sourcesNote:
    'ManyChat prices and limits were checked on 23 September 2026 and reflect the pricing structure they launched in March 2026. Pricing changes, so verify with them before deciding. SocialFlow figures are read directly from the product plan catalogue.',
  sources: [
    { label: 'ManyChat official pricing page', url: 'https://manychat.com/pricing' },
    { label: 'ManyChat help centre: Active Contacts', url: 'https://help.manychat.com/hc/en-us/articles/25800323349020-Active-Contacts' },
    { label: 'ManyChat help centre: Pro plan', url: 'https://help.manychat.com/hc/en-us/articles/25800228332572-Pro-plan' },
    { label: 'ManyChat community: request for Hebrew and Arabic RTL support', url: 'https://community.manychat.com/ideas/urgent-request-add-right-to-left-rtl-support-for-hebrew-arabic-5124' },
    { label: 'ManyChat community: request for an API for the AI agent era', url: 'https://community.manychat.com/ideas/manychat-api-for-the-ai-agent-era-broadcast-templates-metrics-flow-management-9298' },
  ],

  ctaTitle: 'Want to check for yourself?',
  ctaText: 'The free tier asks for no card. Connect a page, build one automation, and see on your next reel whether it works for you.',
  ctaBtn: 'Start free',
};

export function compareFor(locale: Locale): Compare {
  return locale === 'he' ? he : en;
}
