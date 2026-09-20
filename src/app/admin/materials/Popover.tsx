import type { ReactNode } from "react";

/**
 * مطواةٌ تخرج من زرّ: عرضها لا يتجاوز الشاشة على الجوال، وطولها يُمرَّر لا يفيض.
 *
 * و`up` تقلبها إلى أعلى الزرّ — للزرّ العائم في ذيل الصفحة، إذ لا موضع تحته.
 * فُصلت عن `LibraryBoard` ليقرأ منها الشريطُ والعائمُ جميعاً بلا دورة استيراد.
 */
export default function Popover({ children, wide, up }: { children: ReactNode; wide?: boolean; up?: boolean }) {
  return (
    <div
      className={`absolute z-40 end-0 card p-0 shadow-sm text-sm max-h-[70vh] overflow-auto ${up ? "bottom-full mb-2" : "top-full mt-1"}`}
      style={{ width: `min(${wide ? "22rem" : "15rem"}, calc(100vw - 2.5rem))` }}
    >
      {children}
    </div>
  );
}
