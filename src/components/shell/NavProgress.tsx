"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * شريطٌ رفيع أعلى الشاشة من النقر على رابطٍ داخلي حتى تصل صفحته.
 *
 * صفحات اللوحة تُصيَّر على الخادم وبعضها ثقيل (الملف، كشف الدرجات، الاتجاهات)،
 * فكانت النقرة لا تُحدث شيئاً مرئياً ريثما تصل — فيُعاد النقر ظنّاً أنها لم تقع.
 * ولم يُستعمل loading.tsx لذلك: جُرّب فأفرغ الصفحة بعد كل إجراءٍ يعيد التوجيه
 * (انظر src/app/layout.tsx). وهذا لا يلفّ المحتوى بشيء، وإنما يُصغي إلى النقر
 * ويختفي حين يتبدّل المسار أو معاملاته.
 */
export default function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [active, setActive] = useState(false);
  const safety = useRef<number | null>(null);

  // وصلت الصفحة: تبدّل المسار أو معاملاته
  useEffect(() => {
    setActive(false);
    if (safety.current) window.clearTimeout(safety.current);
  }, [pathname, search]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || !a.href || a.target === "_blank" || a.hasAttribute("download")) return;
      let url: URL;
      try {
        url = new URL(a.href, location.href);
      } catch {
        return;
      }
      if (url.origin !== location.origin) return;
      // المرساة في الصفحة نفسها لا تنقل إلى صفحة
      if (url.pathname === location.pathname && url.search === location.search) return;
      // الملفات والواجهات البرمجية تُنزَّل ولا تُصيَّر صفحةً
      if (url.pathname.startsWith("/api/")) return;
      setActive(true);
      // ولا يبقى الشريط معلّقاً إن لم تكتمل الملاحة لسببٍ ما
      if (safety.current) window.clearTimeout(safety.current);
      safety.current = window.setTimeout(() => setActive(false), 15000);
    };
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("click", onClick);
      if (safety.current) window.clearTimeout(safety.current);
    };
  }, []);

  return <div className={active ? "nav-progress is-active" : "nav-progress"} role="presentation" aria-hidden="true" />;
}
