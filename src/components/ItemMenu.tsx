"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { EllipsisVertical } from "lucide-react";
import Popover from "@/components/Popover";

/**
 * قائمة ⋮ على عنصرٍ من إدخالات المشارك في ملفه: تعديل، مراجعة، إرجاع، حذف.
 *
 * تحمل هذه الطبقة الفتح والإغلاق وحدهما (بالنقر خارجها، وبـEsc، وباختيار بند)؛
 * وبنودها ترسمها الصفحة على الخادم — روابط تفتح لوحةً تحت العنصر، ونماذج تمضي
 * إلى إجراءات الخادم — فتبقى النماذج نماذجَ خادم كسائر المنصة.
 */
export default function ItemMenu({ children, label = "خيارات" }: { children: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
        onClick={() => setOpen((o) => !o)}
      >
        <EllipsisVertical size={16} />
      </button>
      {open && (
        <Popover>
          {/* اختيار رابطٍ يُغلق القائمة؛ والنموذج يُغلقها حين ينتقل الطلب */}
          <div role="menu" className="py-1" onClick={(e) => { if ((e.target as HTMLElement).closest("a")) setOpen(false); }}>
            {children}
          </div>
        </Popover>
      )}
    </div>
  );
}
