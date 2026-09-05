"use client";
import { useState } from "react";
import { Paperclip, Trash2, Upload } from "lucide-react";

export type AttachmentItem = { id: string; name: string; size: number; url: string };

function fmt(n: number) {
  return n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} م.ب` : `${Math.ceil(n / 1024)} ك.ب`;
}

/** قائمة مرفقات مع رفع إلى التخزين (R2) وحذف. */
export default function Attachments({ kind, refId, initial, readOnly, canDelete = true }: { kind: string; refId?: string; initial: AttachmentItem[]; readOnly?: boolean; canDelete?: boolean }) {
  const [items, setItems] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
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
      setItems((s) => [...s, data]);
    } catch (e) {
      setError((e as Error).message);
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
              <Paperclip size={14} className="shrink-0 text-muted" />
              <a href={it.url} target="_blank" rel="noopener" className="hover:underline truncate flex-1">{it.name}</a>
              <span className="text-xs text-muted">{fmt(it.size)}</span>
              {!readOnly && canDelete && (
                <button type="button" onClick={() => remove(it)} className="btn btn-ghost btn-sm" aria-label="حذف"><Trash2 size={14} /></button>
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
