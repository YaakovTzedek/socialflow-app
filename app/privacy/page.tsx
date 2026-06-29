export const metadata = { title: 'מדיניות פרטיות — SocialFlow' };

export default function Privacy() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-12 leading-relaxed" dir="rtl">
      <h1 className="text-2xl font-bold mb-2">מדיניות פרטיות</h1>
      <p className="text-sm text-gray-500 mb-8">עודכן לאחרונה: יוני 2026</p>

      <Section title="מי אנחנו">
        SocialFlow היא מערכת לניהול תגובות ואוטומציה לדפי Facebook ולחשבונות
        Instagram Business. המערכת מאפשרת למנהל הדף לעיין בפוסטים, להגיב לתגובות,
        ולהגדיר תגובות אוטומטיות.
      </Section>

      <Section title="איזה מידע אנו אוספים">
        <ul className="list-disc pr-6 space-y-1">
          <li>טוקן גישה של Facebook (מאוחסן מוצפן, משמש לפעולות בשמך בלבד)</li>
          <li>שם ומזהה המשתמש מ-Facebook (לזיהוי החשבון)</li>
          <li>רשימת הדפים שאתה מנהל והפוסטים/תגובות בהם</li>
          <li>הגדרות האוטומציות שאתה יוצר</li>
        </ul>
      </Section>

      <Section title="כיצד אנו משתמשים במידע">
        המידע משמש אך ורק כדי לספק את שירותי המערכת: הצגת דפים ופוסטים, פרסום
        תגובות שאתה מאשר, ושליחת תגובות/הודעות אוטומטיות לפי הכללים שהגדרת. איננו
        מוכרים או משתפים את המידע עם צד שלישי.
      </Section>

      <Section title="אחסון ואבטחה">
        טוקני הגישה מאוחסנים בצורה מוצפנת. נתוני האוטומציות מאוחסנים במסד נתונים
        מאובטח. אנו משתמשים בחיבורים מוצפנים (HTTPS) בכל התקשורת.
      </Section>

      <Section title="מחיקת מידע">
        באפשרותך למחוק את המידע שלך בכל עת — ראה{' '}
        <a href="/data-deletion" className="text-brand-600 underline">
          הוראות מחיקת מידע
        </a>
        . ניתוק החשבון מסיר את כל הטוקנים והנתונים הקשורים.
      </Section>

      <Section title="יצירת קשר">
        לשאלות בנושא פרטיות: gkobzafrani@gmail.com
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="text-lg font-semibold mb-2">{title}</h2>
      <div className="text-gray-700">{children}</div>
    </section>
  );
}
