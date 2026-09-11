import { WORDMARK_FONT } from "@/app/boot-font";
import { THEME_COLORS } from "./theme";

/**
 * تنسيق شاشة الإقلاع كاملاً، يُدرَج في رأس الصفحة لا في ملف التنسيق.
 *
 * السبب: المتصفح لا يرسم شيئاً حتى يصل ملف التنسيق، وذلك رحلةٌ كاملة إلى
 * الخادم بعد وصول الوثيقة. فكانت الشاشة السوداء تمتد إلى ما بعدها. وبإدراجه
 * هنا — ومعه خط الشعار مصغَّراً على حروفه — تُرسم الشاشة مع أول بايت، بلا
 * طلبٍ إضافي ولا تبدّل خط.
 *
 * ولذلك لا يعتمد على متغيّرات globals.css: ألوانه صريحة، تتبع السمة بالوسيط
 * الذي يضبطه نص الإقلاع قبل أول رسم.
 */
const L = THEME_COLORS.light;
const D = THEME_COLORS.dark;

export const bootStyle = `
@font-face{font-family:BootMark;src:url(data:font/woff2;base64,${WORDMARK_FONT}) format("woff2");font-weight:700;font-style:normal;font-display:block}
#boot{position:fixed;inset:0;z-index:9999;display:none;flex-direction:column;align-items:center;justify-content:center;background:${L};color:#111111;animation:boot-out .45s ease 2.4s forwards}
#boot.boot-done{animation:boot-out .35s ease forwards}
@media (prefers-color-scheme:dark){#boot{background:${D};color:#f2f2f2}}
html[data-theme="dark"] #boot{background:${D};color:#f2f2f2}
html[data-theme="light"] #boot{background:${L};color:#111111}
html[data-standalone] #boot{display:flex}
@media (display-mode:standalone){#boot{display:flex}}
@media print{#boot{display:none!important}}
.boot-mark{font-family:BootMark,Georgia,serif;font-weight:700;font-size:clamp(1.75rem,11vw,2.75rem);line-height:1.3;opacity:0;animation:boot-rise .45s cubic-bezier(.2,.7,.3,1) .03s forwards}
.boot-rule{height:2px;width:0;background:currentColor;border-radius:2px;opacity:.85;margin:.9rem 0 .75rem;animation:boot-draw .5s cubic-bezier(.2,.7,.3,1) .22s forwards}
.boot-sub{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;font-size:.82rem;color:#737373;opacity:0;animation:boot-fade .4s ease .38s forwards}
@media (prefers-color-scheme:dark){.boot-sub{color:#8f8f8f}}
html[data-theme="dark"] .boot-sub{color:#8f8f8f}
html[data-theme="light"] .boot-sub{color:#737373}
@keyframes boot-rise{from{opacity:0;transform:translateY(.7rem)}to{opacity:1;transform:none}}
@keyframes boot-draw{to{width:min(22vw,7rem)}}
@keyframes boot-fade{to{opacity:1}}
@keyframes boot-out{to{opacity:0;visibility:hidden}}
@media (prefers-reduced-motion:reduce){.boot-mark,.boot-sub{opacity:1;animation:none}.boot-rule{width:min(22vw,7rem);animation:none}}
`.trim();
