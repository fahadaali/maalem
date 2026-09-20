"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { FolderPlus, Link2, Plus, Upload, X } from "lucide-react";
import SubmitButton from "@/components/SubmitButton";
import Popover from "./Popover";
import { FOLDER_COLORS } from "@/lib/folders";
import { MAX_BATCH_FILES, checkFile, titleFromFilename } from "@/lib/files";
import { uploadFile } from "@/lib/upload-client";
import { addMaterialsFromUploads, createFolder, saveMaterial } from "../actions";

/**
 * مدخل الإضافة في المكتبة: زرٌّ واحد بقائمةٍ واحدة، على هيئة أقراص السحاب.
 *
 * كان الإنشاء عموداً جانبياً ثابتاً فيه نموذجُ تسعة حقول وبطاقةُ مجلدٍ جديد،
 * مبسوطَين دائماً يزاحمان شبكة المواد على نصف الشاشة ولا نظير لهما في مدير
 * ملفات. فصار زرَّ «جديد»: في شريط التحكم حيث تتّسع الشاشة، وعائماً في ذيلها
 * حيث يبلغه الإبهام على الجوال — وكلاهما يفتح القائمة نفسها ويقود المسار نفسه.
 *
 * والرفع فوريٌّ بلا نافذة: العنوان اسمُ الملف بلا امتداده، والنوع يُشتقّ من نوع
 * محتواه في الخادم، والمدير يُهذّب من «تعديل» إن شاء. وكلُّ ما يُرفع يقع حيث
 * المديرُ واقف — في المجلد المفتوح، أو في الجذر إن لم يكن في مجلد.
 */

/** أيُّ زرٍّ فتح القائمة، وأيُّ متنٍ يُعرض فيها. والزرُّ مذكورٌ فيها كي
 *  يرسمها مَن فتحها وحدَه: الزرّان كلاهما في الصفحة وإن أخفى العرضُ أحدَهما،
 *  فلو رسماها معاً تكرّر ملصقُ الرفع والنموذجُ وبؤرتُه. */
type Menu = { at: "bar" | "fab"; view: "menu" | "folder" | "link" } | null;
type Row = { key: string; title: string; state: "wait" | "up" | "done" | "fail"; pct: number; error?: string };
type OpenFolder = { id: string; name: string } | null;

type Api = {
  menu: Menu;
  setMenu: (m: Menu) => void;
  openFolder: OpenFolder;
  here: string;
  busy: boolean;
};
const Ctx = createContext<Api>({ menu: null, setMenu: () => {}, openFolder: null, here: "/admin/materials", busy: false });

/** زرُّ «جديد» ومتنُ قائمته — واحدٌ يرسمه الشريط والعائم كلٌّ في موضعه */
function useMenu(at: "bar" | "fab") {
  const { menu, setMenu, busy } = useContext(Ctx);
  const mine = menu?.at === at ? menu : null;
  return { mine, toggle: () => setMenu(mine ? null : { at, view: "menu" }), busy };
}

/**
 * مُدخل الملفات واحدٌ في الصفحة، ويُفتح بـ`label` لا بنقرةٍ برمجية على المُدخل:
 * فتحُ المنتقي من غير إيماءةِ مستخدمٍ حقيقية يتعطّل في بعض المتصفّحات — يُفتح
 * المنتقي ثم لا يصل حدثُ التغيير أصلاً. وهي الطريقة نفسها التي يفتح بها زرّ
 * «إرفاق ملف» في بطاقات المواد.
 */
const FILE_INPUT_ID = "library-new-file";

/** خطأ `redirect()` من إجراء الخادم يُعرَف بموسومه، ولا يُعامَل معاملة الفشل */
function isRedirect(e: unknown): boolean {
  const digest = (e as { digest?: unknown } | null)?.digest;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
}

