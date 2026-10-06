"use client";

import { useEffect, useRef, useState } from "react";
import { daysLabel } from "@/lib/utils";

type WeekQuota = { start: string; daily: number; label: string };

/**
 * مقدار البطاقة وهو يُكتب: صفحاتها، وكم يوماً تعادل من ورد أسبوعها بنصابه في
 * الجدول. يقرأ حقول النموذج الذي هو فيه (التاريخ ومن صفحة وإلى صفحة) فلا يحتاج
 * النموذج إلى أن يصير مكوّن عميل.
 */
export default function ReadingAmountHint({ weeks }: { weeks: WeekQuota[] }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [text, setText] = useState("");

  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    const read = () => {
      const val = (n: string) => (form.elements.namedItem(n) as HTMLInputElement | null)?.value ?? "";
      const from = Number(val("fromPage"));
      const to = Number(val("toPage"));
      const date = val("date");
      if (!Number.isFinite(from) || !Number.isFinite(to) || from < 1 || to < from) {
        setText("");
        return;
      }
      const pages = to - from + 1;
      // أسبوع التاريخ: آخر أسبوع بدأ قبله أو فيه
      const week = [...weeks].reverse().find((w) => !date || w.start <= date);
      if (!week) {
        setText(`${pages} صفحة`);
        return;
      }
      const days = Math.round((pages / week.daily) * 2) / 2;
      setText(`${pages} صفحة — تعادل ${daysLabel(days)} تقريباً من ورد ${week.label} (نصابه اليومي ${Math.round(week.daily)} صفحة)`);
    };
    read();
    form.addEventListener("input", read);
    return () => form.removeEventListener("input", read);
  }, [weeks]);

  return (
    <p ref={ref} className="text-xs text-muted -mt-2 mb-3 min-h-4" aria-live="polite">
      {text}
    </p>
  );
}
