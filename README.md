# SocialFlow — ניהול תגובות בפייסבוק

מערכת עצמאית (Next.js) לחיבור דפי פייסבוק, עיון בפוסטים ומענה לתגובות — ישירות מהמערכת.
**ללא מסד נתונים וללא Base44/Supabase.** הטוקן נשמר מוצפן ב-cookie בלבד, וכל הנתונים נשלפים בזמן אמת מ-Meta Graph API.

## יכולות

- 🔐 התחברות עם פייסבוק (OAuth) עם הרשאות ניהול דפים
- 📄 הצגת כל הדפים שאתה מנהל
- 📰 עיון בפוסטים אחרונים של כל דף
- 💬 כתיבת תגובה חדשה לפוסט
- ↩️ מענה לתגובות קיימות — הכל מתוך המערכת

## ארכיטקטורה

- **Next.js 14** (App Router, TypeScript)
- **iron-session** — טוקן מוצפן ב-cookie (httpOnly), ללא DB
- **Meta Graph API v21** — מקור האמת לדפים/פוסטים/תגובות
- **Tailwind CSS** — ממשק RTL בעברית

```
app/
  page.tsx                     דף נחיתה + כפתור התחברות
  dashboard/page.tsx           דף ראשי (בודק התחברות)
  api/auth/login               מתחיל OAuth
  api/auth/callback            מחליף code בטוקן ארוך-טווח
  api/auth/logout              ניתוק
  api/pages                    רשימת דפים
  api/pages/[id]/posts         פוסטים של דף
  api/posts/[id]/comments      תגובות + פרסום תגובה
  api/comments/[id]/reply      מענה לתגובה
components/
  Dashboard.tsx                ממשק בחירת דף + פוסטים
  PostCard.tsx                 פוסט + תגובות + מענה
lib/
  meta.ts                      פונקציות Graph API
  session.ts                   ניהול session מוצפן
  auth-helpers.ts              שליפת טוקן דף
  url.ts                       זיהוי כתובת בסיס (localhost/Vercel)
```

## הרצה מקומית

```bash
npm install
cp .env.example .env.local   # מלא את המשתנים
npm run dev                   # http://localhost:3000
```

## משתני סביבה

| משתנה | תיאור |
|-------|-------|
| `META_APP_ID` | מזהה אפליקציית Meta |
| `META_APP_SECRET` | סוד אפליקציית Meta |
| `META_GRAPH_VERSION` | גרסת Graph API (ברירת מחדל: v21.0) |
| `SESSION_SECRET` | מפתח הצפנה ל-cookie (32+ תווים) — `openssl rand -base64 32` |
| `NEXT_PUBLIC_BASE_URL` | כתובת בסיס. ריק = זיהוי אוטומטי (עובד ב-localhost וב-Vercel) |

## פריסה ל-Vercel

1. חבר את הריפו ל-Vercel (Import Project)
2. הוסף את משתני הסביבה ב-Vercel → Settings → Environment Variables
3. הוסף ב-Meta App את ה-Redirect URIs:
   - `https://<your-app>.vercel.app/api/auth/callback`
   - `http://localhost:3000/api/auth/callback` (לפיתוח)

## הרשאות Meta הנדרשות

`pages_show_list`, `pages_read_engagement`, `pages_read_user_content`,
`pages_manage_engagement`, `pages_manage_posts`

לפיתוח עם הדפים שלך (כמנהל) ניתן להשתמש באפליקציה ב-Development Mode.
