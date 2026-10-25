"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

/**
 * يرافق رسالة النجاح أو الخطأ المرسومة أعلى الصفحة (`FormMessage`):
 *
 * - إن لم تكن الرسالة في الشاشة — أعاد الإجراءُ المديرَ إلى عنصره في وسط الملف —
 *   ظهرت عائمةً في ذيلها بضع ثوانٍ، فلا يبدو الحفظ كأنه لم يقع.
 * - وتُمحى `ok` و`err` من شريط العنوان بعد عرضها، فلا تعود الرسالة نفسها مع
 *   التحديث أو الرجوع، ولا تُنسخ مع الرابط إلى غيره.
 */
export default function FlashToast({ tone, message, anchorId }: { tone: "success" | "error"; message: string; anchorId: string }) {
  const [shown, setShown] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const anchor = document.getElementById(anchorId);
    const r = anchor?.getBoundingClientRect();
    const header = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("scroll-padding-top")) || 56;
    // تُرى الرسالة إن كان شيءٌ منها بين الترويسة وذيل الشاشة
    const visible = !!r && r.bottom > header && r.top < window.innerHeight;
    if (!visible) {
      setShown(true);
      timer.current = window.setTimeout(() => setShown(false), tone === "error" ? 9000 : 5000);
    }
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has("ok") || url.searchParams.has("err")) {
        url.searchParams.delete("ok");
        url.searchParams.delete("err");
        // حالةٌ فارغة لا حالةُ التاريخ نفسها: Next يرقّع replaceState، فيُحدّث رابطه المعتمد
        // ومعاملاته بما يُكتب هنا — إلا أن تحمل الحالةُ علامته (__NA) فيحسبها من داخله ويتركها.
        // ولو بقي رابطه القديم لعادت `ok` مع أول إجراءٍ لا يعيد التوجيه، ومعها الرسالة نفسها.
        window.history.replaceState(null, "", url.pathname + url.search + url.hash);
      }
    } catch {
      // عنوانٌ لا يُحلَّل: تبقى المعاملات كما هي
    }
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [anchorId, message, tone]);

  if (!shown) return null;
  return (
    <div className="flash-toast" data-tone={tone} role={tone === "error" ? "alert" : "status"}>
      <span className="flex-1 min-w-0">{message}</span>
      <button type="button" className="shrink-0 text-muted hover:text-ink" aria-label="إغلاق" onClick={() => setShown(false)}>
        <X size={16} />
      </button>
    </div>
  );
}
