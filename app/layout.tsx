import type { Metadata } from 'next';
import './globals.css';
import './app.css';

export const metadata: Metadata = {
  title: 'SocialFlow: כל תגובה הופכת לליד, אוטומטית',
  description: 'אוטומציה לתגובות בפייסבוק ובאינסטגרם: תגובה ציבורית, הודעה פרטית עם הקישור, וליד נקלט. ניהול גם מתוך Claude ו-ChatGPT דרך MCP.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <head>
        {/* Karantina (display) + Assistant (body): the pair used across the design system */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Karantina:wght@300;400;700&family=Assistant:wght@300;400;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
