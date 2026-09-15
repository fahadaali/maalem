"use client";
import { useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Download, FileText, ImageIcon, Paperclip, Trash2, Upload } from "lucide-react";
import { FILE_ACCEPT, MAX_FILE_BYTES, checkFile, fileSize } from "@/lib/files";
import { uploadFile } from "@/lib/upload-client";

export type AttachmentItem = { id: string; name: string; size: number; url: string; contentType: string };

/** ما يُعرض داخل المنصة: PDF وصور. ما عداه يُنزَّل ليفتحه تطبيق الجهاز */
const viewable = (t: string) => t === "application/pdf" || t.startsWith("image/");

/** قائمة مرفقات مع رفع إلى التخزين (R2) وحذف. */
export default function Attachments({ kind, refId, initial, readOnly, canDelete = true }: { kind: string; refId?: string; initial: AttachmentItem[]; readOnly?: boolean; canDelete?: boolean }) {
  const [items, setItems] = useState(initial);
  // وجهة الرجوع من العارض: مسار الصفحة التي فُتح منها الملف
  const here = usePathname();
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);
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
    // فحصٌ قبل الرفع: الملف المرفوض يُردّ في الحال بدل أن يُرفع كاملاً ثم يُردّ
    const bad = checkFile(file);
    if (bad) return setError(bad);
    const at = record;
    setBusy(true);
    setError(null);
    setPct(0);
    try {
      // النسبة أيضاً للسجل الذي بدأ رفعه وحده، فلا تظهر على سجلٍّ انتُقل إليه
      const item = await uploadFile(file, kind, refId, (p) => {
        if (live.current === at) setPct(p);
      });
      // الملف رُفع إلى سجلّه، فلا يُضاف إلى قائمة سجلٍّ انتُقل إليه أثناء رفعه
      if (live.current === at) setItems((s) => [...s, item]);
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
              <span className="text-xs text-muted whitespace-nowrap">{fileSize(it.size)}</span>
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
          <Upload size={14} /> {busy ? `جارٍ الرفع… ${pct}٪` : "إرفاق ملف"}
          <input type="file" className="hidden" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} accept={FILE_ACCEPT} />
        </label>
      )}
      {items.length === 0 && readOnly && <span className="text-muted text-xs">لا مرفقات.</span>}
      {error && <div className="text-xs mt-1" role="alert">{error}</div>}
      <p className="text-xs text-muted mt-1">{!readOnly && `الحد الأقصى ${fileSize(MAX_FILE_BYTES)} للملف: مستندات، صور، صوت، فيديو.`}</p>
    </div>
  );
}
