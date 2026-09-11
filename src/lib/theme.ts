/** ألوان شريط حالة النظام لكل سمة — مطابقة لخلفية الصفحة في globals.css */
export const THEME_COLORS = { light: "#ffffff", dark: "#0f0f0f" } as const;

export const THEME_KEY = "maalem-theme";

/**
 * نص يُنفَّذ قبل أول رسم: يضبط السمة ولون شريط الحالة معاً.
 *
 * لمَ لا يكفي وسم theme-color المشروط بـ prefers-color-scheme: لأنه يتبع تفضيل
 * النظام وحده، فمن كان جهازه فاتحاً واختار الوضع الليلي داخل التطبيق يبقى شريط
 * الحالة أبيض فوق واجهة سوداء — شريطٌ مقصوص أعلى الشاشة. فتُزال النسخ المشروطة
 * ويوضع وسم واحد يتبع السمة المطبَّقة فعلاً.
 */
export const themeBootScript = `(function(){try{
var K=${JSON.stringify(THEME_KEY)},C=${JSON.stringify(THEME_COLORS)};
var t=null;try{t=localStorage.getItem(K)}catch(e){}
var explicit=(t==="dark"||t==="light")?t:null;
if(explicit)document.documentElement.setAttribute("data-theme",explicit);
var dark=explicit?explicit==="dark":(window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches);
/* الوسم موجود في الوثيقة من الخادم، فيُضبط محتواه ولا يُنشأ هنا: إنشاؤه أو
   حذفه قبل الترطيب يجعل رأس الصفحة مخالفاً لما صيّره الخادم، فيرمي React خطأ
   ترطيب ويعيد رسم الصفحة كلها. وأما تغيير قيمة السمة فمأذون بـ suppressHydrationWarning. */
var metas=document.querySelectorAll('meta[name="theme-color"][media]');
for(var i=0;i<metas.length;i++){metas[i].remove()}
var m=document.querySelector('meta[name="theme-color"]:not([media])');
if(!m){m=document.createElement("meta");m.setAttribute("name","theme-color");document.head.appendChild(m)}
m.setAttribute("content",dark?C.dark:C.light);
/* التطبيق المثبَّت: يُعلَّم قبل أول رسم لتظهر شاشة الإقلاع معه لا بعده.
   يُسأل عن الوضع القياسي وعن علم iOS القديم معاً، فبعض إصدارات iOS لا تجيب الأول. */
var sa=(window.matchMedia&&window.matchMedia("(display-mode: standalone)").matches)||window.navigator.standalone===true;
if(sa)document.documentElement.setAttribute("data-standalone","1");
}catch(e){}})();`;