export default function NewMenuProvider({ here, openFolder, children }: { here: string; openFolder: OpenFolder; children: ReactNode }) {
  const [menu, setMenu] = useState<Menu>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  /** مرفقاتٌ نجحت وتنتظر نقرةً بعد فشل غيرها — فلا تُمحى أسبابُ ما سقط بإعادة التوجيه */
  const [pending, setPending] = useState<string[] | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0);

  const mark = (i: number, patch: Partial<Row>) => setRows((s) => s.map((r, k) => (k === i ? { ...r, ...patch } : r)));

  const commit = useCallback(async (attIds: string[]) => {
    const fd = new FormData();
    attIds.forEach((id) => fd.append("attachmentIds", id));
    fd.set("folderId", openFolder?.id ?? "");
    fd.set("back", here);
    try {
      await addMaterialsFromUploads(fd);
    } catch (err) {
      /**
       * إعادة التوجيه من الإجراء تُرمى كخطأ خاص، فتُمرَّر إلى Next ولا تُعرض رسالة.
       * وتُفرَّغ الصينية قبلها: الوجهة هي الصفحة نفسها فيُوفَّق المزوِّد في مكانه
       * ولا يُركَّب من جديد، فتبقى الصينية معلّقةً بصفوفٍ فرغ أمرها.
       */
      if (isRedirect(err)) { setRows([]); setPending(null); throw err; }
      setFatal((err as Error).message || "تعذّر الحفظ. أعد المحاولة.");
    }
  }, [here, openFolder]);

  const run = useCallback(async (files: File[]) => {
    if (busy || files.length === 0) return;
    setMenu(null); setPending(null); setFatal(null);
    const batch = files.slice(0, MAX_BATCH_FILES);
    setRows(batch.map((f, i) => ({ key: `${Date.now()}-${i}`, title: titleFromFilename(f.name), state: "wait", pct: 0 })));
    setBusy(true);
    const okIds: string[] = [];
    let failed = 0;
    /**
     * واحداً بعد واحدٍ لا بالتوازي: رفعُ خمسةٍ معاً على شبكة جوال يقسّم الحزمة
     * عليها فتزحف النسبُ الخمس جميعاً ولا يُعرف أيُّها يتقدّم.
     */
    for (let i = 0; i < batch.length; i++) {
      // ردٌّ فوريّ قبل إنفاق ثانية في الرفع
      const bad = checkFile(batch[i]);
      if (bad) { mark(i, { state: "fail", error: bad }); failed++; continue; }
      mark(i, { state: "up", pct: 0 });
      try {
        const att = await uploadFile(batch[i], "MATERIAL", undefined, (p) => mark(i, { pct: p }));
        okIds.push(att.id);
        mark(i, { state: "done", pct: 100 });
      } catch (e) {
        mark(i, { state: "fail", error: (e as Error).message });
        failed++;
      }
    }
    setBusy(false);
    // نجح كلُّ شيء: يُحفظ بلا نقرة. وإلا بقيت الصينية ليُقرأ سببُ ما سقط قبل أن تُعاد الصفحة
    if (failed === 0 && okIds.length) await commit(okIds);
    else setPending(okIds);
  }, [busy, commit]);

  // Escape يُغلق القائمة. ويُلغي اللوحُ التحديدَ بالمفتاح نفسه، وهو المنتظَر: «الهروب يُلغي كل شيء»
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenu(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /**
   * السحب والإفلات على النافذة لا على عنصرٍ بعينه، وهو اضطرارٌ لا اختيار: سلوك
   * المتصفّح الافتراضي لملفٍ يُفلَت في أيّ موضع من الوثيقة أن يفتحه، فيهدم
   * الصفحة وأيَّ رفعٍ جارٍ. ومنعُه يوجب `preventDefault` على مستوى النافذة —
   * ومتى فُعل صار «الإفلات في أي موضع» مجّاناً، وهو عين ما تفعله أقراص السحاب.
   */
  useEffect(() => {
    const hasFiles = (e: DragEvent) => !!e.dataTransfer && Array.from(e.dataTransfer.types).includes("Files");
    // سحبُ نصٍّ أو رابطٍ يُردّ بلا `preventDefault`، فيبقى إفلاته في حقول المطواة عاملاً
    const onEnter = (e: DragEvent) => { if (!hasFiles(e)) return; e.preventDefault(); depth.current++; setDragging(true); };
    const onOver = (e: DragEvent) => { if (!hasFiles(e)) return; e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = "copy"; };
    // `dragleave` يُطلق عند كل حدّ ابنٍ يُعبر، فالعدّادُ وحده يمنع رفّة الغطاء
    const onLeave = (e: DragEvent) => { if (!hasFiles(e)) return; depth.current = Math.max(0, depth.current - 1); if (depth.current === 0) setDragging(false); };
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth.current = 0;
      setDragging(false);
      /**
       * تُقرأ العناصر كلها متزامنةً قبل أي `await`: قائمةُ النقل و`webkitGetAsEntry`
       * تبطلان لحظةَ أن يتنازل مُعالِج الإفلات.
       */
      const items = Array.from(e.dataTransfer?.items ?? []).filter((it) => it.kind === "file");
      const files: File[] = [];
      let dirs = 0;
      for (const it of items) {
        // مجلدات المكتبة مستوىً واحد لا يتداخل، فلا تُرفع المجلدات. وبغير هذا
        // الفحص يصل المجلد إلى `checkFile` ملفاً صفريّاً فيقول «الملف فارغ» — صادقاً عديم النفع
        if (it.webkitGetAsEntry?.()?.isDirectory) { dirs++; continue; }
        const f = it.getAsFile();
        if (f) files.push(f);
      }
      // متصفّحٌ بلا `items`: تُقرأ القائمة المسطّحة
      const list = files.length ? files : Array.from(e.dataTransfer?.files ?? []);
      if (dirs) setFatal("المجلدات لا تُرفع. افتح المجلد واسحب ملفاته.");
      if (list.length) void run(list);
    };
    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragover", onOver);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [run]);

  return (
    <Ctx.Provider value={{ menu, setMenu, openFolder, here, busy }}>
      {children}
      {/* مُدخلٌ واحد يفتحه زرّ الشريط وزرّ العائم جميعاً، كلٌّ من قائمته */}
      <input
        id={FILE_INPUT_ID}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => { const f = Array.from(e.target.files ?? []); e.target.value = ""; if (f.length) void run(f); }}
      />
      {rows.length > 0 ? <Tray rows={rows} busy={busy} pending={pending} onCommit={commit} onClose={() => { setRows([]); setPending(null); setFatal(null); }} /> : <Fab />}
      {fatal && (
        <div className="library-tray no-print" data-keep-selection role="alert">
          <div className="card shadow-lg flex items-start gap-2" style={{ width: "min(20rem, calc(100vw - 2rem))" }}>
            <p className="text-sm flex-1">{fatal}</p>
            <button type="button" onClick={() => setFatal(null)} className="btn btn-ghost btn-sm shrink-0" aria-label="إغلاق"><X size={14} /></button>
          </div>
        </div>
      )}
      {dragging && (
        /* خارج التدفّق فلا يزيح شيئاً، وبلا أحداث مؤشّر فلا يبتلع الإفلات ولا يولّد عاصفة مغادرة */
        <div className="fixed inset-0 z-[45] pointer-events-none flex items-center justify-center bg-paper/70 no-print">
          <div className="card border-2 border-dashed border-ink text-center px-8 py-6 shadow-lg">
            <Upload size={22} className="mx-auto mb-2" />
            <div className="font-medium">أفلت الملفات هنا</div>
            <div className="text-xs text-muted mt-0.5">{openFolder ? `ستُضاف إلى «${openFolder.name}»` : "ستُضاف إلى المكتبة"}</div>
          </div>
        </div>
      )}
      <div className="library-fab-space" aria-hidden />
    </Ctx.Provider>
  );
}

