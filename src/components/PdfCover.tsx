"use client";
import { useEffect, useRef, useState } from "react";
import { PDFJS_VERSION } from "@/lib/files";

/**
 * غلاف المادة: أول صفحة من ملفها تُرسم في المتصفح.
 *
 * ثلاثة قيود تحكم هذا المكوّن، وهي سبب ما فيه من احتراز:
 *   — لا يُرسم غلافٌ لا يراه أحد: الرسم لا يبدأ إلا حين تقارب البطاقة الشاشة.
 *   — ولا تُجلب حزمة PDF.js إلا مرة واحدة لكل الأغلفة في الصفحة، بوعدٍ مشترك.
 *   — ولا يُعاد الرسم في زيارةٍ تالية: الناتج صورةٌ صغيرة تُحفظ في جهاز القارئ
 *     بمعرّف المرفق. والتخزين قد يُمنع — نافذة خاصة، أو إعداد صارم — فكل قراءة
 *     وكتابة فيه محروسة، والغلاف يظهر بدونه كما يظهر معه.
 */

const KEY = "maalem:cover:";
const WIDTH = 320;
/** سقف ما يُحفظ من الأغلفة، فلا يمتلئ تخزين الجهاز بمكتبةٍ كبيرة */
const MAX_CACHED = 40;

/** وعدٌ واحد للحزمة تشترك فيه أغلفة الصفحة كلها */
let pdfjsPromise: Promise<typeof import("pdfjs-dist/legacy/build/pdf.mjs")> | null = null;
function loadPdfjs() {
  pdfjsPromise ??= (async () => {
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
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    return pdfjs;
  })();
  return pdfjsPromise;
}

function readCache(id: string): string | null {
  try {
    return localStorage.getItem(KEY + id);
  } catch {
    return null;
  }
}

function writeCache(id: string, data: string) {
  try {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith(KEY));
    // الأقدم يُزاح حين يمتلئ العدد، والامتلاء نفسه يُمسك أدناه
    if (keys.length >= MAX_CACHED) localStorage.removeItem(keys[0]);
    localStorage.setItem(KEY + id, data);
  } catch {
    // تخزينٌ ممنوع أو ممتلئ: الغلاف يُرسم في كل زيارة، ولا يسقط شيء
  }
}

export default function PdfCover({ id, url, alt }: { id: string; url: string; alt: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cached = readCache(id);
    if (cached) {
      setSrc(cached);
      setDone(true);
      return;
    }
    const el = box.current;
    if (!el) return;
    let dead = false;
    let task: { promise: Promise<unknown>; destroy: () => Promise<void> } | null = null;

    const render = async () => {
      try {
        const pdfjs = await loadPdfjs();
        if (dead) return;
        const base = `/pdf/${PDFJS_VERSION}`;
        task = pdfjs.getDocument({
          url, withCredentials: true,
          cMapUrl: `${base}/cmaps/`, cMapPacked: true,
          standardFontDataUrl: `${base}/standard_fonts/`, wasmUrl: `${base}/wasm/`,
          // كالعارض: الأشكال تُرسم بمساراتها فلا يعيد المتصفّح تشكيل العربية
          disableFontFace: true,
        }) as unknown as typeof task;
        const doc = (await task!.promise) as { getPage: (n: number) => Promise<{ getViewport: (o: { scale: number }) => { width: number; height: number }; render: (o: { canvasContext: CanvasRenderingContext2D; viewport: unknown }) => { promise: Promise<void> } }> };
        const page = await doc.getPage(1);
        if (dead) return;
        const v1 = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: WIDTH / v1.width });
        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        await page.render({ canvasContext: ctx, viewport }).promise;
        if (dead) return;
        const data = canvas.toDataURL("image/jpeg", 0.72);
        writeCache(id, data);
        setSrc(data);
      } catch {
        // ملفٌّ لا يُقرأ: تبقى اللوحة البديلة مكانه، ولا رسالة خطأ في بطاقة
      } finally {
        if (!dead) setDone(true);
        void task?.destroy().catch(() => {});
      }
    };

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          void render();
        }
      },
      { rootMargin: "300px" },
    );
    io.observe(el);
    return () => {
      dead = true;
      io.disconnect();
      void task?.destroy().catch(() => {});
    };
  }, [id, url]);

  return (
    <div ref={box} className="absolute inset-0">
      {src ? (
        // محسِّن next/image لا يعمل على العامل بلا إعداد، والغلاف صورةٌ في الذاكرة أصلاً
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="w-full h-full object-cover object-top" />
      ) : (
        !done && <div className="absolute inset-0 skeleton" aria-hidden />
      )}
    </div>
  );
}
