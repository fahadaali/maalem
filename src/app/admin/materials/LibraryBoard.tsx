"use client";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Eye, FolderInput, FolderOpen, Pencil, Trash2, X } from "lucide-react";
import SubmitButton from "@/components/SubmitButton";
import MaterialFields, { FolderSelect } from "./MaterialFields";
import Popover from "./Popover";
import NewMenuProvider, { NewMenuButton } from "./NewMenu";
import { FOLDER_COLORS, folderHex, type FolderView } from "@/lib/folders";
import { MATERIAL_KIND_LABELS } from "@/lib/utils";
import { deleteFolder, deleteMaterial, moveFolder, moveMaterial, moveMaterialOrder, saveFolder, saveMaterial } from "../actions";

/**
 * لوح المكتبة: تحديدٌ ثم شريطٌ واحد، على هيئة أقراص الملفات المعروفة.
 *
 * كانت أدوات المدير شريطاً في ذيل كل بطاقة، فإذا في الشاشة عشرون شريطاً لعشرين
 * مادة — قوائمُ ونماذجُ وأزرارٌ مكرّرة تزحم النظر وتُغرق المحتوى فيما حوله.
 * والأداة لا يُحتاج إليها إلا بعد قصد شيءٍ بعينه، فصار القصدُ تحديداً: تُنقر
 * المادة أو المجلد فيظهر شريطٌ واحد في أعلى الصفحة بأدوات ما حُدِّد وحده.
 *
 * والشريط ثابتٌ في مكانه لا يظهر ويختفي: مكانه محجوز دائماً وفيه إرشادٌ حين لا
 * تحديد، فلا تقفز الصفحة تحت يد المدير في كل نقرة، ويُعرف بابُ الأدوات قبل
 * طلبها.
 */

export type MaterialRow = {
  id: string; title: string; kind: string; folderId: string | null;
  author: string | null; description: string | null; url: string | null;
  competency: string | null; week: number | null; order: number;
  /** موضعها في مجموعتها: الطرفان يُعطَّل عندهما زرّ الترتيب */
  canUp: boolean; canDown: boolean;
  /** أول ملفٍ يُعرض داخل المنصة، إن كان لها ملف */
  fileId: string | null;
};
export type FolderRow = FolderView & { count: number; canUp: boolean; canDown: boolean };

type Selection = { type: "material" | "folder"; id: string } | null;

/**
 * التحديد يُحفظ في الجلسة ليعبر رحلة الإجراء: كل أداةٍ في الشريط إجراءُ خادم
 * يعيد التوجيه إلى الصفحة نفسها، فتُبنى من جديد ويضيع ما في ذاكرة المتصفّح —
 * فيعود المدير إلى مادةٍ بلا تحديد بعد كل ترتيبةٍ أو نقلة. ولا يُستعاد إلا
 * عائداً من إجراء (ok أو err في الرابط)، فزيارةٌ جديدة تبدأ بلا تحديد.
 */
const KEY = "maalem:library-sel";
const readStored = (): Selection => {
  try {
    if (!/[?&](ok|err)=/.test(location.search)) return null;
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Selection;
    return s && (s.type === "material" || s.type === "folder") && typeof s.id === "string" ? s : null;
  } catch {
    // تخزينٌ ممنوع — نافذة خاصة أو إعداد صارم — فلا يُستعاد التحديد ولا يسقط شيء
    return null;
  }
};
const store = (s: Selection) => {
  try {
    if (s) sessionStorage.setItem(KEY, JSON.stringify(s));
    else sessionStorage.removeItem(KEY);
  } catch { /* كما فوق */ }
};

const Ctx = createContext<{ selected: Selection; select: (s: Selection) => void }>({ selected: null, select: () => {} });

/**
 * غلافُ عنصرٍ قابل للتحديد. والنقرُ على أداةٍ داخله — رابطٌ أو زرٌّ أو مطواة —
 * لا يُحدِّد: المدير قصد الأداة لا العنصر، ولو حُدِّد لانتقل الشريط تحت يده.
 */
