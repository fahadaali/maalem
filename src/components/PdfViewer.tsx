"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ZoomIn, ZoomOut } from "lucide-react";
import { PDFJS_VERSION } from "@/lib/files";

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
/** ما يُرسم حول الشاشة، وما يُفرَّغ بعده: كتابٌ من مئتي صفحة لا تحتمل ذاكرةُ الجوال لوحاتِه كلها */
const NEAR_PX = 800;
const KEEP = 4;
/** سكونٌ قبل حفظ الموضع: التمرير يغيّر الصفحة عشرات المرات في الثانية الواحدة */
const SAVE_IDLE_MS = 2500;
/** كم يبقى سطرُ «عُدتَ إلى صفحة…» قبل أن يزول من نفسه */
const RESUMED_MS = 7000;

/**
 * عارض PDF داخل المنصة: صفحاتٌ متصلة يُمرَّر بينها، تُرسم على canvas.
 *
 * الإطار المدمج لا يصلح على الجوال — سفاري iOS يرسم الصفحة الأولى بلا تمرير،
 * وكروم أندرويد ينزّل الملف بدل عرضه — والمطلوب أن يُقرأ الملف داخل التطبيق.
 *
 * وتُجلب الحزمة عند أول فتح ملف لا مع كل صفحة: استيرادٌ ديناميكي يُخرجها إلى
 * قطعة منفصلة تحت ‎_next/static المخزَّن سنة كاملة.
 */
