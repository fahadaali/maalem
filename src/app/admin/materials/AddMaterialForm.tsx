"use client";
import { useState } from "react";
import { checkFile } from "@/lib/files";
import { uploadFile } from "@/lib/upload-client";
import { saveMaterial } from "../actions";

/**
 * نموذج إضافة مادة: خطوةٌ واحدة في عين المدير، وخطوتان تحتها.
 *
 * بايتات الملف لا تمرّ بإجراء الخادم بحال. لإجراءات الخادم وحدها حدُّ حجمٍ
 * للجسم في Next، وتجاوزه يردّ 500 لا يستطيع عميل React تفسيره: فلا رسالة تظهر،
 * ولا يعود الزرّ من «جارٍ الحفظ…» أبداً. فيُرفع الملف أولاً إلى ‎/api/upload —
 * مُعالِج مسارٍ بلا حدّ، وهو نفسه الذي يستعمله زرّ «إرفاق ملف» — ثم يُرسل
 * معرّفه وحده مع بقية الحقول، فيصير جسم الإجراء كيلوبايتات.
 */
export default function AddMaterialForm({ children }: { children: React.ReactNode }) {
  const [busy, setBusy] = useState(false);
  /** نسبة الرفع، أو null حين لا رفع جارٍ */
  const [pct, setPct] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const form = e.currentTarget;
    const fd = new FormData(form);
    const picked = fd.get("file");
    const file = picked instanceof File && picked.size > 0 ? picked : null;
    fd.delete("file");

    if (file) {
      // ردٌّ فوريّ قبل إنفاق ثانية في الرفع
      const bad = checkFile(file);
      if (bad) return setError(bad);
    }
    setError(null);
    setBusy(true);
    try {
      if (file) {
        setPct(0);
        const att = await uploadFile(file, "MATERIAL", undefined, setPct);
        fd.set("attachmentId", att.id);
        setPct(null);
      }
      await saveMaterial(fd);
      form.reset();
    } catch (err) {
      // إعادة التوجيه من الإجراء تُرمى كخطأ خاص، فتُمرَّر إلى Next ولا تُعرض رسالةً
      if (isRedirect(err)) throw err;
      setError((err as Error).message || "تعذّر الحفظ. أعد المحاولة.");
    } finally {
      // في finally لا في المسار الناجح وحده: لا حال يبقى فيها الزرّ معطّلاً
      setBusy(false);
      setPct(null);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate={false}>
      {children}
      {error && (
        <p className="text-sm mb-2" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn" disabled={busy}>
        {pct != null ? `جارٍ رفع الملف… ${pct}٪` : busy ? "جارٍ الحفظ…" : "إضافة وإشعار المشاركين"}
      </button>
    </form>
  );
}

/** خطأ `redirect()` من إجراء الخادم يُعرَف بموسومه، ولا يُعامَل معاملة الفشل */
function isRedirect(e: unknown): boolean {
  const digest = (e as { digest?: unknown } | null)?.digest;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
}
