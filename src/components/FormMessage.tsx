import { Alert } from "./ui";

/** يعرض رسالة نجاح/خطأ من معاملات الرابط (?ok=…&err=…) */
/** المعامل يصل مفكوكاً أصلاً؛ فكّه ثانيةً كان يرمي عند أي علامة % في النص فتسقط الصفحة */
function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

export default function FormMessage({ ok, err }: { ok?: string; err?: string }) {
  if (err) return <Alert tone="error">{safeDecode(err)}</Alert>;
  if (ok) return <Alert tone="success">{safeDecode(ok)}</Alert>;
  return null;
}
