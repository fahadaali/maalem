import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { ChevronLeft, FolderPlus } from "lucide-react";
import Link from "@/components/Link";
import { PageHeader, Card, Empty } from "@/components/ui";
import FolderTile from "@/components/FolderTile";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import MaterialCard from "@/components/MaterialCard";
import { createFolder } from "../actions";
import { getBooks, getCompetencies } from "@/lib/content";
import { getActiveWeeks } from "@/lib/weeks";
import { toItem } from "@/lib/attachments";
import { FOLDER_COLORS, folderHex } from "@/lib/folders";
import AddMaterialForm from "./AddMaterialForm";
import MaterialFields from "./MaterialFields";
import LibraryBoard, { Selectable, type FolderRow, type MaterialRow } from "./LibraryBoard";

export const metadata = { title: "مكتبة المواد" };

const viewable = (t: string) => t === "application/pdf" || t.startsWith("image/");

export default async function AdminMaterialsPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string; folder?: string }> }) {
  await requireRole("ADMIN");
  const [books, competencies] = await Promise.all([getBooks(), getCompetencies()]);
  const { ok, err, folder } = await searchParams;
  const [materials, files, weeks, folders] = await Promise.all([
    db.material.findMany({ orderBy: [{ order: "asc" }, { createdAt: "asc" }] }),
    db.attachment.findMany({ where: { kind: "MATERIAL" }, orderBy: { createdAt: "asc" } }),
    getActiveWeeks(),
    db.materialFolder.findMany({ orderBy: [{ order: "asc" }, { createdAt: "asc" }] }),
  ]);
  const filesOf = (id: string) => files.filter((f) => f.refId === id).map(toItem);

  /**
   * المجلد وعاءٌ يُفتح، لا عنواناً فوق مواده. فالجذر مجلداتٌ مغلقةٌ وما لا مجلد
   * له، وداخل المجلد مواده وحدها. ومجلدٌ ذهب من الرابط يُردّ إلى الجذر بلا خطأ.
   */
  const open = folders.find((f) => f.id === folder) ?? null;
  const shown = materials.filter((m) => (open ? m.folderId === open.id : !m.folderId || !folders.some((f) => f.id === m.folderId)));
  const here = open ? `/admin/materials?folder=${open.id}` : "/admin/materials";

  const rows: MaterialRow[] = shown.map((m, i) => ({
    id: m.id, title: m.title, kind: m.kind, folderId: m.folderId,
    author: m.author, description: m.description, url: m.url,
    competency: m.competency, week: m.week, order: m.order,
    // موضعها في المعروض: الطرفان يُعطَّل عندهما زرّ الترتيب
    canUp: i > 0, canDown: i < shown.length - 1,
    fileId: filesOf(m.id).find((f) => viewable(f.contentType))?.id ?? null,
  }));
  const folderRows: FolderRow[] = folders.map((f, i) => ({
    id: f.id, name: f.name, color: f.color, note: f.note,
    count: materials.filter((m) => m.folderId === f.id).length,
    canUp: i > 0, canDown: i < folders.length - 1,
  }));

  return (
    <>
      <PageHeader
        title={open ? open.name : "مكتبة المواد"}
        subtitle={open
          ? (open.note || "مواد هذا المجلد. حدّد مادة ليظهر شريط أدواتها في الأعلى.")
          : "الكتب الأربعة والقوالب والأدلة في مكان واحد يصل إليه المشاركون. ارفع الملف أو ضع رابطه، ونظّمها في مجلدات."}
      />
      <FormMessage ok={ok} err={err} />
      <div className="grid md:grid-cols-[1fr_360px] gap-4 items-start">
        <LibraryBoard materials={rows} folders={folderRows} competencies={competencies} weeks={weeks} here={here}>
          {open && (
            <Link href="/admin/materials" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink scroll-mt-14">
              <ChevronLeft size={15} className="rotate-180" /> كل المواد
            </Link>
          )}

          {!open && folders.length > 0 && (
            <section>
              <h2 className="text-sm text-muted mb-2">المجلدات</h2>
              {/* نقرةٌ تُحدِّد ونقرتان تفتحان، ولمن أراد التصريح زرُّ «فتح» في الشريط */}
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2">
                {folderRows.map((f) => (
                  <Selectable key={f.id} type="folder" id={f.id} href={`/admin/materials?folder=${f.id}`} className="h-full">
                    <FolderTile name={f.name} color={folderHex(f.color)} count={f.count} note={f.note} />
                  </Selectable>
                ))}
              </div>
            </section>
          )}

          <section>
            {!open && folders.length > 0 && (
              <div className="flex items-baseline gap-2 mb-2">
                <h2 className="text-sm text-muted">بلا مجلد</h2>
                <span className="text-xs text-muted">{shown.length} مادة</span>
              </div>
            )}
            {shown.length === 0 ? (
              <Empty>
                {open
                  ? "لا مواد في هذا المجلد بعد. حدّد مادة من «كل المواد» ثم انقلها إليه من الشريط."
                  : materials.length === 0 && folders.length === 0
                    ? "لا مواد بعد. ابدأ بكتب «نقرأ لنربي» الأربعة وقوالب التقرير وبطاقة القراءة."
                    : "كل المواد داخل مجلداتها."}
              </Empty>
            ) : (
              /* ما يراه المشارك بعينه: الأدوات في شريط الأعلى لا في البطاقة */
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {shown.map((m) => (
                  <Selectable key={m.id} type="material" id={m.id} className="h-full">
                    <MaterialCard m={m} files={filesOf(m.id)} color={open ? folderHex(open.color) : undefined} />
                  </Selectable>
                ))}
              </div>
            )}
          </section>
        </LibraryBoard>

        <div className="space-y-4">
          <Card title="إضافة مادة">
            {/* نموذج عميل: يرفع الملف على مسار الرفع ثم يستدعي الإجراء بالنص وحده */}
            <AddMaterialForm>
              <MaterialFields competencies={competencies} weeks={weeks} withFile folders={folders} />
            </AddMaterialForm>
            <div className="border-t border-line mt-4 pt-3 text-xs text-muted">
              <div className="font-medium text-ink-2 mb-1">كتب البرنامج المقررة</div>
              <ul className="list-disc ps-4 space-y-0.5">
                {books.filter((b) => b.pages > 0).map((b) => (
                  <li key={b.order}>{b.title} — {b.author} ({b.availability})</li>
                ))}
              </ul>
            </div>
          </Card>

          <Card title="مجلد جديد">
            <p className="text-xs text-muted mb-3">
              المجلدات تنظيمٌ للمكتبة كما يراها المشاركون. والمادة بلا مجلد تبقى ظاهرة لهم تحت «بلا مجلد»، فلا يلزم أن تُصنَّف كل مادة.
            </p>
            <form action={createFolder}>
              <div className="field">
                <label className="label">الاسم</label>
                <input name="name" className="input" required maxLength={60} placeholder="قوالب التقارير" />
              </div>
              <div className="field">
                <label className="label">اللون</label>
                <select name="color" className="select" defaultValue="gray">
                  {Object.entries(FOLDER_COLORS).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label className="label">وصف يظهر تحت اسم المجلد (اختياري)</label>
                <input name="note" className="input" maxLength={160} />
              </div>
              <SubmitButton className="btn-sm" pendingText="جارٍ الإنشاء…"><FolderPlus size={14} /> إنشاء المجلد</SubmitButton>
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}

