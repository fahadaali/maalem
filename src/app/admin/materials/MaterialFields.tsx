import { MATERIAL_KIND_LABELS } from "@/lib/utils";
import { FILE_ACCEPT, MAX_FILE_BYTES, fileSize } from "@/lib/files";
import type { FolderView } from "@/lib/folders";

/**
 * حقول المادة — نموذج الإضافة في جانب الصفحة، ونموذج التعديل في شريط التحكم.
 *
 * فُصلت عن الصفحة ليستوردها الشريط وهو مكوّن عميل: الاختيار يجري في المتصفّح،
 * فلا يعرف الخادمُ أيَّ مادةٍ حُدِّدت ليُصيّر حقولها. وليس فيها ما يحتاج خادماً
 * — علاماتٌ من خصائصها — فتُصيَّر في الطرفين سواء.
 */
export type MaterialDraft = {
  title: string; kind: string; author: string | null; description: string | null;
  url: string | null; competency: string | null; week: number | null; order: number;
};

export function FolderSelect({ folders, value }: { folders: FolderView[]; value?: string | null }) {
  return (
    <select name="folderId" className="select" defaultValue={value ?? ""}>
      <option value="">بلا مجلد</option>
      {folders.map((f) => (
        <option key={f.id} value={f.id}>{f.name}</option>
      ))}
    </select>
  );
}

/** `withFile` لنموذج الإضافة وحده: المادة المحفوظة لها أداة رفع مستقلة في بطاقتها */
export default function MaterialFields({ material, weeks, competencies, withFile, folders }: {
  material?: MaterialDraft;
  weeks: { number: number; label: string }[];
  competencies: { slug: string; name: string }[];
  withFile?: boolean;
  folders?: FolderView[];
}) {
  return (
    <>
      <div className="field">
        <label className="label">العنوان</label>
        <input name="title" className="input" required defaultValue={material?.title ?? ""} />
      </div>
      {folders && (
        <div className="field">
          <label className="label">المجلد</label>
          <FolderSelect folders={folders} />
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="field">
          <label className="label">النوع</label>
          <select name="kind" className="select" defaultValue={material?.kind ?? "BOOK"}>
            {Object.entries(MATERIAL_KIND_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="label">المؤلف</label>
          <input name="author" className="input" defaultValue={material?.author ?? ""} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="field">
          <label className="label">الكفاءة</label>
          <select name="competency" className="select" defaultValue={material?.competency ?? ""}>
            <option value="">—</option>
            {competencies.map((c) => (
              <option key={c.slug} value={c.name}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="label">الأسبوع</label>
          <select name="week" className="select" defaultValue={material?.week ?? ""}>
            <option value="">—</option>
            {weeks.map((w) => (
              <option key={w.number} value={w.number}>الأسبوع {w.label}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="field">
        <label className="label">الوصف</label>
        <textarea name="description" className="textarea" rows={2} defaultValue={material?.description ?? ""} />
      </div>
      <div className="grid grid-cols-[1fr_90px] gap-3">
        <div className="field">
          <label className="label">رابط خارجي (اختياري)</label>
          <input name="url" className="input" dir="ltr" placeholder="https://" defaultValue={material?.url ?? ""} />
        </div>
        <div className="field">
          <label className="label">الترتيب</label>
          <input type="number" name="order" className="input" defaultValue={material?.order ?? 0} />
        </div>
      </div>
      {withFile && (
        <div className="field">
          <label className="label">ملف المادة (اختياري)</label>
          <input type="file" name="file" className="input" accept={FILE_ACCEPT} />
          <p className="text-xs text-muted mt-1">PDF أو مستند أو صورة أو صوت أو فيديو، حتى {fileSize(MAX_FILE_BYTES)}. يمكنك رفع ملفات أخرى للمادة بعد إضافتها.</p>
        </div>
      )}
    </>
  );
}
