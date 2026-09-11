/**
 * يولّد شاشات الإقلاع لتطبيق iOS المثبَّت (apple-touch-startup-image).
 *
 * لماذا هنا لا في الصفحة: المدة التي يشكو منها المستخدم تسبق وصول أول بايت من
 * الوثيقة، فلا تستطيع شاشةٌ داخل الوثيقة تغطيتها — هي نفسها لم تصل بعد.
 * الذي يغطيها هو ما يعرضه النظام قبل أن يبدأ التصفح: شاشة الإقلاع.
 * أندرويد يبنيها من الـ manifest، وiOS لا يعرض شيئاً ما لم تُقدَّم صورة بمقاس
 * الجهاز بالضبط — وإلا فشاشة بيضاء.
 *
 * يُشغَّل عند تغيّر الهوية فقط:  node scripts/startup-images.mjs
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";

/** [عرض CSS، ارتفاع CSS، كثافة البكسل] — أجهزة آيفون وآيباد المتداولة */
const DEVICES = [
  [320, 568, 2], [375, 667, 2], [375, 812, 3], [390, 844, 3], [393, 852, 3],
  [402, 874, 3], [414, 736, 3], [414, 896, 2], [414, 896, 3], [428, 926, 3],
  [430, 932, 3], [440, 956, 3], [744, 1133, 2], [768, 1024, 2], [810, 1080, 2],
  [820, 1180, 2], [834, 1112, 2], [834, 1194, 2], [834, 1210, 2], [1024, 1366, 2],
  [1032, 1376, 2],
];

const font = readFileSync("src/app/fonts/ThmanyahSerifDisplay-Bold.woff2").toString("base64");

const html = (w, h, dark) => `<!doctype html><html dir="rtl"><head><meta charset="utf-8"><style>
@font-face{font-family:Thmanyah;src:url(data:font/woff2;base64,${font}) format("woff2");font-display:block}
html,body{margin:0;height:100%}
body{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${Math.round(h * 0.014)}px;
  background:${dark ? "#0f0f0f" : "#ffffff"};color:${dark ? "#f2f2f2" : "#111111"}}
.w{font-family:Thmanyah,Georgia,serif;font-weight:700;font-size:${Math.round(Math.min(w * 0.115, 68))}px;line-height:1.3}
.r{height:2px;width:${Math.round(w * 0.2)}px;background:currentColor;border-radius:2px;opacity:.85}
.t{font-family:system-ui,-apple-system,sans-serif;font-size:${Math.round(Math.min(w * 0.033, 17))}px;
  color:${dark ? "#8f8f8f" : "#737373"}}
</style></head><body>
<div class="w">معالم التربية</div><div class="r"></div>
<div class="t">برنامج تأهيل المشرفين التربويين الجدد</div>
</body></html>`;

const browser = await chromium.launch();
mkdirSync("public/splash", { recursive: true });
const out = [];
let bytes = 0;
// الوضعان الرأسي والأفقي: iOS لا يعرض شيئاً إن لم يطابق الاتجاه أيضاً
for (const [dw, dh, s] of DEVICES) {
  for (const o of ["portrait", "landscape"]) {
    const [w, h] = o === "portrait" ? [dw, dh] : [dh, dw];
    for (const dark of [false, true]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: s });
      const p = await ctx.newPage();
      await p.setContent(html(w, h, dark), { waitUntil: "load" });
      await p.evaluate(() => document.fonts.ready);
      const name = `${w}x${h}-${s}x${dark ? "-dark" : ""}.png`;
      const buf = await p.screenshot({ type: "png" });
      writeFileSync(`public/splash/${name}`, buf);
      bytes += buf.length;
      await ctx.close();
      out.push({ w: dw, h: dh, s, o, dark, name });
    }
  }
}
await browser.close();
writeFileSync("src/app/startup-images.json", JSON.stringify(out, null, 2) + "\n");
console.log(`generated ${out.length} startup images · ${Math.round(bytes / 1024)} KB total`);
