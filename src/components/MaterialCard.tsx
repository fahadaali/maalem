import type { ReactNode } from "react";
import Link from "@/components/Link";
import { BookOpen, Download, ExternalLink, Eye, FileText, LibraryBig, Link2 } from "lucide-react";
import { Badge } from "@/components/ui";
import Attachments, { type AttachmentItem } from "@/components/Attachments";
import PdfCover from "@/components/PdfCover";
import { MATERIAL_KIND_LABELS, hostOf } from "@/lib/utils";

export type MaterialView = {
  id: string; title: string; kind: string; author: string | null; description: string | null;
  url: string | null; competency: string | null; week: number | null; folderId: string | null;
};

/** أيقونة النوع على وجه البطاقة حين لا غلاف لها */
const KIND_ICON: Record<string, typeof BookOpen> = {
  BOOK: BookOpen,
  TEMPLATE: FileText,
  GUIDE: LibraryBig,
  LINK: Link2,
};

const viewable = (t: string) => t === "application/pdf" || t.startsWith("image/");

/**
 * بطاقة مادة في المكتبة — واحدةٌ يراها المشارك ومدير المشروع معاً.
 *
 * كانت المكتبة قائمةً بعرض الصفحة، بندٌ تحت بند، فلا يُميَّز كتابٌ من قالب إلا
 * بالقراءة. والبطاقة تُري وجه الملف نفسه: أول صفحةٍ من الـPDF أو الصورة المرفقة،
 * فتُقرأ المكتبة بالنظرة كما يُقرأ رفّ كتب.
 *
 * و`admin` شريطٌ مختصر يُمرَّر من لوحة المدير — ترتيبٌ ونقلٌ وتعديلٌ وحذف — يقع
 * في ذيل البطاقة، فلا يفترق ما يراه عمّا يراه المشارك إلا بسطرٍ من الأدوات.
 */
export default function MaterialCard({
  m, files, color, admin, readOnly,
}: {
  m: MaterialView;
  files: AttachmentItem[];
  /** لون مجلدها — يُلوَّن به وجه البطاقة حين لا غلاف */
  color?: string;
  admin?: ReactNode;
  readOnly?: boolean;
}) {
  // الملف الأول مما يُعرض داخل المنصة هو وجه البطاقة وزرّها الأول
  const primary = files.find((f) => viewable(f.contentType));
  const image = primary?.contentType.startsWith("image/") ? primary : undefined;
  const pdf = primary?.contentType === "application/pdf" ? primary : undefined;
  const Icon = KIND_ICON[m.kind] ?? BookOpen;
  const tint = color ?? "var(--line-2)";

  return (
    <article className="card p-0 overflow-hidden flex flex-col">
      <div className="relative w-full bg-paper-2" style={{ aspectRatio: "3 / 4" }}>
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image.url} alt={m.title} className="absolute inset-0 w-full h-full object-cover object-top" />
        ) : pdf ? (
          <PdfCover id={pdf.id} url={pdf.url} alt={m.title} />
        ) : null}
        {!image && !pdf && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center" style={{ background: `color-mix(in srgb, ${tint} 12%, var(--paper-2))` }}>
            <Icon size={28} strokeWidth={1.5} style={{ color: tint }} aria-hidden />
            <span className="text-sm font-medium line-clamp-3">{m.title}</span>
          </div>
        )}
        <span className="absolute top-2 start-2 badge badge-soft">{MATERIAL_KIND_LABELS[m.kind]}</span>
      </div>

      <div className="p-3 flex flex-col gap-1 flex-1 min-w-0">
        <h3 className="font-medium leading-snug line-clamp-2">{m.title}</h3>
        {m.author && <div className="text-xs text-muted truncate">{m.author}</div>}
        {(m.competency || m.week != null) && (
          <div className="flex flex-wrap gap-1 mt-0.5">
            {m.competency && <Badge tone="soft">{m.competency}</Badge>}
            {m.week != null && <Badge>الأسبوع {m.week}</Badge>}
          </div>
        )}
        {m.description && <p className="text-sm text-muted line-clamp-2 mt-0.5">{m.description}</p>}

        <div className="flex flex-wrap items-center gap-2 mt-auto pt-2">
          {primary && (
            <Link href={`/file/${primary.id}?from=${encodeURIComponent(readOnly ? "/app/materials" : "/admin/materials")}`} className="btn btn-sm btn-secondary">
              <Eye size={14} /> عرض
            </Link>
          )}
          {primary && (
            <a href={`${primary.url}?download=1`} className="btn btn-ghost btn-sm" aria-label={`تنزيل ${primary.name}`}>
              <Download size={14} />
            </a>
          )}
          {m.url && (
            /* يغادر إلى المتصفح الافتراضي: التطبيق مثبَّت standalone فالرابط الخارج عن نطاقه يخرج منه */
            <a href={m.url} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-ghost" title={hostOf(m.url)}>
              <ExternalLink size={14} /> الرابط
            </a>
          )}
        </div>

        {/* بقية الملفات — والرفع لمدير المشروع — في مطواة، فلا تُثقل وجه البطاقة */}
        {(files.length > (primary ? 1 : 0) || !readOnly) && (
          <details className="mt-2 text-sm">
            <summary className="cursor-pointer text-muted text-xs">ملفات المادة ({files.length})</summary>
            <div className="mt-2">
              <Attachments kind="MATERIAL" refId={m.id} initial={files} readOnly={readOnly} viewButton />
            </div>
          </details>
        )}
      </div>

      {admin && <div className="border-t border-line bg-paper-2/60 px-2 py-1.5">{admin}</div>}
    </article>
  );
}
