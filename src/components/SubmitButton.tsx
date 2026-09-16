"use client";
import { useFormStatus } from "react-dom";
import { cn } from "@/lib/utils";

/**
 * `label`: اسمٌ للزرّ حين يكون وجهه أيقونةً وحدها — كزرّ الحذف في شريط البطاقة.
 * الأيقونة لا تُقرأ بقارئ الشاشة ولا تظهر في التلميح، فبدونه زرٌّ بلا اسم.
 */
export default function SubmitButton({ children, className, pendingText = "جارٍ الحفظ…", secondary, ghost, confirm, label }: { children: React.ReactNode; className?: string; pendingText?: string; secondary?: boolean; ghost?: boolean; confirm?: string; label?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn("btn", secondary && "btn-secondary", ghost && "btn-ghost", className)}
      aria-label={label}
      title={label}
      /* سؤال قبل ما لا يُستدرَك بضغطة: إن رفض المدير لم يُرسَل النموذج */
      onClick={confirm ? (e) => { if (!window.confirm(confirm)) e.preventDefault(); } : undefined}
    >
      {pending ? pendingText : children}
    </button>
  );
}