/** زرّ «جديد» في شريط التحكم — يظهر حيث تتّسع الشاشة ويغيب حيث يحلّ العائم */
export function NewMenuButton() {
  const { mine, toggle, busy } = useMenu("bar");
  return (
    <div className="relative library-new-bar">
      <button type="button" onClick={toggle} className="btn btn-sm" aria-expanded={!!mine} disabled={busy}>
        <Plus size={15} /> جديد
      </button>
      {mine && <Popover wide={mine.view !== "menu"}><MenuBody view={mine.view} at="bar" /></Popover>}
    </div>
  );
}

/** الزرّ العائم — على الجوال وحده، في طرف السطر المنطقيّ من ذيل الصفحة */
function Fab() {
  const { mine, toggle, busy } = useMenu("fab");
  return (
    <div className="library-fab no-print" data-keep-selection>
      <div className="relative">
        {mine && <Popover up wide={mine.view !== "menu"}><MenuBody view={mine.view} at="fab" /></Popover>}
        <button
          type="button"
          onClick={toggle}
          aria-expanded={!!mine}
          aria-label="جديد"
          disabled={busy}
          className="w-14 h-14 rounded-full bg-ink text-paper shadow-lg flex items-center justify-center disabled:opacity-45"
        >
          <Plus size={24} />
        </button>
      </div>
    </div>
  );
}

/** متن القائمة — واحدٌ يقرؤه الشريط والعائم جميعاً */
function MenuBody({ view, at }: { view: "menu" | "folder" | "link"; at: "bar" | "fab" }) {
  const { setMenu, openFolder, here } = useContext(Ctx);
  if (view === "folder") return <FolderForm here={here} />;
  if (view === "link") return <LinkForm here={here} openFolder={openFolder} />;
  return (
    <div className="py-1">
      {/* والقائمة تُغلق عند وصول الملفات لا عند النقر: إغلاقُها هنا يفكّ الملصق قبل أن يُفتح المنتقي */}
      <label htmlFor={FILE_INPUT_ID} className="w-full text-start flex items-center gap-2 px-3 py-2 hover:bg-paper-2 cursor-pointer">
        <Upload size={15} /> رفع ملف
      </label>
      <button type="button" onClick={() => setMenu({ at, view: "link" })} className="w-full text-start flex items-center gap-2 px-3 py-2 hover:bg-paper-2">
        <Link2 size={15} /> إضافة رابط
      </button>
      {/* مجلدات المكتبة مستوىً واحد، فلا يُوعَد المديرُ داخل مجلدٍ بما لا تعطيه القاعدة */}
      {!openFolder && (
        <button type="button" onClick={() => setMenu({ at, view: "folder" })} className="w-full text-start flex items-center gap-2 px-3 py-2 hover:bg-paper-2">
          <FolderPlus size={15} /> مجلد جديد
        </button>
      )}
      <p className="text-xs text-muted px-3 pt-2 pb-1 border-t border-line mt-1">
        {openFolder ? `ما يُرفع يقع في «${openFolder.name}»` : "ويمكن سحب الملفات وإفلاتها على الصفحة"}
      </p>
    </div>
  );
}

