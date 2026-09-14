"use client";
import dynamic from "next/dynamic";

/**
 * يُحمَّل العارض في المتصفح وحده.
 *
 * `PdfViewer` مكوّن عميل، لكن Next يصيّره على الخادم أيضاً ليكتب أول رسمة —
 * فكانت حزمة PDF.js (نحو 145 كيلوبايت مضغوطة) تُبنى داخل حزمة العامل ولا سبيل
 * إلى تشغيلها هناك: لا canvas ولا عامل مساعد على Workers. وحزمة العامل قريبة من
 * سقف Cloudflare، فإخراجُها يوسّع الفسحة ولا يغيّر ما يراه المشارك.
 */
const PdfViewer = dynamic(() => import("./PdfViewer"), {
  ssr: false,
  loading: () => <p className="p-6 text-center text-sm text-muted">جارٍ فتح الملف…</p>,
});

export default PdfViewer;
