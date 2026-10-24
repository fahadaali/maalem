import { Alert } from "./ui";
import FlashToast from "./FlashToast";

/** يعرض رسالة نجاح/خطأ من معاملات الرابط (?ok=…&err=…) */
/** المعامل يصل مفكوكاً أصلاً؛ فكّه ثانيةً كان يرمي عند أي علامة % في النص فتسقط الصفحة */
function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** والرسالة تتكرّر عائمةً في ذيل الشاشة إن لم تكن ظاهرة (`FlashToast`) */
export default function FormMessage({ ok, err }: { ok?: string; err?: string }) {
  const tone = err ? "error" : ok ? "success" : null;
  if (!tone) return null;
  const message = safeDecode((err ?? ok)!);
  return (
    <div id="form-message">
      <Alert tone={tone}>{message}</Alert>
      {/* مفتاحٌ لكل تصيير: رسالةٌ تتكرّر بنصّها بعد إجراءٍ ثانٍ تُعرض من جديد، لا يبقيها React مركَّبةً بأثرها الأول */}
      <FlashToast key={Date.now()} tone={tone} message={message} anchorId="form-message" />
    </div>
  );
}
