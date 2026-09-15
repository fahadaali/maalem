"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";

/** نوع مختصر لما نستعمله من PDF.js، فلا نستورد أنواع الحزمة في حزمة الصفحة */
type PdfPage = {
  getViewport: (o: { scale: number }) => { width: number; height: number };
  render: (o: { canvasContext: CanvasRenderingContext2D; viewport: unknown }) => { promise: Promise<void>; cancel: () => void };
};
/**
 * إتلاف الوثيقة على مهمة التحميل لا على الوثيقة نفسها: PDF.js حذف `destroy`
 * من الوثيقة، فكان استدعاؤه عند إغلاق العارض يرمي «destroy is not a function»
 * ويُظهر للمشارك صفحة «تعذُّر عرض هذه الصفحة» بعد خروجه من ملفٍ فتحه.
 */
type PdfDoc = { numPages: number; getPage: (n: number) => Promise<PdfPage> };

const MIN_SCALE = 0.5;
const MAX_SCALE = 3;

/**
 * عارض PDF داخل المنصة: يرسم الصفحات بنفسه على canvas.
 *
 * الإطار المدمج لا يصلح على الجوال — سفاري iOS يرسم الصفحة الأولى بلا تمرير،
 * وكروم أندرويد ينزّل الملف بدل عرضه — والمطلوب أن يُقرأ الملف داخل التطبيق.
 *
 * وتُجلب الحزمة عند أول فتح ملف لا مع كل صفحة: استيرادٌ ديناميكي يُخرجها إلى
 * قطعة منفصلة تحت ‎_next/static المخزَّن سنة كاملة.
 */
export default function PdfViewer({ url }: { url: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const docRef = useRef<PdfDoc | null>(null);
  const taskRef = useRef<{ cancel: () => void } | null>(null);
  const genRef = useRef(0);
  const [pages, setPages] = useState(0);
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // تحميل الوثيقة مرة واحدة
  useEffect(() => {
    let dead = false;
    let task: { promise: Promise<unknown>; destroy: () => Promise<void> } | null = null;
    (async () => {
      try {
        /**
         * PDF.js يستعمل Promise.withResolvers في نسختيه الحديثة والقديمة معاً بلا
         * تعويض، وهي حديثة (سفاري 17.4 وكروم 119). فتُعوَّض هنا قبل تحميله ليعمل
         * العارض على الأجهزة الأقدم بدل أن يسقط إلى رسالة التعذّر.
         */
        const P = Promise as unknown as { withResolvers?: unknown };
        if (typeof P.withResolvers !== "function") {
          P.withResolvers = function <T>() {
            let resolve!: (v: T | PromiseLike<T>) => void;
            let reject!: (r?: unknown) => void;
            const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
            return { promise, resolve, reject };
          };
        }
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        // العامل ملفٌّ ثابت في public/ ينسخه scripts/copy-pdf-worker.mjs عند البناء
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        // withCredentials: الملف محميٌّ بالجلسة ويُجلب من المنصة نفسها
        task = pdfjs.getDocument({ url, withCredentials: true }) as unknown as typeof task;
        const doc = (await task!.promise) as PdfDoc;
        // خرج المشارك قبل اكتمال التحميل: أتلفَ التنظيفُ مهمةَ التحميل وعاملها، فلا يُركَّب شيء
        if (dead) return;
        docRef.current = doc;
        setPages(doc.numPages);
        setLoading(false);
      } catch {
        if (!dead) {
          setError("تعذّر فتح الملف. حمّله لتفتحه بعارض جهازك.");
          setLoading(false);
        }
      }
    })();
    return () => {
      dead = true;
      taskRef.current?.cancel();
      docRef.current = null;
      // مهمة التحميل تُتلف الوثيقة وعاملها معاً، سواء اكتمل التحميل أم لم يكتمل
      void task?.destroy().catch(() => {});
    };
  }, [url]);

  // رسم الصفحة الجارية عند كل تغيّر في رقمها أو تكبيرها
  const draw = useCallback(async () => {
    const doc = docRef.current;
    const canvas = canvasRef.current;
    if (!doc || !canvas) return;
    /**
     * جِيلٌ لكل رسمة: جلب الصفحة انتظارٌ قد يبدأ خلاله رسمٌ أحدث. فلو أُلغي
     * السابق قبل الانتظار لتراكبت رسمتان على اللوحة الواحدة، فترمي PDF.js
     * «Cannot use the same canvas» وتبقى الصفحة بيضاء. فيُلغى بعده، ويُترك
     * الأقدم إن سبقه أحدث.
     */
    const gen = ++genRef.current;
    const p = await doc.getPage(page);
    if (gen !== genRef.current) return;
    taskRef.current?.cancel();
    // عرض الحاوية هو المرجع، فالصفحة تملأ الشاشة على الجوال ولا تفيض عنها
    const base = p.getViewport({ scale: 1 });
    const fit = ((canvas.parentElement?.clientWidth ?? base.width) - 16) / base.width;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const viewport = p.getViewport({ scale: fit * scale * dpr });
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
    canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;
    const task = p.render({ canvasContext: ctx, viewport });
    taskRef.current = task;
    await task.promise.catch(() => {});
  }, [page, scale]);

  useEffect(() => {
    if (!loading && !error) void draw();
  }, [draw, loading, error]);

  // إعادة الرسم عند دوران الجهاز أو تغيّر عرض النافذة
  useEffect(() => {
    // الدوران وإظهار شريط العنوان في الجوال يطلقان resize مراراً متتابعة
    let t: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(t);
      t = setTimeout(() => void draw(), 150);
    };
    window.addEventListener("resize", onResize);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", onResize);
    };
  }, [draw]);

  if (error) return <p className="p-6 text-center text-sm text-muted">{error}</p>;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto p-2 flex justify-center items-start">
        {loading ? (
          <p className="p-6 text-sm text-muted">جارٍ فتح الملف…</p>
        ) : (
          <canvas ref={canvasRef} className="shadow-sm" />
        )}
      </div>

      {pages > 0 && (
        <div
          className="shrink-0 border-t border-line bg-paper flex items-center justify-between gap-2 px-3 py-2"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.5rem)" }}
        >
          <div className="flex items-center gap-1">
            {/* في الاتجاه من اليمين لليسار: السابق إلى اليمين والتالي إلى اليسار */}
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPage((n) => Math.max(1, n - 1))} disabled={page <= 1} aria-label="الصفحة السابقة">
              <ChevronRight size={16} />
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPage((n) => Math.min(pages, n + 1))} disabled={page >= pages} aria-label="الصفحة التالية">
              <ChevronLeft size={16} />
            </button>
          </div>
          <span className="text-xs text-muted" aria-live="polite">صفحة {page} من {pages}</span>
          <div className="flex items-center gap-1">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setScale((s) => Math.max(MIN_SCALE, +(s - 0.25).toFixed(2)))} disabled={scale <= MIN_SCALE} aria-label="تصغير">
              <ZoomOut size={16} />
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setScale((s) => Math.min(MAX_SCALE, +(s + 0.25).toFixed(2)))} disabled={scale >= MAX_SCALE} aria-label="تكبير">
              <ZoomIn size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
