import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { ChevronDown, ChevronUp, ExternalLink, FolderPlus } from "lucide-react";
import { PageHeader, Card, Badge, Empty } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import Attachments from "@/components/Attachments";
import { createFolder, deleteFolder, deleteMaterial, moveFolder, moveMaterial, moveMaterialOrder, saveFolder, saveMaterial } from "../actions";
import { getBooks, getCompetencies } from "@/lib/content";
import { getActiveWeeks } from "@/lib/weeks";
import { MATERIAL_KIND_LABELS, hostOf } from "@/lib/utils";
import { toItem } from "@/lib/attachments";
import { FILE_ACCEPT, MAX_FILE_BYTES, fileSize } from "@/lib/files";
import { FOLDER_COLORS, folderHex, groupByFolder, type FolderView } from "@/lib/folders";
import AddMaterialForm from "./AddMaterialForm";

export const metadata = { title: "مكتبة المواد" };

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

  return (
    <>
      <PageHeader
        title="مكتبة المواد"
        subtitle="الكتب الأربعة والقوالب والأدلة في مكان واحد يصل إليه المشاركون. ارفع الملف أو ضع رابطه، ونظّمها في مجلدات."
      />
      <FormMessage ok={ok} err={err} />
      <div className="grid md:grid-cols-[1fr_360px] gap-4 items-start">
        <div className="space-y-6">
          {materials.length === 0 && folders.length === 0 ? (
            <Empty>لا مواد بعد. ابدأ بكتب «نقرأ لنربي» الأربعة وقوالب التقرير وبطاقة القراءة.</Empty>
          ) : (
            groups.map((g, gi) => (
              <section key={g.folder?.id ?? "loose"}>
                <FolderHeading folder={g.folder} count={g.items.length} first={gi === 0} last={gi === folders.length - 1} />
                {g.items.length === 0 ? (
                  <p className="text-sm text-muted ps-3">لا مواد في هذا المجلد بعد. انقل إليه مادة من قائمة «المجلد» في بطاقتها.</p>
                ) : (
                  <div
                    className="space-y-3 border-s-2 ps-3"
                    style={{ borderInlineStartColor: g.folder ? folderHex(g.folder.color) : "var(--line)" }}
                  >
                    {g.items.map((m, i) => (
                      <Card key={m.id}>
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-medium">{m.title}</div>
                            <div className="text-xs text-muted">
                              {MATERIAL_KIND_LABELS[m.kind]}
                              {m.author ? ` · ${m.author}` : ""}
                              {m.competency ? ` · ${m.competency}` : ""}
                              {m.week != null ? ` · الأسبوع ${m.week}` : ""}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {/* الترتيب داخل المجموعة: مبادلةٌ مع الجار، فلا يحتاج سحباً ولا جافاسكربت */}
                            <MoveButton action={moveMaterialOrder} id={m.id} dir="up" disabled={i === 0} label="تقديم" />
                            <MoveButton action={moveMaterialOrder} id={m.id} dir="down" disabled={i === g.items.length - 1} label="تأخير" />
                            <Badge tone="soft">{MATERIAL_KIND_LABELS[m.kind]}</Badge>
                          </div>
                        </div>
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
                        <div className="mt-2">
                          <Attachments kind="MATERIAL" refId={m.id} initial={filesOf(m.id)} viewButton />
                        </div>
                        <form action={moveMaterial} className="flex items-end gap-2 mt-3 pt-3 border-t border-line">
                          <input type="hidden" name="id" value={m.id} />
                          <div className="field mb-0 flex-1 min-w-0">
                            <label className="label">المجلد</label>
                            <FolderSelect folders={folders} value={m.folderId} />
                          </div>
                          <SubmitButton secondary className="btn-sm" pendingText="جارٍ النقل…">نقل</SubmitButton>
                        </form>
                        <details className="mt-3 text-sm">
                          <summary className="cursor-pointer text-muted">تعديل</summary>
                          <form action={saveMaterial} className="mt-2">
                            <input type="hidden" name="id" value={m.id} />
                            <input type="hidden" name="folderId" value={m.folderId ?? ""} />
                            <MaterialFields competencies={competencies} material={m} weeks={weeks} />
                            <SubmitButton secondary className="btn-sm">حفظ</SubmitButton>
                          </form>
                          <form action={deleteMaterial} className="mt-2">
                            <input type="hidden" name="id" value={m.id} />
                            <SubmitButton ghost className="btn-sm text-muted" pendingText="جارٍ الحذف…" confirm={`حذف «${m.title}» وملفاتها؟ لا رجعة في هذا.`}>
                              حذف المادة وملفاتها
                            </SubmitButton>
                          </form>
                        </details>
                      </Card>
                    ))}
                  </div>
                )}
              </section>
            ))
          )}
        </div>

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
                <ColorSelect />
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

/** ترويسة المجموعة: اسم المجلد ولونه وعدده وأدوات تنظيمه، أو «بلا مجلد» بلا أدوات */
function FolderHeading({ folder, count, first, last }: { folder: FolderView | null; count: number; first: boolean; last: boolean }) {
  if (!folder) {
    return (
      <div className="flex items-baseline gap-2 mb-2">
        <h2 className="text-lg">بلا مجلد</h2>
        <span className="text-xs text-muted">{count} مادة</span>
      </div>
    );
  }
  return (
    <div className="mb-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ background: folderHex(folder.color) }} aria-hidden />
        <h2 className="text-lg">{folder.name}</h2>
        <span className="text-xs text-muted">{count} مادة</span>
        <div className="flex items-center gap-1 ms-auto">
          <MoveButton action={moveFolder} id={folder.id} dir="up" disabled={first} label="رفع المجلد" />
          <MoveButton action={moveFolder} id={folder.id} dir="down" disabled={last} label="خفض المجلد" />
        </div>
      </div>
      {folder.note && <p className="text-xs text-muted mt-0.5">{folder.note}</p>}
      <details className="text-sm mt-1">
        <summary className="cursor-pointer text-muted text-xs">تنظيم المجلد</summary>
        <form action={saveFolder} className="mt-2 grid sm:grid-cols-[1fr_auto] gap-2 items-end">
          <input type="hidden" name="id" value={folder.id} />
          <div className="grid sm:grid-cols-3 gap-2">
            <div className="field mb-0"><label className="label">الاسم</label><input name="name" className="input" defaultValue={folder.name} required maxLength={60} /></div>
            <div className="field mb-0"><label className="label">اللون</label><ColorSelect value={folder.color} /></div>
            <div className="field mb-0"><label className="label">الوصف</label><input name="note" className="input" defaultValue={folder.note ?? ""} maxLength={160} /></div>
          </div>
          <SubmitButton secondary className="btn-sm">حفظ</SubmitButton>
        </form>
        <form action={deleteFolder} className="mt-2">
          <input type="hidden" name="id" value={folder.id} />
          <SubmitButton ghost className="btn-sm text-muted" pendingText="جارٍ الحذف…" confirm={`حذف مجلد «${folder.name}»؟\n\nمواده لا تُحذف — تعود إلى «بلا مجلد».`}>
            حذف المجلد
          </SubmitButton>
        </form>
      </details>
    </div>
  );
}

/** زرّ تحريكٍ في نموذجه: الأطراف معطَّلة فلا يُرسَل طلبٌ لا أثر له */
function MoveButton({ action, id, dir, disabled, label }: { action: (f: FormData) => void; id: string; dir: "up" | "down"; disabled: boolean; label: string }) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="dir" value={dir} />
      <button type="submit" disabled={disabled} className="btn btn-ghost btn-sm px-1.5 disabled:opacity-30" aria-label={label} title={label}>
        {dir === "up" ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
    </form>
  );
}

