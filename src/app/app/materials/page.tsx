import { requireParticipantView } from "@/lib/auth";
import ResumeReading, { type ResumeItem } from "@/components/ResumeReading";
import { db } from "@/lib/db";
import { ChevronLeft } from "lucide-react";
import Link from "@/components/Link";
import { PageHeader, Empty } from "@/components/ui";
import MaterialCard, { type MaterialView } from "@/components/MaterialCard";
import FolderTile from "@/components/FolderTile";
import { READING_NOTE } from "@/lib/program";
import { MATERIAL_KIND_LABELS } from "@/lib/utils";
import { toItem } from "@/lib/attachments";
import { folderHex } from "@/lib/folders";

export const metadata = { title: "مكتبة المواد" };

export default async function MaterialsPage({ searchParams }: { searchParams: Promise<{ folder?: string }> }) {
  const user = await requireParticipantView();
  const { folder } = await searchParams;
  const [materials, files, folders, progress] = await Promise.all([
    db.material.findMany({ orderBy: [{ order: "asc" }, { createdAt: "asc" }] }),
    db.attachment.findMany({ where: { kind: "MATERIAL" }, orderBy: { createdAt: "asc" } }),
    db.materialFolder.findMany({ orderBy: [{ order: "asc" }, { createdAt: "asc" }] }),
    db.readingProgress.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" }, take: 3 }),
  ]);
  const filesOf = (id: string) => files.filter((x) => x.refId === id).map(toItem);

  /**
   * آخرُ ما قُرئ. أسماءُ الملفات تُلتمس أولاً بين مرفقات المكتبة المجلوبة سلفاً،
   * فلا تُستعلم إلا لما قُرئ خارجها. وما حُذف ملفُه يسقط من العرض بلا خطأ.
   */
  const named = new Map(files.map((f) => [f.id, f.name]));
  const missing = progress.map((p) => p.attachmentId).filter((id) => !named.has(id));
  if (missing.length) {
    for (const a of await db.attachment.findMany({ where: { id: { in: missing } }, select: { id: true, name: true } })) {
      named.set(a.id, a.name);
    }
  }
  const resume: ResumeItem[] = progress.flatMap((p) => {
    const name = named.get(p.attachmentId);
    return name ? [{ id: p.attachmentId, name, page: p.page, pages: p.pages }] : [];
  });

  /**
   * التنظيم كما وضعه مدير المشروع: المجلد وعاءٌ يُفتح لا عنوانٌ فوق مواده، فالصفحة
   * مجلداتٌ مغلقةٌ وما لا مجلد له، وداخل المجلد مواده وحدها. وإن لم يُنشئ مجلداً
   * بعد فالتصنيف بالنوع كما كان، فلا تتغيّر الصفحة على من لم يطلب تغييرها.
   */
  const open = folders.find((f) => f.id === folder) ?? null;
  const counted = folders.map((f) => ({ ...f, count: materials.filter((m) => m.folderId === f.id).length }));
  // المجلد الفارغ يُخفى عن المشارك: فتحُه يقوده إلى فراغ
  const shelves = counted.filter((f) => f.count > 0);
  const loose = materials.filter((m) => !m.folderId || !folders.some((f) => f.id === m.folderId));

  const byKind = ["BOOK", "TEMPLATE", "GUIDE", "LINK"]
    .filter((k) => materials.some((m) => m.kind === k))
    .map((k) => ({ key: k, title: MATERIAL_KIND_LABELS[k], items: materials.filter((m) => m.kind === k) as MaterialView[] }));

  const cards = (items: MaterialView[], color?: string) => (
    /* شبكةٌ لا قائمة: وجه كل مادة يُرى، فتُقرأ المكتبة بالنظرة */
    <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
      {items.map((m) => (
        <MaterialCard key={m.id} m={m} files={filesOf(m.id)} color={color} readOnly />
      ))}
    </div>
  );

  return (
    <>
      <PageHeader
        title={open ? open.name : "مكتبة المواد"}
        subtitle={open ? (open.note || "مواد هذا المجلد.") : "كتب البرنامج وقوالبه وأدلته. حمّلها أو افتح رابطها."}
      />
      {!open && <ResumeReading items={resume} from="/app/materials" />}
      {materials.length === 0 ? (
        <Empty>لم تُضف مواد بعد. سيضعها مدير المشروع هنا.</Empty>
      ) : open ? (
        <div className="space-y-4">
          <Link href="/app/materials" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
            <ChevronLeft size={15} className="rotate-180" /> كل المواد
          </Link>
          {cards(materials.filter((m) => m.folderId === open.id), folderHex(open.color))}
        </div>
      ) : folders.length === 0 ? (
        <div className="space-y-6">
          {byKind.map((s) => (
            <section key={s.key}>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <h2 className="text-lg">{s.title}</h2>
                <span className="text-xs text-muted">{s.items.length} مادة</span>
              </div>
              {cards(s.items)}
            </section>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {shelves.length > 0 && (
            <section>
              <h2 className="text-sm text-muted mb-2">المجلدات</h2>
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2">
                {shelves.map((f) => (
                  <Link key={f.id} href={`/app/materials?folder=${f.id}`} className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-line-2">
                    <FolderTile name={f.name} color={folderHex(f.color)} count={f.count} note={f.note} />
                  </Link>
                ))}
              </div>
            </section>
          )}
          {loose.length > 0 && (
            <section>
              {shelves.length > 0 && (
                <div className="flex items-baseline gap-2 mb-2">
                  <h2 className="text-sm text-muted">بلا مجلد</h2>
                  <span className="text-xs text-muted">{loose.length} مادة</span>
                </div>
              )}
              {cards(loose)}
            </section>
          )}
        </div>
      )}
      <p className="text-sm text-muted mt-6">{READING_NOTE}</p>
    </>
  );
}
