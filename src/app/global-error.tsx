"use client";

import ErrorScreen from "@/components/ErrorScreen";
import { themeBootScript } from "@/lib/theme";
import "./globals.css";

/**
 * آخر حدّ للالتقاط: يعمل حين يتعطّل التخطيط الجذري نفسه، فيصوغ وثيقته كاملة.
 * بدونه تظهر رسالة Next الإنجليزية على شاشة سوداء بلا مخرج.
 */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeBootScript }} /></head>
      <body className="antialiased">
        <ErrorScreen error={error} bare />
      </body>
    </html>
  );
}
