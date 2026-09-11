"use client";

import { useEffect } from "react";

/**
 * أقل مدة تبقى فيها شاشة الإقلاع ظاهرة، محسوبة من لحظة ظهورها لا من بدء
 * التنقل. الحركة نفسها تنتهي عند ٧٨٠ مل.ث، فبأقلَّ من ذلك تظهر وتختفي خطفاً.
 */
const MIN_VISIBLE = 900;

/**
 * يُخفي شاشة الإقلاع متى جهز التطبيق، بعد أن تكون قد ظهرت مدةً تكفي لاكتمال
 * حركتها. الشاشة مرسومة في الوثيقة من الخادم كي تظهر مع أول رسم.
 *
 * تُخفى ولا تُحذف: العنصر من شجرة React، وحذفه من الصفحة يجعل React يفشل في
 * إزالته عند أول إعادة تصيير — «removeChild» على عنصر ليس ابناً — فتسقط الواجهة.
 */
export default function BootSplash() {
  useEffect(() => {
    const el = document.getElementById("boot");
    if (!el) return;
    const shownAt = (window as Window & { __maalemBoot?: number }).__maalemBoot ?? Date.now();
    const wait = Math.max(0, MIN_VISIBLE - (Date.now() - shownAt));
    const hide = window.setTimeout(() => el.classList.add("boot-done"), wait);
    return () => window.clearTimeout(hide);
  }, []);
  return null;
}