function FolderForm({ here }: { here: string }) {
  return (
    <form action={createFolder} className="p-3">
      <input type="hidden" name="back" value={here} />
      <div className="field">
        <label className="label">اسم المجلد</label>
        <input name="name" className="input" required maxLength={60} placeholder="قوالب التقارير" autoFocus />
      </div>
      <div className="field">
        <label className="label">اللون</label>
        <select name="color" className="select" defaultValue="gray">
          {Object.entries(FOLDER_COLORS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>
      <div className="field">
        <label className="label">وصف يظهر تحت اسمه (اختياري)</label>
        <input name="note" className="input" maxLength={160} />
      </div>
      <SubmitButton secondary className="btn-sm" pendingText="جارٍ الإنشاء…"><FolderPlus size={14} /> إنشاء المجلد</SubmitButton>
    </form>
  );
}

function LinkForm({ here, openFolder }: { here: string; openFolder: OpenFolder }) {
  return (
    <form action={saveMaterial} className="p-3">
      <input type="hidden" name="kind" value="LINK" />
      <input type="hidden" name="folderId" value={openFolder?.id ?? ""} />
      <input type="hidden" name="back" value={here} />
      <div className="field">
        <label className="label">العنوان</label>
        <input name="title" className="input" required maxLength={200} autoFocus />
      </div>
      <div className="field">
        <label className="label">الرابط</label>
        <input name="url" className="input" dir="ltr" placeholder="https://" required />
      </div>
      <SubmitButton secondary className="btn-sm" pendingText="جارٍ الإضافة…"><Link2 size={14} /> إضافة الرابط</SubmitButton>
    </form>
  );
}

/** صينيةُ التقدّم — تحلّ محلّ العائم في موضعه فلا يتزاحمان */
function Tray({ rows, busy, pending, onCommit, onClose }: {
  rows: Row[]; busy: boolean; pending: string[] | null;
  onCommit: (ids: string[]) => Promise<void>; onClose: () => void;
}) {
  const done = rows.filter((r) => r.state === "done").length;
  const failed = rows.filter((r) => r.state === "fail").length;
  return (
    <div className="library-tray no-print" data-keep-selection>
      <div className="card p-0 shadow-lg overflow-hidden" style={{ width: "min(20rem, calc(100vw - 2rem))" }}>
        <div className="flex items-center gap-2 px-3 py-2 border-b border-line">
          <span className="text-sm font-medium flex-1 truncate">
            {busy ? `جارٍ رفع ${Math.min(done + 1, rows.length)} من ${rows.length}` : failed ? "تعذّر رفع بعض الملفات" : "اكتمل الرفع"}
          </span>
          {!busy && <button type="button" onClick={onClose} className="btn btn-ghost btn-sm shrink-0" aria-label="إغلاق"><X size={14} /></button>}
        </div>
        <ul className="max-h-[40vh] overflow-auto text-sm" role={failed ? "alert" : undefined}>
          {rows.map((r) => (
            <li key={r.key} className="px-3 py-2 border-b border-line last:border-0">
              <div className="truncate">{r.title}</div>
              {r.state === "wait" && <div className="text-xs text-muted">في الانتظار</div>}
              {r.state === "up" && <div className="text-xs text-muted tabular-nums" dir="ltr">{r.pct}٪</div>}
              {r.state === "done" && <div className="text-xs text-muted">رُفع</div>}
              {r.state === "fail" && <div className="text-xs">{r.error}</div>}
            </li>
          ))}
        </ul>
        {pending && (
          <div className="p-2 border-t border-line">
            {pending.length > 0 ? (
              <button type="button" onClick={() => void onCommit(pending)} className="btn btn-sm w-full">
                إضافة ما رُفع ({pending.length})
              </button>
            ) : (
              <button type="button" onClick={onClose} className="btn btn-secondary btn-sm w-full">حسناً</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
