import { themeBootScript } from "@/lib/theme";

/**
 * يضبط السمة ولون شريط حالة النظام قبل أول رسم، فلا تومض الواجهة البيضاء
 * على من اختار الوضع الليلي، ولا يبقى شريط الحالة مخالفاً للون التطبيق.
 */
export default function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />;
}