export default function PdfViewer({ url, docId, startPage }: { url: string; docId?: string; startPage?: number }) {
  const docRef = useRef<PdfDoc | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  /** لوحة كل صفحة بمرجعها، ومهمّة رسمها الجارية، وجيلُ آخر طلب رسم لها */
  const slots = useRef(new Map<number, { el: HTMLDivElement; canvas: HTMLCanvasElement; task?: { cancel: () => void }; gen: number; drawn: number }>());
  /**
   * دالّةُ مرجعٍ ثابتة لكل صفحة. ولو كُتبت في JSX مباشرةً لصارت دالّةً جديدة في كل
   * تصيير، فيستدعيها React من جديد في كل مرة فيُعاد بناء الموضع بحالٍ صفرية —
   * ومؤشّر الصفحة يتغيّر مع كل تمريرة، فيُصيَّر العارض كثيراً. وبضياع الحال يضيع
   * ما يُبنى عليه: ما رُسم، ومهمّةُ رسمٍ تُلغى، وجيلٌ يحرسها — فلا تُفرَّغ لوحاتُ
   * ما غادره القارئ، وتتراكم في كتابٍ طويل.
   */
  const refFns = useRef(new Map<number, (el: HTMLDivElement | null) => void>());
  const pageRef = useCallback((n: number) => {
    let fn = refFns.current.get(n);
    if (!fn) {
      fn = (el: HTMLDivElement | null) => {
        if (!el) { slots.current.delete(n); return; }
        const canvas = el.querySelector("canvas") as HTMLCanvasElement;
        const prev = slots.current.get(n);
        if (prev && prev.el === el) { prev.canvas = canvas; return; }
        slots.current.set(n, { el, canvas, gen: 0, drawn: 0 });
      };
      refFns.current.set(n, fn);
    }
    return fn;
  }, []);
  const [pages, setPages] = useState(0);
  const [ratio, setRatio] = useState(1.414); // ارتفاع الصفحة إلى عرضها — تقديرٌ حتى تُقاس
  const [current, setCurrent] = useState(1);
  const [scale, setScale] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  /** أُستؤنفت القراءة من صفحةٍ محفوظة: يُعرض سطرُ العودة إلى الأول */
  const [resumed, setResumed] = useState(0);
  /** آخر صفحةٍ أُرسلت إلى الخادم. تبدأ بالمحفوظة فلا يُعاد حفظُ ما هو محفوظ */
  const saved = useRef(startPage ?? 0);
  /** هل وثب العارضُ إلى الموضع المحفوظ؟ مرةً واحدة لكل فتحة */
  const jumped = useRef(false);
  /**
   * آخرُ قيمةٍ للصفحة وعددِها، يقرؤها مستمعُ المغادرة. وهو مُركَّبٌ مرةً واحدة
   * على `docId` وحده — لا على كل تغيّر صفحة، وإلا رُكّب وفُكّ مع كل تمريرة —
   * فلا يرى الحالةَ الأحدث إلا من مرجع.
   */
  const currentRef = useRef(1);
  const pagesRef = useRef(0);

  currentRef.current = current;
  pagesRef.current = pages;

  // تحميل الوثيقة مرة واحدة
  useEffect(() => {
    let dead = false;
    let task: { promise: Promise<unknown>; destroy: () => Promise<void> } | null = null;
    const drawn = slots.current;
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
        // العامل وموارد التصيير ملفات ثابتة في public/ ينسخها scripts/copy-pdf-worker.mjs
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const base = `/pdf/${PDFJS_VERSION}`;
        task = pdfjs.getDocument({
          // withCredentials: الملف محميٌّ بالجلسة ويُجلب من المنصة نفسها
          url, withCredentials: true,
          /**
           * بهذه الثلاثة يُقرأ الملف كما هو لا كما يُخمَّن: خرائط ترميز خطوط CID —
           * وبدونها ينقلب النص العربي وتتبعثر كلماته — وبدائلُ الخطوط القياسية غير
           * المضمَّنة، ووحداتُ فكّ الصور الممسوحة. وقيمها الافتراضية في PDF.js null.
           */
          cMapUrl: `${base}/cmaps/`,
          cMapPacked: true,
          standardFontDataUrl: `${base}/standard_fonts/`,
          wasmUrl: `${base}/wasm/`,
          /**
           * وخطوط النظام لا تُستبدل بخطوط الملف: حين يُرسم نصٌّ غير مضمَّن الخط
           * بخطٍّ من الجهاز، يرسمه المتصفّح نصّاً فيُطبّق عليه تشكيل العربية
           * وترتيبها ثنائيَّ الاتجاه — والملف يخزّن حروفه مرتَّبةً للعرض أصلاً،
           * فتنقلب مرتين وتتبعثر الكلمات. وبخطوط PDF.js المرفقة تُرسم الأشكال
           * بمعرّفاتها كما في الملف، لا كما يفهمها جهاز القارئ.
           */
          /**
           * وهذا هو موضع العطل الذي كان يقلب النصّ العربي: PDF.js يحوّل خط الملف
           * إلى خطٍّ وِبِّي ويرسم النصَّ نصّاً، فيُطبّق المتصفّح تشكيل العربية
           * وترتيبها ثنائيَّ الاتجاه على حروفٍ خزّنها الملفُّ مشكَّلةً مرتَّبةً
           * للعرض أصلاً — فتُشكَّل مرتين وتتبعثر الكلمات. وبتعطيله يرسم PDF.js
           * أشكال الحروف بمساراتها كما هي في الملف، فلا يمرّ النصّ بمحرّك نصوص
           * يعيد تفسيره. جُرّب الملف نفسه في عارض كروم فظهر سليماً، وفي PDF.js
           * بإعداده الافتراضي فانقلب، وبهذا الخيار فطابق كروم حرفاً بحرف.
           */
          disableFontFace: true,
        }) as unknown as typeof task;
        const doc = (await task!.promise) as PdfDoc;
        // خرج المشارك قبل اكتمال التحميل: أتلفَ التنظيفُ مهمةَ التحميل وعاملها، فلا يُركَّب شيء
        if (dead) return;
        docRef.current = doc;
        // نسبة الصفحة الأولى تقديرٌ لبقية الصفحات، وتُصحَّح لكل صفحة عند رسمها
        const first = await doc.getPage(1);
        if (dead) return;
        const v = first.getViewport({ scale: 1 });
        setRatio(v.height / v.width);
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
      /**
       * ملفٌّ يحلّ محلَّ ملف في العارض نفسه: المواضع تبقى مركَّبة ودوالُّ مرجعها
       * ثابتة، فلا يستدعيها React ثانيةً. فتُصفَّر حالُها هنا بدل إزالتها، وإلا
       * بقيت خالية فلم تُرسم صفحةٌ من الملف الجديد.
       */
      for (const s of drawn.values()) {
        s.task?.cancel();
        s.gen++;
        s.canvas.width = 0;
        s.canvas.height = 0;
        s.drawn = 0;
        s.el.style.aspectRatio = "";
      }
      docRef.current = null;
      // مهمة التحميل تُتلف الوثيقة وعاملها معاً، سواء اكتمل التحميل أم لم يكتمل
      void task?.destroy().catch(() => {});
    };
  }, [url]);

  /** يرسم صفحةً بعينها على لوحتها بالحجم الجاري */
  const drawPage = useCallback(async (n: number) => {
    const doc = docRef.current;
    const slot = slots.current.get(n);
    if (!doc || !slot || (slot.drawn > 0 && Math.abs(slot.drawn - slot.el.clientWidth) < 2)) return;
    /**
     * جِيلٌ لكل رسمة: جلب الصفحة انتظارٌ قد يبدأ خلاله رسمٌ أحدث لها. فلو أُلغي
     * السابق قبل الانتظار لتراكبت رسمتان على اللوحة الواحدة، فترمي PDF.js
     * «Cannot use the same canvas» وتبقى الصفحة بيضاء.
     */
    const gen = ++slot.gen;
    const p = await doc.getPage(n);
    if (slots.current.get(n) !== slot || gen !== slot.gen) return;
    slot.task?.cancel();
    const base = p.getViewport({ scale: 1 });
    /**
     * اللوحة تملأ عرض موضعها، وكثافةُ بكسلاتها من كثافة الشاشة. والتكبير يجري
     * بعرض العمود لا بمعاملٍ هنا، فيبقى النصّ حادّاً على كل حجم.
     */
    const cssWidth = slot.el.clientWidth;
    if (!cssWidth) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const viewport = p.getViewport({ scale: (cssWidth / base.width) * dpr });
    const ctx = slot.canvas.getContext("2d");
    if (!ctx) return;
    slot.canvas.width = Math.floor(viewport.width);
    slot.canvas.height = Math.floor(viewport.height);
    slot.canvas.style.width = "100%";
    slot.canvas.style.height = "auto";
    // نسبة الصفحة الحقيقية تحلّ محلّ التقدير، فلا يقفز التمرير بعد الرسم
    slot.el.style.aspectRatio = `${base.width} / ${base.height}`;
    const task = p.render({ canvasContext: ctx, viewport });
    slot.task = task;
    slot.drawn = cssWidth;
    await task.promise.catch(() => { slot.drawn = -1; });
  }, []);

  /**
   * ما قارب الشاشة يُرسم، وما بَعُد عنها بأكثر من KEEP صفحات تُفرَّغ لوحته —
   * الإفراغ بتصفير أبعادها، فيستردّ المتصفح ذاكرتها ويُعاد الرسم عند العودة.
   */
  useEffect(() => {
    const box = boxRef.current;
    if (!box || !pages) return;
    const near = new Set<number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const n = Number((e.target as HTMLElement).dataset.page);
          if (e.isIntersecting) near.add(n); else near.delete(n);
        }
        for (const n of near) void drawPage(n);
        for (const [n, slot] of slots.current) {
          if (![...near].some((m) => Math.abs(m - n) <= KEEP) && slot.drawn !== 0) {
            /**
             * ورفعُ الجيل قبل الإفراغ: رسمةٌ لهذه الصفحة ما تزال تنتظر `getPage`
             * تكتب على اللوحة بعد إفراغها فتُحييها، فتبقى في الذاكرة لوحاتُ صفحاتٍ
             * غادرها القارئ. وبالجيل تُبطَل تلك الرسمة عند عودتها فلا تكتب شيئاً.
             */
            slot.gen++;
            slot.task?.cancel();
            slot.canvas.width = 0;
            slot.canvas.height = 0;
            slot.drawn = 0;
          }
        }
      },
      { root: box, rootMargin: `${NEAR_PX}px 0px` },
    );
    for (const slot of slots.current.values()) io.observe(slot.el);
    return () => io.disconnect();
  }, [pages, drawPage]);

  /**
   * مؤشّرُ الصفحة الجارية: مراقبٌ ثانٍ **بلا هامش**.
   *
   * وكان يُشتقّ من مراقب الرسم نفسه، وهامشُه ثمانُمئة بكسل حول الشاشة — فيعدّ
   * «قريباً» ما هو فوق الشاشة بصفحةٍ أو صفحتين، وأصغرُ القريب هو المعروض عنده.
   * فكان العدّاد يقول 23 والقارئ على 25. وما كان خطأً في عدّادٍ يُقرأ صار خطأً
   * يُكتب حين ارتبط به حفظُ الموضع: تُحفظ صفحةٌ أدنى مما بلغ القارئ، فيتراجع
   * موضعُه مع كل فتحة.
   */
  useEffect(() => {
    const box = boxRef.current;
    if (!box || !pages) return;
    const seen = new Set<number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const n = Number((e.target as HTMLElement).dataset.page);
          if (e.isIntersecting) seen.add(n); else seen.delete(n);
        }
        // أعلى صفحةٍ ظاهرةٍ فعلاً هي التي يقرؤها: ما تحتها لم يبلغه بعد
        if (seen.size) setCurrent(Math.min(...seen));
      },
      { root: box, rootMargin: "0px" },
    );
    for (const slot of slots.current.values()) io.observe(slot.el);
    return () => io.disconnect();
  }, [pages]);

  // تغيّر التكبير أو عرض النافذة: يُعاد رسم ما هو معروض، ويبقى موضع القراءة
  useEffect(() => {
    if (loading || error) return;
    let t: ReturnType<typeof setTimeout>;
    const redraw = () => {
      for (const slot of slots.current.values()) if (slot.drawn !== 0) slot.drawn = -1;
      for (const [n, slot] of slots.current) {
        const r = slot.el.getBoundingClientRect();
        if (r.bottom > -NEAR_PX && r.top < window.innerHeight + NEAR_PX) void drawPage(n);
      }
    };
    redraw();
    // الدوران وإظهار شريط العنوان في الجوال يطلقان resize مراراً متتابعة
    const onResize = () => { clearTimeout(t); t = setTimeout(redraw, 150); };
    window.addEventListener("resize", onResize);
    return () => { clearTimeout(t); window.removeEventListener("resize", onResize); };
  }, [scale, loading, error, drawPage]);

  /**
   * الوثوبُ إلى الموضع المحفوظ. مرةً واحدة بعد أن تُركَّب عقدُ الصفحات — وهي
   * تُركَّب كلُّها دفعةً واحدة بمقاسٍ مُقدَّر — فلا ينتظر رسماً. والمقاسُ تقديرٌ
   * من الصفحة الأولى، فالهبوطُ في مستندٍ مختلف الأحجام تقريبيٌّ يصحّحه الرسم.
   */
  useEffect(() => {
    if (jumped.current || loading || error || !pages) return;
    const target = Math.min(Math.max(startPage ?? 1, 1), pages);
    if (target <= 1) { jumped.current = true; return; }
    const el = slots.current.get(target)?.el;
    if (!el) return;
    jumped.current = true;
    el.scrollIntoView({ block: "start" });
    setResumed(target);
  }, [loading, error, pages, startPage]);

  // سطرُ العودة يزول من نفسه: تنبيهٌ لا يبقى معلّقاً فوق الصفحة
  useEffect(() => {
    if (!resumed) return;
    const t = setTimeout(() => setResumed(0), RESUMED_MS);
    return () => clearTimeout(t);
  }, [resumed]);

  /**
   * حفظُ الموضع بعد سكون. ولا يُكتب صفٌّ لمن فتح وأغلق بلا قراءة: `saved` تبدأ
   * بالموضع المحفوظ، فلا يُرسل شيءٌ حتى تتغيّر الصفحة عمّا فُتح عليه.
   */
  useEffect(() => {
    // ولا قبل أن يستقرّ الوثوب إلى الموضع المحفوظ: وإلا حُفظت الصفحةُ الأولى فوقه
    if (!docId || loading || error || !pages || !jumped.current || current === saved.current) return;
    const t = setTimeout(() => {
      saved.current = current;
      void fetch("/api/reading-progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: docId, page: current, pages }),
        keepalive: true,
      }).catch(() => {});
    }, SAVE_IDLE_MS);
    return () => clearTimeout(t);
  }, [current, pages, docId, loading, error]);

  /**
   * وعند المغادرة يُرسل ما لم تبلغه مهلةُ السكون بعد. و`sendBeacon` لا `fetch`:
   * المتصفح يقتل طلبات الصفحة المغادِرة، والحزمةُ وحدها تنجو منها. و`pagehide`
   * لا `beforeunload`: الأخير لا يقع في سفاري iOS، وهو أكثرُ ما يُقرأ عليه.
   */
  useEffect(() => {
    if (!docId) return;
    const flush = () => {
      const page = currentRef.current;
      if (!page || !pagesRef.current || page === saved.current) return;
      saved.current = page;
      const body = new Blob([JSON.stringify({ id: docId, page, pages: pagesRef.current })], { type: "application/json" });
      try {
        navigator.sendBeacon("/api/reading-progress", body);
      } catch {
        /* متصفحٌ لا يدعمها: يبقى ما حفظته مهلةُ السكون */
      }
    };
    const onHide = () => { if (document.visibilityState === "hidden") flush(); };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [docId]);

  if (error) return <p className="p-6 text-center text-sm text-muted">{error}</p>;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div ref={boxRef} className="flex-1 overflow-auto overscroll-contain px-2 pb-3 pt-14 md:pt-3" style={{ scrollbarGutter: "stable" }}>
        {loading ? (
          <p className="p-6 text-center text-sm text-muted">جارٍ فتح الملف…</p>
        ) : (
          /* التكبير عرضُ العمود: يتجاوز الشاشة فيظهر تمريرٌ أفقي، كما في قارئات PDF */
          <div className="mx-auto flex flex-col items-center gap-3" style={{ width: `calc(min(100%, 56rem) * ${scale})` }}>
            {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
              <div
                key={n}
                data-page={n}
                ref={pageRef(n)}
                className="w-full bg-paper shadow-sm"
                style={{ aspectRatio: `1 / ${ratio}` }}
              >
                <canvas className="block w-full" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/*
        من فُتح له الكتابُ في وسطه يجب أن يعرف لمَ، وأن يجد طريق العودة في نقرة —
        وإلا ظنّ العارضَ مختلاً. ويزول السطرُ من نفسه فلا يزاحم القراءة.
      */}
      {resumed > 0 && (
        <div className="shrink-0 border-t border-line bg-paper-3 flex items-center justify-between gap-2 px-3 py-2 text-xs">
          <span className="text-muted">عُدتَ إلى صفحة {resumed}</span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              slots.current.get(1)?.el.scrollIntoView({ block: "start" });
              setResumed(0);
            }}
          >
            ابدأ من الأول
          </button>
        </div>
      )}

      {pages > 0 && (
        <div
          className="shrink-0 border-t border-line bg-paper flex items-center justify-between gap-2 px-3 py-2"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.5rem)" }}
        >
          <span className="text-xs text-muted tabular-nums" aria-live="polite">صفحة {current} من {pages}</span>
          <div className="flex items-center gap-1">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setScale((s) => Math.max(MIN_SCALE, +(s - 0.25).toFixed(2)))} disabled={scale <= MIN_SCALE} aria-label="تصغير">
              <ZoomOut size={16} />
            </button>
            <span className="text-xs text-muted tabular-nums w-10 text-center">{Math.round(scale * 100)}٪</span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setScale((s) => Math.min(MAX_SCALE, +(s + 0.25).toFixed(2)))} disabled={scale >= MAX_SCALE} aria-label="تكبير">
              <ZoomIn size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
