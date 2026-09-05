import { Alert } from "./ui";

/** يعرض رسالة نجاح/خطأ من معاملات الرابط (?ok=…&err=…) */
export default function FormMessage({ ok, err }: { ok?: string; err?: string }) {
  if (err) return <Alert tone="error">{decodeURIComponent(err)}</Alert>;
  if (ok) return <Alert tone="success">{decodeURIComponent(ok)}</Alert>;
  return null;
}
