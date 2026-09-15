import { requireParticipantView } from "@/lib/auth";
import { db } from "@/lib/db";
import { ExternalLink } from "lucide-react";
import { PageHeader, Card, Badge, Empty } from "@/components/ui";
import Attachments from "@/components/Attachments";
import { READING_NOTE } from "@/lib/program";
import { MATERIAL_KIND_LABELS, hostOf } from "@/lib/utils";
import { toItem } from "@/lib/attachments";
import { folderHex, groupByFolder, type FolderView } from "@/lib/folders";
import type { AttachmentItem } from "@/components/Attachments";

export const metadata = { title: "مكتبة المواد" };

type Item = {
  id: string; title: string; kind: string; author: string | null; description: string | null;
  url: string | null; competency: string | null; week: number | null; folderId: string | null;
};

export default async function MaterialsPage() {
  await requireParticipantView();
  const [materials, files, folders] = await Promise.all([
    db.material.findMany({ orderBy: [{ order: "asc" }, { createdAt: "asc" }] }),
    db.attachment.findMany({ where: { kind: "MATERIAL" }, orderBy: { createdAt: "asc" } }),
    db.materialFolder.findMany({ orderBy: [{ order: "asc" }, { createdAt: "asc" }] }),
  ]);
  const filesOf = (id: string) => files.filter((x) => x.refId === id).map(toItem);
  /**
   * التنظيم كما وضعه مدير المشروع: مجلداته أولاً، ثم ما لا مجلد له. وإن لم يُنشئ
   * مجلداً بعد فالتصنيف بالنوع كما كان، فلا تتغيّر الصفحة على من لم يطلب تغييرها.
   */
  const sections: { key: string; title: string; note?: string | null; color?: string; items: Item[] }[] = folders.length
    ? groupByFolder(folders as FolderView[], materials).map((g) => ({
        key: g.folder?.id ?? "loose",
        title: g.folder?.name ?? "بلا مجلد",
        note: g.folder?.note,
        color: g.folder ? folderHex(g.folder.color) : undefined,
        items: g.items,
      }))
    : ["BOOK", "TEMPLATE", "GUIDE", "LINK"]
        .filter((k) => materials.some((m) => m.kind === k))
        .map((k) => ({ key: k, title: MATERIAL_KIND_LABELS[k], items: materials.filter((m) => m.kind === k) }));

  return (
    <>
      <PageHeader title="مكتبة المواد" subtitle="كتب البرنامج وقوالبه وأدلته. حمّلها أو افتح رابطها." />
      {materials.length === 0 ? (
        <Empty>لم تُضف مواد بعد. سيضعها مدير المشروع هنا.</Empty>
      ) : (
        <div className="space-y-6">
          {sections.map((s) => (
            <section key={s.key}>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {s.color && <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} aria-hidden />}
                <h2 className="text-lg">{s.title}</h2>
                <span className="text-xs text-muted">{s.items.length} مادة</span>
              </div>
              {s.note && <p className="text-xs text-muted mb-2">{s.note}</p>}
              <div
                className={s.color ? "space-y-2 border-s-2 ps-3" : "space-y-2"}
                style={s.color ? { borderInlineStartColor: s.color } : undefined}
              >
                {s.items.map((m) => (
                  <MaterialCard key={m.id} m={m} files={filesOf(m.id)} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      <p className="text-sm text-muted mt-6">{READING_NOTE}</p>
    </>
  );
}

function MaterialCard({ m, files }: { m: Item; files: AttachmentItem[] }) {
  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="font-medium">{m.title}</div>
        <div className="flex gap-1">
          <Badge tone="soft">{MATERIAL_KIND_LABELS[m.kind]}</Badge>
          {m.competency && <Badge tone="soft">{m.competency}</Badge>}
          {m.week != null && <Badge>الأسبوع {m.week}</Badge>}
        </div>
      </div>
      {m.author && <div className="text-xs text-muted">{m.author}</div>}
      {m.description && <p className="text-sm text-muted mt-1">{m.description}</p>}
      {m.url && (
        <div className="flex flex-wrap items-center gap-2 mt-2">
          {/* يغادر إلى المتصفح الافتراضي: التطبيق مثبَّت standalone فالرابط الخارج عن نطاقه يخرج منه */}
          <a href={m.url} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-secondary">
            <ExternalLink size={14} /> فتح الرابط
          </a>
          <span className="text-xs text-muted truncate" dir="ltr">{hostOf(m.url)}</span>
        </div>
      )}
      {files.length > 0 && (
        <div className="mt-2">
          <Attachments kind="MATERIAL" refId={m.id} initial={files} readOnly viewButton />
        </div>
      )}
    </Card>
  );
}
