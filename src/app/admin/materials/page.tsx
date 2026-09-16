import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { FolderPlus } from "lucide-react";
import { PageHeader, Card, Empty } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import MaterialCard from "@/components/MaterialCard";
import { createFolder } from "../actions";
import { getBooks, getCompetencies } from "@/lib/content";
import { getActiveWeeks } from "@/lib/weeks";
import { toItem } from "@/lib/attachments";
import { FOLDER_COLORS, folderHex, groupByFolder, type FolderView } from "@/lib/folders";
import AddMaterialForm from "./AddMaterialForm";
import MaterialFields from "./MaterialFields";
import LibraryBoard, { Selectable, type FolderRow, type MaterialRow } from "./LibraryBoard";

export const metadata = { title: "مكتبة المواد" };

const viewable = (t: string) => t === "application/pdf" || t.startsWith("image/");

export default async function AdminMaterialsPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireRole("ADMIN");
  const [books, competencies] = await Promise.all([getBooks(), getCompetencies()]);
  const { ok, err } = await searchParams;
  const [materials, files, weeks, folders] = await Promise.all([
    db.material.findMany({ orderBy: [{ order: "asc" }, { createdAt: "asc" }] }),
    db.attachment.findMany({ where: { kind: "MATERIAL" }, orderBy: { createdAt: "asc" } }),
    getActiveWeeks(),
    db.materialFolder.findMany({ orderBy: [{ order: "asc" }, { createdAt: "asc" }] }),
  ]);
  const filesOf = (id: string) => files.filter((f) => f.refId === id).map(toItem);
  // المجلد الفارغ يبقى ظاهراً للمدير: فيه يضع، وإخفاؤه يُخفي مكان الوضع
  const groups = groupByFolder(folders, materials, { keepEmpty: true });

  /**
   * الشريط يحتاج ما لا يُحسب في المتصفّح: موضعُ المادة في مجموعتها ليُعطَّل زرّ
   * الترتيب عند الطرف، وأولُ ملفٍ لها ليُفتح بزرّ العرض. فيُحسبان هنا مرّة.
   */
  const rows: MaterialRow[] = groups.flatMap((g) =>
    g.items.map((m, i) => ({
      id: m.id, title: m.title, kind: m.kind, folderId: m.folderId,
      author: m.author, description: m.description, url: m.url,
      competency: m.competency, week: m.week, order: m.order,
      canUp: i > 0, canDown: i < g.items.length - 1,
      fileId: filesOf(m.id).find((f) => viewable(f.contentType))?.id ?? null,
    })),
  );
  const folderRows: FolderRow[] = folders.map((f, i) => ({
    id: f.id, name: f.name, color: f.color, note: f.note,
    count: materials.filter((m) => m.folderId === f.id).length,
    canUp: i > 0, canDown: i < folders.length - 1,
  }));

  return (
    <>
      <PageHeader
        title="مكتبة المواد"
        subtitle="الكتب الأربعة والقوالب والأدلة في مكان واحد يصل إليه المشاركون. ارفع الملف أو ضع رابطه، ونظّمها في مجلدات."
      />
      <FormMessage ok={ok} err={err} />
      <div className="grid md:grid-cols-[1fr_360px] gap-4 items-start">
        <LibraryBoard materials={rows} folders={folderRows} competencies={competencies} weeks={weeks}>
          {materials.length === 0 && folders.length === 0 ? (
            <Empty>لا مواد بعد. ابدأ بكتب «نقرأ لنربي» الأربعة وقوالب التقرير وبطاقة القراءة.</Empty>
          ) : (
            <div className="space-y-6">
              {groups.map((g) => (
                <section key={g.folder?.id ?? "loose"}>
                  <FolderHeading folder={g.folder} count={g.items.length} />
                  {g.items.length === 0 ? (
                    <p className="text-sm text-muted ps-3">لا مواد في هذا المجلد بعد. حدّد مادةً من القائمة ثم انقلها إليه من الشريط.</p>
                  ) : (
                    <div
                      className="border-s-2 ps-3"
                      style={{ borderInlineStartColor: g.folder ? folderHex(g.folder.color) : "var(--line)" }}
                    >
                      {/* ما يراه المشارك بعينه: الأدوات في شريط الأعلى لا في البطاقة */}
                      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
                        {g.items.map((m) => (
                          <Selectable key={m.id} type="material" id={m.id} className="h-full">
                            <MaterialCard m={m} files={filesOf(m.id)} color={g.folder ? folderHex(g.folder.color) : undefined} />
                          </Selectable>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              ))}
            </div>
          )}
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

/** ترويسة المجموعة: تُحدَّد كما تُحدَّد البطاقة، و«بلا مجلد» ليس مجلداً فلا يُحدَّد */
function FolderHeading({ folder, count }: { folder: FolderView | null; count: number }) {
  if (!folder) {
    return (
      <div className="flex items-baseline gap-2 mb-2 px-2">
        <h2 className="text-lg">بلا مجلد</h2>
        <span className="text-xs text-muted">{count} مادة</span>
      </div>
    );
  }
  return (
    <Selectable type="folder" id={folder.id} className="mb-2 block">
      <div className="px-2 py-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ background: folderHex(folder.color) }} aria-hidden />
          <h2 className="text-lg">{folder.name}</h2>
          <span className="text-xs text-muted">{count} مادة</span>
        </div>
        {folder.note && <p className="text-xs text-muted mt-0.5">{folder.note}</p>}
      </div>
    </Selectable>
  );
}
