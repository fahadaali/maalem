"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";

/** نوع مختصر لما نستعمله من PDF.js، فلا نستورد أنواع الحزمة في حزمة الصفحة */
type PdfPage = {
  getViewport: (o: { scale: number }) => { width: number; height: number };
  render: (o: { canvasContext: CanvasRenderingContext2D; viewport: unknown }) => { promise: Promise<void>; cancel: () => void };
};
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
  const [pages, setPages] = useState(0);
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // تحميل الوثيقة مرة واحدة
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        // العامل ملفٌّ ثابت في public/ ينسخه scripts/copy-pdf-worker.mjs عند البناء
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        // withCredentials: الملف محميٌّ بالجلسة ويُجلب من المنصة نفسها
        const doc = (await pdfjs.getDocument({ url, withCredentials: true }).promise) as unknown as PdfDoc;
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
    };
  }, [url]);

  // رسم الصفحة الجارية عند كل تغيّر في رقمها أو تكبيرها
  const draw = useCallback(async () => {
    const doc = docRef.current;
    const canvas = canvasRef.current;
    if (!doc || !canvas) return;
    // رسمٌ سابق لم ينته: يُلغى وإلا تراكبت الصفحتان على اللوحة نفسها
    taskRef.current?.cancel();
    const p = await doc.getPage(page);
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
    const onResize = () => void draw();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
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
