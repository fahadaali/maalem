"use client";

/**
 * تعبئة سريعة: ضبط عمود الحضور كاملاً بحالة واحدة، ثم يُراجَع ويُحفظ يدوياً.
 *
 * و«الكل حاضر» لا يمسّ من رُصد «معذوراً» ولا من قُبل استئذانه عن اللقاء: كانت تكتب
 * فوقهما «حاضر»، فيُحفظ الحضور ويُمحى عذرٌ اعتمده المدير من صفحة الطلبات بلا علمه.
 */
export default function AttendanceQuickFill() {
  const setAll = (type: "INPERSON" | "REMOTE" | "ALL", status: string) => {
    const form = document.querySelector("form[data-attendance]");
    if (!form) return;
    const cells = Array.from(form.querySelectorAll("select[name^='att_']")) as unknown as { name: string; value: string; dataset: Record<string, string | undefined> }[];
    for (const el of cells) {
      const t = el.name.endsWith("_INPERSON") ? "INPERSON" : "REMOTE";
      if (type !== "ALL" && t !== type) continue;
      if (status && (el.value === "EXCUSED" || el.dataset.excused === "1")) continue;
      el.value = status;
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-2 mb-3 text-sm">
      <span className="text-muted text-xs">تعبئة سريعة:</span>
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAll("INPERSON", "PRESENT")}>الحضوري: الكل حاضر</button>
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAll("REMOTE", "PRESENT")}>عن بُعد: الكل حاضر</button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAll("ALL", "")}>مسح الاختيارات</button>
      <span className="text-muted text-xs">لا تمسّ «الكل حاضر» من رُصد معذوراً أو قُبل استئذانه.</span>
    </div>
  );
}
