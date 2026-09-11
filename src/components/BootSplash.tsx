"use client";

import { useEffect } from "react";

/** أقل مدة تُعرض فيها شاشة الإقلاع، محسوبة من بدء التنقل — فلا تكتمل الحركة ثم تُقطع */
const MIN_MS = 850;

/**
 * يُخفي شاشة الإقلاع متى جهز التطبيق. الشاشة مرسومة في الوثيقة من الخادم كي
 * تظهر مع أول رسم لا بعد التفاعل.
 *
 * تُخفى ولا تُحذف: العنصر من شجرة React، وحذفه من الصفحة يجعل React يفشل في
 * إزالته عند أول إعادة تصيير — «removeChild» على عنصر ليس ابناً — فتسقط الواجهة.
 */
export default function BootSplash() {
  useEffect(() => {
    const el = document.getElementById("boot");
    if (!el) return;
    const wait = Math.max(0, MIN_MS - performance.now());
    const hide = window.setTimeout(() => el.classList.add("boot-done"), wait);
    return () => window.clearTimeout(hide);
  }, []);
  return null;
}
