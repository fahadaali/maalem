/**
 * ينسخ عامل PDF.js إلى public/ ليُقدَّم أصلاً ثابتاً على حافة Cloudflare.
 * يُنسخ ولا يُستورد: العامل يُحمَّل بمساره من المتصفح (GlobalWorkerOptions.workerSrc)
 * لا عبر الحزم، فلا يحتاج المشروع إعداد bundler خاصاً به.
 * وتُستعمل نسخة legacy لأنها وحدها تحمل تعويضات core-js لواجهات لا تعرفها المتصفحات
 * الأقدم. أما Promise.withResolvers فتستعملها النسختان بلا تعويض، فيُعوَّض عنها في
 * PdfViewer قبل تحميل الحزمة.
 */
import { copyFileSync, statSync } from "node:fs";

const from = "node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs";
const to = "public/pdf.worker.min.mjs";
copyFileSync(from, to);
console.log(`copied ${to} (${Math.round(statSync(to).size / 1024)} KB)`);
