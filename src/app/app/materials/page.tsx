import { requireParticipantView } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Empty } from "@/components/ui";
import MaterialCard, { type MaterialView } from "@/components/MaterialCard";
import { READING_NOTE } from "@/lib/program";
import { MATERIAL_KIND_LABELS } from "@/lib/utils";
import { toItem } from "@/lib/attachments";
import { folderHex, groupByFolder, type FolderView } from "@/lib/folders";

export const metadata = { title: "مكتبة المواد" };

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
  const sections: { key: string; title: string; note?: string | null; color?: string; items: MaterialView[] }[] = folders.length
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
                className={s.color ? "border-s-2 ps-3" : undefined}
                style={s.color ? { borderInlineStartColor: s.color } : undefined}
              >
                {/* شبكةٌ لا قائمة: وجه كل مادة يُرى، فتُقرأ المكتبة بالنظرة */}
                <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {s.items.map((m) => (
                    <MaterialCard key={m.id} m={m} files={filesOf(m.id)} color={s.color} readOnly />
                  ))}
                </div>
              </div>
            </section>
          ))}
        </div>
      )}
      <p className="text-sm text-muted mt-6">{READING_NOTE}</p>
    </>
  );
}
