import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';

export default async function Home({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const session = await getSession();
  if (session.userAccessToken) {
    redirect('/dashboard');
  }

  const error = searchParams.error;

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-10 text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
            <svg
              className="w-9 h-9 text-white"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold mb-2">SocialFlow</h1>
          <p className="text-gray-500 text-sm mb-8">
            חבר את דפי הפייסבוק שלך, עיין בפוסטים והגב לתגובות — הכל ממקום אחד.
          </p>

          {error && (
            <div className="mb-6 rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-600">
              שגיאת התחברות: {error}
            </div>
          )}

          <Link
            href="/api/auth/login"
            className="inline-flex items-center justify-center gap-2 w-full rounded-xl bg-[#1877F2] hover:bg-[#166fe0] text-white font-semibold py-3.5 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M24 12.07C24 5.41 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.04V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.5c-1.5 0-1.96.93-1.96 1.89v2.25h3.32l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z" />
            </svg>
            התחבר עם פייסבוק
          </Link>

          <p className="text-xs text-gray-400 mt-6 leading-relaxed">
            נשתמש בהרשאות לניהול תגובות בלבד. הטוקן נשמר מוצפן בדפדפן שלך ולא
            נשמר בשום מסד נתונים חיצוני.
          </p>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          ניהול תגובות לפייסבוק · ללא מסד נתונים · פרטי לחלוטין
        </p>
      </div>
    </main>
  );
}
