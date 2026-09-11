/**
 * يولّد public/boot.html — مدخل التطبيق المثبَّت.
 *
 * صفحة ساكنة لا تمسّ الخادم ولا قاعدة البيانات، يخزّنها عامل الخدمة على الجهاز
 * فتُرسم مع أول لحظة، ثم تنتقل إلى لوحة المستخدم. بها تُستبدل الشاشةُ السوداء
 * التي كانت تمتد حتى تصل صفحة التطبيق من الخادم بشاشة الإقلاع بهوية المنصة.
 */
import { writeFileSync } from "node:fs";
import { bootStyle } from "../src/lib/boot-style";
import { THEME_COLORS, THEME_KEY } from "../src/lib/theme";

const HOME_KEY = "maalem-home";

const html = `<!doctype html>
<html lang="ar" dir="rtl" data-standalone="1">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="${THEME_COLORS.light}">
<title>معالم التربية</title>
<style>html,body{margin:0;height:100%;background:${THEME_COLORS.light}}
@media (prefers-color-scheme:dark){html,body{background:${THEME_COLORS.dark}}}
${bootStyle}</style>
<script>(function(){try{
var t=null;try{t=localStorage.getItem(${JSON.stringify(THEME_KEY)})}catch(e){}
if(t==="dark"||t==="light"){document.documentElement.setAttribute("data-theme",t);
document.documentElement.style.background=t==="dark"?${JSON.stringify(THEME_COLORS.dark)}:${JSON.stringify(THEME_COLORS.light)};
var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",t==="dark"?${JSON.stringify(THEME_COLORS.dark)}:${JSON.stringify(THEME_COLORS.light)})}
}catch(e){}})();</script>
</head>
<body>
<div id="boot" aria-hidden="true">
<div class="boot-mark">معالم التربية</div>
<span class="boot-rule"></span>
<div class="boot-sub">برنامج تأهيل المشرفين التربويين الجدد</div>
</div>
<script>(function(){
/* الوجهة: لوحة المستخدم كما حُفظت في آخر فتح، وإلا فمدخل المشارك — والوسيط
   يتكفّل بتحويل من كان دوره غير ذلك. ويُعلَّم أن الحركة عُرضت هنا فلا تُعاد. */
var home="/app";
try{var h=localStorage.getItem(${JSON.stringify(HOME_KEY)});if(h&&/^\\/[a-z]*$/.test(h))home=h}catch(e){}
/* لحظة ظهور الشاشة هنا، تُكمل عليها صفحةُ التطبيق المدةَ نفسها فلا تنقطع الحركة */
try{sessionStorage.setItem("maalem-boot-at",String(Date.now()))}catch(e){}
/* تُترك للمتصفح فرصة رسم الشاشة قبل الانتقال، فلا يبقى السواد مكانها */
requestAnimationFrame(function(){requestAnimationFrame(function(){
setTimeout(function(){location.replace(home+"?source=pwa")},60)})});
})();</script>
</body>
</html>`;

writeFileSync("public/boot.html", html);
console.log(`built public/boot.html (${Math.round(html.length / 1024)} KB)`);
