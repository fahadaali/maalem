/**
 * ينسخ ما يحتاجه عارض PDF من الحزمة إلى public/ ليُقدَّم أصولاً ثابتة على حافة Cloudflare.
 *
 * العامل يُنسخ ولا يُستورد: يُحمَّل بمساره من المتصفح (GlobalWorkerOptions.workerSrc) لا عبر
 * الحزم، فلا يحتاج المشروع إعداد bundler خاصاً به. وتُستعمل نسخة legacy لأنها وحدها تحمل
 * تعويضات core-js لواجهات لا تعرفها المتصفحات الأقدم.
 *
 * ومعه ثلاثة مجلدات لا يقرأ الملفَّ على حقيقته بدونها — وقيمها الافتراضية في PDF.js هي null،
 * فما لم تُنسخ وتُمرَّر إلى getDocument بقي العارض يخمّن:
 *   cmaps          — خرائط ترميز خطوط CID. بدونها يُقرأ النص العربي بخريطة خاطئة فتنقلب
 *                    حروفه وتتبعثر كلماته، وهو أشيع خطوط الكتب المصنوعة ببرامج النشر.
 *   standard_fonts — بدائل الخطوط الأربعة عشر القياسية حين لا تكون مضمَّنة في الملف.
 *   wasm           — فكّ JBIG2 وJPEG2000 وإدارة الألوان في الصفحات الممسوحة.
 *
 * والمسار مؤرَّخ بإصدار الحزمة، فيُخزَّن في المتصفح عاماً كاملاً ويسقط تخزينه من نفسه عند
 * ترقيتها — بلا بصمة محتوى ولا إبطال يدوي.
 */
import { copyFileSync, cpSync, mkdirSync, readFileSync, rmSync, statSync } from "node:fs";

const { version } = JSON.parse(readFileSync("node_modules/pdfjs-dist/package.json", "utf8"));
const root = `public/pdf/${version}`;

copyFileSync("node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs", "public/pdf.worker.min.mjs");
console.log(`copied public/pdf.worker.min.mjs (${Math.round(statSync("public/pdf.worker.min.mjs").size / 1024)} KB)`);

// يُمسح ما تحت public/pdf كله: نسخةٌ قديمة باقية تُرفع مع الأصول بلا فائدة
rmSync("public/pdf", { recursive: true, force: true });
mkdirSync(root, { recursive: true });
for (const dir of ["cmaps", "standard_fonts", "wasm"]) {
  cpSync(`node_modules/pdfjs-dist/${dir}`, `${root}/${dir}`, { recursive: true });
  console.log(`copied ${root}/${dir}`);
}