export function Selectable({ type, id, href, children, className = "" }: { type: "material" | "folder"; id: string; href?: string; children: ReactNode; className?: string }) {
  const { selected, select } = useContext(Ctx);
  const router = useRouter();
  const on = selected?.type === type && selected.id === id;
  /** نقرةٌ تُحدِّد ونقرتان تفتحان، ومفتاح Enter يفتح والمسافة تُحدِّد — كأقراص الملفات */
  const open = href ? () => router.push(href) : undefined;
  return (
    <div
      data-selectable
      role="button"
      tabIndex={0}
      aria-pressed={on}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a, button, summary, input, select, textarea, label")) return;
        select(on ? null : { type, id });
      }}
      onDoubleClick={(e) => {
        if (!open || (e.target as HTMLElement).closest("a, button, summary, input, select, textarea, label")) return;
        e.preventDefault();
        open();
      }}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" && open) { e.preventDefault(); open(); return; }
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(on ? null : { type, id }); }
      }}
      /* وشريط التحكم لاصقٌ فوقها: تُحجز مسافته أيضاً فلا تقف البطاقة تحته */
      className={`rounded-xl transition-shadow cursor-default outline-none scroll-mt-14 ${on ? "ring-2 ring-ink ring-offset-2 ring-offset-paper" : "focus-visible:ring-2 focus-visible:ring-line-2"} ${className}`}
    >
      {children}
    </div>
  );
}

