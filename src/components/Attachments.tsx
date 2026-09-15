"use client";
import { useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Download, FileText, ImageIcon, Paperclip, Trash2, Upload } from "lucide-react";

export type AttachmentItem = { id: string; name: string; size: number; url: string; contentType: string };

function fmt(n: number) {
  return n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} م.ب` : `${Math.ceil(n / 1024)} ك.ب`;
}

/** ما يُعرض داخل المنصة: PDF وصور. ما عداه يُنزَّل ليفتحه تطبيق الجهاز */
const viewable = (t: string) => t === "application/pdf" || t.startsWith("image/");

/** قائمة مرفقات مع رفع إلى التخزين (R2) وحذف. */
export default function Attachments({ kind, refId, initial, readOnly, canDelete = true }: { kind: string; refId?: string; initial: AttachmentItem[]; readOnly?: boolean; canDelete?: boolean }) {
  const [items, setItems] = useState(initial);
  // وجهة الرجوع من العارض: مسار الصفحة التي فُتح منها الملف
  const here = usePathname();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * القائمة تتبع السجل المعروض لا أوّل سجل رُسم. الانتقال بين سجلّين في الصفحة
   * نفسها — أسابيع جدول البرنامج ومهام المشاركين — تنقّلٌ من طرف العميل، فتبقى
   * هذه الشجرة مركَّبة وتُهمل initial الجديدة لأنها قيمة ابتدائية لا تُقرأ إلا
   * عند التركيب: فكانت صورة بطاقة أسبوعٍ تظهر في كل الأسابيع وإن لم تُنسب إلا
   * إلى صفّ أسبوعها وحده. المعرّف يُقارن في التصيير فتُستأنف الحالة بمرفقات
   * السجل الجديد.
   */
  const record = `${kind}:${refId ?? ""}`;
  const [shown, setShown] = useState(record);
  const live = useRef(record);
  if (shown !== record) {
    setShown(record);
    live.current = record;
    setItems(initial);
    setError(null);
  }

  async function upload(file: File) {
    const at = record;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", kind);
      if (refId) fd.append("refId", refId);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = (await res.json()) as AttachmentItem & { error?: string };
      if (!res.ok) throw new Error(data.error || "تعذّر الرفع");
      // الملف رُفع إلى سجلّه، فلا يُضاف إلى قائمة سجلٍّ انتُقل إليه أثناء رفعه
      if (live.current === at) setItems((s) => [...s, data]);
    } catch (e) {
      if (live.current === at) setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(it: AttachmentItem) {
    if (!confirm(`حذف «${it.name}»؟`)) return;
    const res = await fetch(it.url, { method: "DELETE" });
    if (res.ok) setItems((s) => s.filter((x) => x.id !== it.id));
  }

  return (
    <div className="text-sm">
      {items.length > 0 && (
        <ul className="divide-y divide-line mb-2">
          {items.map((it) => (
            <li key={it.id} className="py-1.5 flex items-center gap-2">
              {it.contentType === "application/pdf" ? (
                <FileText size={14} className="shrink-0 text-muted" />
              ) : it.contentType.startsWith("image/") ? (
                <ImageIcon size={14} className="shrink-0 text-muted" />
              ) : (
                <Paperclip size={14} className="shrink-0 text-muted" />
              )}
              {viewable(it.contentType) ? (
                /* داخل المنصة لا خارجها: التطبيق مثبَّت، و‎_blank يقذف المشارك إلى عارض النظام */
                <a href={`/file/${it.id}?from=${encodeURIComponent(here)}`} className="hover:underline truncate flex-1">{it.name}</a>
              ) : (
                <a href={`${it.url}?download=1`} className="hover:underline truncate flex-1">{it.name}</a>
              )}
              <span className="text-xs text-muted whitespace-nowrap">{fmt(it.size)}</span>
              <a href={`${it.url}?download=1`} className="btn btn-ghost btn-sm shrink-0" aria-label={`تنزيل ${it.name}`}>
                <Download size={14} />
              </a>
              {!readOnly && canDelete && (
                <button type="button" onClick={() => remove(it)} className="btn btn-ghost btn-sm shrink-0" aria-label="حذف"><Trash2 size={14} /></button>
              )}
            </li>
          ))}
        </ul>
      )}
      {!readOnly && (
        <label className={`btn btn-secondary btn-sm cursor-pointer ${busy ? "opacity-50" : ""}`}>
          <Upload size={14} /> {busy ? "جارٍ الرفع…" : "إرفاق ملف"}
          <input type="file" className="hidden" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} accept=".pdf,.jpg,.jpeg,.png,.webp,.mp3,.m4a,.mp4,.doc,.docx,.pptx,.xlsx,.txt" />
        </label>
      )}
      {items.length === 0 && readOnly && <span className="text-muted text-xs">لا مرفقات.</span>}
      {error && <div className="text-xs mt-1" role="alert">{error}</div>}
      <p className="text-xs text-muted mt-1">{!readOnly && "الحد الأقصى 25 ميغابايت للملف: مستندات، صور، صوت، فيديو."}</p>
    </div>
  );
}
