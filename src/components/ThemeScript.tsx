/**
 * يضبط السمة قبل أول رسم للصفحة، فلا تومض الواجهة البيضاء على من اختار الوضع الليلي.
 * سطر واحد يُنفَّذ قبل الترطيب، ويصمت إن كان التخزين المحلي معطّلاً.
 */
export default function ThemeScript() {
  const code = `try{var t=localStorage.getItem("maalem-theme");if(t==="dark"||t==="light")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
