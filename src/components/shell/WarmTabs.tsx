"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type Conn = { saveData?: boolean; effectiveType?: string };

/**
 * تسخين مسارات التبويبات واحداً تلو الآخر بعد أن تستقر الصفحة الحالية.
 * الجلب دفعةً واحدة — وهو ما يفعله prefetch التلقائي — كان يطلق خمسة طلبات
 * متزامنة، كلٌّ منها عشرات الاستعلامات، فينقطع بثّ أحدها ويصل إلى المتصفح
 * ناقصاً فيرمي «Connection closed». والتتابع يبقي طلباً واحداً في الطريق.
 */
export default function WarmTabs({ hrefs }: { hrefs: string[] }) {
  const router = useRouter();
  const key = hrefs.join("|");
  useEffect(() => {
    const conn = (navigator as Navigator & { connection?: Conn }).connection;
    // احترام توفير البيانات والشبكات البطيئة: لا تسخين أصلاً
    if (conn?.saveData || (conn?.effectiveType && /(^|-)2g$/.test(conn.effectiveType))) return;
    const list = key.split("|").filter(Boolean);
    const timers: number[] = [];
    list.forEach((h, i) => {
      timers.push(window.setTimeout(() => router.prefetch(h), 1500 + i * 800));
    });
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [key, router]);
  return null;
}
