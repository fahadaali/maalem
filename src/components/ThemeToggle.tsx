"use client";

import { useEffect, useState } from "react";
import { Moon, Sun, Monitor } from "lucide-react";

const KEY = "maalem-theme";
type Theme = "system" | "light" | "dark";

/** يضع السمة على عنصر الجذر، والنظام يعني إزالتها فتتبع تفضيل الجهاز */
function apply(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
}

export default function ThemeToggle({ compact }: { compact?: boolean }) {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    let saved: Theme = "system";
    try {
      const v = localStorage.getItem(KEY);
      if (v === "light" || v === "dark") saved = v;
    } catch {
      // التخزين المحلي معطّل — تبقى السمة على النظام
    }
    setTheme(saved);
    apply(saved);
  }, []);

  const pick = (t: Theme) => {
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