export default function LibraryBoard({ materials, folders, competencies, weeks, here, openFolder, children }: {
  materials: MaterialRow[];
  folders: FolderRow[];
  competencies: { slug: string; name: string }[];
  weeks: { number: number; label: string }[];
  /** الصفحة الجارية بمجلدها إن كان مفتوحاً: إليها تعود الإجراءات فلا تُخرج المديرَ من المجلد */
  here: string;
  /** المجلد المفتوح — يقع فيه ما يُرفع، ويُخفي «مجلد جديد» من قائمة الإضافة */
  openFolder: { id: string; name: string } | null;
  children: ReactNode;
}) {
  const [selected, setSelected] = useState<Selection>(null);
  const [panel, setPanel] = useState<"edit" | "move" | null>(null);
  const bar = useRef<HTMLDivElement>(null);

  /**
   * الاستعادة في أثرٍ بعد الترطيب لا في أول تصيير: الخادم لا يعرف تخزين
   * المتصفّح، فلو اختلف ما يُصيَّر هناك عمّا يُصيَّر هنا لاختلّ الترطيب.
   */
  useEffect(() => { const s = readStored(); if (s) setSelected(s); }, []);

  /**
   * حُذف المحدَّد أو زال: الشريط يُطوى بدل أن يبقى على اسمٍ ذهب. والفحص في
   * التصيير لا في أثرٍ بعده، فلا يومض الشريط على بيانٍ قديم قبل أن يُصحَّح.
   */
  const mat = selected?.type === "material" ? materials.find((m) => m.id === selected.id) : undefined;
  const fol = selected?.type === "folder" ? folders.find((f) => f.id === selected.id) : undefined;
  if (selected && !mat && !fol) { setSelected(null); setPanel(null); store(null); }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setSelected(null); setPanel(null); store(null); } };
    /** والمطواة تُغلق بأول ضغطة خارجها، كما تُغلق قوائم الأقراص */
    const onDown = (e: MouseEvent) => {
      if ((e.target as HTMLElement | null)?.closest("[data-library-bar]")) return;
      setPanel(null);
    };
    /**
     * وإلغاءُ التحديد على النقرة التامّة لا على ضغطتها.
     *
     * والمستمع على الصفحة كلها لا على لوح المكتبة وحده: حشوةُ الصفحة وعمودُ
     * النماذج بجانبها فراغٌ في عين الناقر، ولو استُثنيا لبقي التحديد معلّقاً بعد
     * نقرةٍ يراها المدير إلغاءً.
     *
     * ولو أُلغي عند الضغط — وهو ما كان — لانطوى الشريط تحت الإصبع قبل رفعه،
     * فتُزاح الصفحةُ بمقدار ما نقص منه، ويقع الرفع على غير ما وقع عليه الضغط،
     * فلا يولد حدث النقر أصلاً: كان الضغط على «كل المواد» وشيءٌ محدَّد لا يفتح
     * شيئاً، ولا رسالةَ خطأ تدلّ على السبب.
     */
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest("[data-library-bar], [data-selectable], [data-keep-selection]")) return;
      setSelected(null);
      store(null);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("click", onClick);
    };
  }, []);

  const clear = () => { setSelected(null); setPanel(null); store(null); };
  const toggle = (p: "edit" | "move") => setPanel((c) => (c === p ? null : p));

  return (
    <Ctx.Provider value={{ selected, select: (s) => { setSelected(s); setPanel(null); store(s); } }}>
      <NewMenuProvider here={here} openFolder={openFolder}>
      <div className="space-y-4">
        <div ref={bar} data-library-bar className="sticky z-30 -mx-1 px-1 py-1 bg-paper/95 backdrop-blur" style={{ top: "var(--header-h)" }}>
          <div className="card p-1.5 shadow-sm flex flex-wrap items-center gap-1 min-h-[2.9rem]">
            {/* خارج الشرط: موضعه واحد في الحالين فلا ينتقل تحت يد المدير */}
            <NewMenuButton />
            {!mat && !fol ? (
              /* سطرٌ واحد لا يلتفّ: التفافُه يزيد ارتفاع الشريط فتُزاح الصفحة عند كل تحديد */
              <p className="text-xs text-muted px-2 truncate min-w-0 flex-1">
                حدّد مادة أو مجلداً لتظهر أدواته هنا. <span className="hidden lg:inline">نقرةٌ على الفراغ تُلغي التحديد، ونقرتان على المجلد تفتحانه.</span>
              </p>
            ) : (
              <>
                <button type="button" onClick={clear} className="btn btn-ghost btn-sm px-2 shrink-0" aria-label="إلغاء التحديد" title="إلغاء التحديد">
                  <X size={16} />
                </button>
                <div className="flex items-center gap-1.5 min-w-0 px-1">
                  {fol && <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ background: folderHex(fol.color) }} aria-hidden />}
                  <span className="text-sm font-medium truncate max-w-[9rem] sm:max-w-[18rem]">{mat ? mat.title : fol!.name}</span>
                  <span className="text-xs text-muted shrink-0 hidden sm:inline">
                    {mat ? MATERIAL_KIND_LABELS[mat.kind] : `${fol!.count} مادة`}
                  </span>
                </div>

                {/* الفاصل على الشاشات الواسعة وحدها: على الجوال يدفع الأزرار إلى سطرٍ ثانٍ متباعد */}
                <span className="hidden sm:block flex-1" />

                {/* الترتيب: مبادلةٌ مع الجار — المادة داخل مجموعتها، والمجلد بين المجلدات */}
                <OrderForm action={mat ? moveMaterialOrder : moveFolder} id={(mat ?? fol!).id} dir="up" disabled={!(mat ?? fol!).canUp} label={mat ? "تقديم" : "رفع المجلد"} back={here} />
                <OrderForm action={mat ? moveMaterialOrder : moveFolder} id={(mat ?? fol!).id} dir="down" disabled={!(mat ?? fol!).canDown} label={mat ? "تأخير" : "خفض المجلد"} back={here} />

                {mat && (
                  <div className="relative">
                    <button type="button" onClick={() => toggle("move")} className="btn btn-ghost btn-sm" aria-expanded={panel === "move"} title="نقل إلى مجلد">
                      <FolderInput size={15} /> <span className="hidden sm:inline">نقل</span>
                    </button>
                    {panel === "move" && (
                      <Popover>
                        <form action={moveMaterial} className="p-3 flex flex-col gap-2">
                          <input type="hidden" name="id" value={mat.id} />
                          <input type="hidden" name="back" value={here} />
                          <label className="label">انقلها إلى</label>
                          <FolderSelect folders={folders} value={mat.folderId} />
                          <SubmitButton secondary className="btn-sm" pendingText="جارٍ النقل…">نقل</SubmitButton>
                        </form>
                      </Popover>
                    )}
                  </div>
                )}

                {fol && (
                  <a href={`/admin/materials?folder=${fol.id}`} className="btn btn-ghost btn-sm" title="فتح المجلد">
                    <FolderOpen size={15} /> <span className="hidden sm:inline">فتح</span>
                  </a>
                )}

                {mat?.fileId && (
                  <a href={`/file/${mat.fileId}?from=${encodeURIComponent(here)}`} className="btn btn-ghost btn-sm" title="عرض الملف">
                    <Eye size={15} /> <span className="hidden sm:inline">عرض</span>
                  </a>
                )}

                <div className="relative">
                  <button type="button" onClick={() => toggle("edit")} className="btn btn-ghost btn-sm" aria-expanded={panel === "edit"} title="تعديل">
                    <Pencil size={15} /> <span className="hidden sm:inline">تعديل</span>
                  </button>
                  {panel === "edit" && (
                    <Popover wide>
                      {mat ? (
                        /* مفتاحه معرّف المادة: تبديل التحديد يعيد بناء الحقول بقيمها لا بقيم سابقتها */
                        <form key={mat.id} action={saveMaterial} className="p-3">
                          <input type="hidden" name="id" value={mat.id} />
                          <input type="hidden" name="folderId" value={mat.folderId ?? ""} />
                          <input type="hidden" name="back" value={here} />
                          <MaterialFields competencies={competencies} material={mat} weeks={weeks} />
                          <SubmitButton secondary className="btn-sm">حفظ</SubmitButton>
                        </form>
                      ) : (
                        <form key={fol!.id} action={saveFolder} className="p-3">
                          <input type="hidden" name="id" value={fol!.id} />
                          <input type="hidden" name="back" value={here} />
                          <div className="field"><label className="label">الاسم</label><input name="name" className="input" defaultValue={fol!.name} required maxLength={60} /></div>
                          <div className="field"><label className="label">اللون</label>
                            <select name="color" className="select" defaultValue={fol!.color}>
                              {Object.entries(FOLDER_COLORS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                            </select>
                          </div>
                          <div className="field"><label className="label">وصف يظهر تحت اسم المجلد</label><input name="note" className="input" defaultValue={fol!.note ?? ""} maxLength={160} /></div>
                          <SubmitButton secondary className="btn-sm">حفظ</SubmitButton>
                        </form>
                      )}
                    </Popover>
                  )}
                </div>

                <form action={mat ? deleteMaterial : deleteFolder}>
                  <input type="hidden" name="id" value={(mat ?? fol!).id} />
                  <input type="hidden" name="back" value={here} />
                  <SubmitButton
                    ghost
                    className="btn-sm text-muted"
                    pendingText="…"
                    label="حذف"
                    confirm={mat
                      ? `حذف «${mat.title}» وملفاتها؟ لا رجعة في هذا.`
                      : `حذف مجلد «${fol!.name}»؟\n\nمواده لا تُحذف — تعود إلى «بلا مجلد».`}
                  >
                    <Trash2 size={15} />
                  </SubmitButton>
                </form>
              </>
            )}
          </div>
        </div>

        {children}
      </div>
      </NewMenuProvider>
    </Ctx.Provider>
  );
}

function OrderForm({ action, id, dir, disabled, label, back }: { action: (f: FormData) => void; id: string; dir: "up" | "down"; disabled: boolean; label: string; back: string }) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="dir" value={dir} />
      <input type="hidden" name="back" value={back} />
      <button type="submit" disabled={disabled} className="btn btn-ghost btn-sm px-1.5 disabled:opacity-30" aria-label={label} title={label}>
        {dir === "up" ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
    </form>
  );
}
