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
    /**
     * إن كانت الشاشة قد ظهرت في صفحة المدخل قبل لحظات فالمدة تُحسب من ظهورها
     * هناك: الحركة تكتمل مرة واحدة متصلة، ولا تُعاد ولا تُقطع.
     */
    let from = 0;
    try {
      from = Number(sessionStorage.getItem("maalem-boot-at") ?? 0);
      if (from) sessionStorage.removeItem("maalem-boot-at");
    } catch {
      // لا تخزين متاح
    }
    if (!from || Date.now() - from > 15_000) from = (window as Window & { __maalemBoot?: number }).__maalemBoot ?? Date.now();
    const wait = Math.max(0, MIN_VISIBLE - (Date.now() - from));
    const hide = window.setTimeout(() => el.classList.add("boot-done"), wait);
    return () => window.clearTimeout(hide);
  }, []);
  return null;
}
