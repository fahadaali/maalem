"use client";

import { useEffect } from "react";

/**
 * يعود بالمدير إلى العنصر الذي عمل عليه بعد الحفظ. المرساة (#) تضيع في تحويل
 * إجراء الخادم، فيُحمل اسم العنصر في `?focus=` ويُمرَّر إليه هنا ويُبرز لحظة.
 */
export default function FocusItem({ id }: { id?: string }) {
  useEffect(() => {
    if (!id) return;
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ block: "center" });
    el.classList.add("ring-2", "ring-ink");
    const t = window.setTimeout(() => el.classList.remove("ring-2", "ring-ink"), 1800);
    return () => window.clearTimeout(t);
  }, [id]);
  return null;
}