function ColorSelect({ value }: { value?: string }) {
  return (
    <select name="color" className="select" defaultValue={value ?? "gray"}>
      {Object.entries(FOLDER_COLORS).map(([k, v]) => (
        <option key={k} value={k}>{v.label}</option>
      ))}
    </select>
  );
}

function FolderSelect({ folders, value }: { folders: FolderView[]; value?: string | null }) {
  return (
    <select name="folderId" className="select" defaultValue={value ?? ""}>
      <option value="">بلا مجلد</option>
      {folders.map((f) => (
        <option key={f.id} value={f.id}>{f.name}</option>
      ))}
    </select>
  );
}

type M = { title: string; kind: string; author: string | null; description: string | null; url: string | null; competency: string | null; week: number | null; order: number };

/** `withFile` لنموذج الإضافة وحده: المادة المحفوظة لها أداة رفع مستقلة في بطاقتها */
function MaterialFields({ material, weeks, competencies, withFile, folders }: { material?: M; weeks: { number: number; label: string }[]; competencies: { slug: string; name: string }[]; withFile?: boolean; folders?: FolderView[] }) {
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
          <input
            type="file"
            name="file"
            className="input"
            accept={FILE_ACCEPT}
          />
          <p className="text-xs text-muted mt-1">PDF أو مستند أو صورة أو صوت أو فيديو، حتى {fileSize(MAX_FILE_BYTES)}. يمكنك رفع ملفات أخرى للمادة بعد إضافتها.</p>
        </div>
      )}
    </>
  );
}
