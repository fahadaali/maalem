"use client";

import { useEffect, useRef, useState } from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { THEME_COLORS, THEME_KEY as KEY } from "@/lib/theme";

type Theme = "system" | "light" | "dark";

/** لون شريط حالة النظام يتبع السمة المطبَّقة، وإلا بقي مخالفاً للواجهة */
function syncStatusBar(dark: boolean) {
  let m = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]:not([media])');
  if (!m) {
    m = document.createElement("meta");
    m.setAttribute("name", "theme-color");
    document.head.appendChild(m);
  }
  m.setAttribute("content", dark ? THEME_COLORS.dark : THEME_COLORS.light);
}

/** يضع السمة على عنصر الجذر، والنظام يعني إزالتها فتتبع تفضيل الجهاز */
function apply(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
  syncStatusBar(theme === "system" ? window.matchMedia("(prefers-color-scheme: dark)").matches : theme === "dark");
}

export default function ThemeToggle({ compact }: { compact?: boolean }) {
  const [theme, setTheme] = useState<Theme>("system");
  /** السمة الحالية لمستمع تغيّر النظام، فلا يبقى على قيمة لحظة التركيب */
  const current = useRef<Theme>("system");

  useEffect(() => {
    let saved: Theme = "system";
    try {
      const v = localStorage.getItem(KEY);
      if (v === "light" || v === "dark") saved = v;
    } catch {
      // التخزين المحلي معطّل — تبقى السمة على النظام
    }
    current.current = saved;
    setTheme(saved);
    apply(saved);
    // من اختار «حسب الجهاز» يتبع تغيّر تفضيل النظام أثناء الاستعمال
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => { if (current.current === "system") syncStatusBar(mq.matches); };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const pick = (t: Theme) => {
    current.current = t;
    setTheme(t);
    apply(t);
    try {
      if (t === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, t);
    } catch {
      // لا شيء يُحفظ، والاختيار يبقى لهذه الجلسة
    }
  };

  const options: { key: Theme; label: string; Icon: typeof Sun }[] = [
    { key: "light", label: "فاتح", Icon: Sun },
    { key: "dark", label: "ليلي", Icon: Moon },
    { key: "system", label: "حسب الجهاز", Icon: Monitor },
  ];

  return (
    <div className="inline-flex gap-1 rounded-xl border border-line p-1" role="group" aria-label="سمة الواجهة">
      {options.map(({ key, label, Icon }) => (
        <button
          key={key}
          type="button"
          onClick={() => pick(key)}
          aria-pressed={theme === key}
          title={label}
          className={`btn btn-sm ${theme === key ? "" : "btn-ghost"}`}
        >
          <Icon size={15} />
          {!compact && <span>{label}</span>}
        </button>
      ))}
    </div>
  );
}
