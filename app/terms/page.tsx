export const metadata = { title: 'תנאי שימוש — SocialFlow' };

export default function Terms() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-12 leading-relaxed" dir="rtl">
      <h1 className="text-2xl font-bold mb-2">תנאי שימוש</h1>
      <p className="text-sm text-gray-500 mb-8">עודכן לאחרונה: יוני 2026</p>

      <Section title="קבלת התנאים">
        השימוש ב-SocialFlow מהווה הסכמה לתנאים אלה. אם אינך מסכים, אנא הימנע
        משימוש בשירות.
      </Section>

      <Section title="השירות">
        SocialFlow מספקת כלים לניהול תגובות ואוטומציה לדפי Facebook ו-Instagram
        Business שאתה מנהל. אתה אחראי לתוכן התגובות וההודעות שאתה שולח דרך המערכת.
      </Section>

      <Section title="שימוש הולם">
        מתחייב להשתמש בשירות בהתאם למדיניות של Meta ולחוק. אין להשתמש במערכת
        לשליחת ספאם, תוכן פוגעני, או הטעיה.
      </Section>

      <Section title="אחריות">
        השירות מסופק "כפי שהוא". איננו אחראים לנזקים עקיפים הנובעים משימוש
        בשירות, או לשינויים במדיניות של Meta המשפיעים על הפונקציונליות.
      </Section>

      <Section title="יצירת קשר">
        לשאלות: gkobzafrani@gmail.com
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
