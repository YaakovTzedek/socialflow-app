import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SocialFlow: כל תגובה הופכת לליד, אוטומטית',
  description: 'אוטומציה לתגובות בפייסבוק ובאינסטגרם: תגובה ציבורית, הודעה פרטית עם הקישור, וליד נקלט. ניהול גם מתוך Claude ו-ChatGPT דרך MCP.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he" dir="rtl">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
