export const metadata = { title: 'מחיקת מידע — SocialFlow' };

export default function DataDeletion() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-12 leading-relaxed" dir="rtl">
      <h1 className="text-2xl font-bold mb-2">הוראות מחיקת מידע</h1>
      <p className="text-sm text-gray-500 mb-8">עודכן לאחרונה: יוני 2026</p>

      <Section title="כיצד למחוק את המידע שלך">
        <p className="mb-3">
          באפשרותך למחוק את כל המידע שלך מ-SocialFlow באחת מהדרכים הבאות:
        </p>
        <ol className="list-decimal pr-6 space-y-2">
          <li>
            <strong>ניתוק מהמערכת:</strong> היכנס לאפליקציה ולחץ על "התנתק". פעולה
            זו מוחקת את טוקן הגישה שלך מהמערכת.
          </li>
          <li>
            <strong>הסרת האפליקציה מ-Facebook:</strong> היכנס ל-Facebook →
            Settings → Business Integrations → SocialFlow → Remove. פעולה זו
            מבטלת את כל ההרשאות.
          </li>
          <li>
            <strong>בקשת מחיקה מלאה:</strong> שלח אימייל ל-gkobzafrani@gmail.com
            עם הנושא "Delete my data" ונמחק את כל הנתונים שלך (אוטומציות, לוגים,
            טוקנים) תוך 30 יום.
          </li>
        </ol>
      </Section>

      <Section title="איזה מידע נמחק">
        כל הטוקנים, הגדרות האוטומציות, היסטוריית ההפעלות (לוגים), והנתונים
        הקשורים לחשבון שלך נמחקים לצמיתות.
      </Section>

      <Section title="יצירת קשר">
        לבקשות מחיקה: gkobzafrani@gmail.com
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
