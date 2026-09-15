"use client";
import { useFormStatus } from "react-dom";
import { cn } from "@/lib/utils";

export default function SubmitButton({ children, className, pendingText = "جارٍ الحفظ…", secondary, ghost, confirm }: { children: React.ReactNode; className?: string; pendingText?: string; secondary?: boolean; ghost?: boolean; confirm?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn("btn", secondary && "btn-secondary", ghost && "btn-ghost", className)}
      /* سؤال قبل ما لا يُستدرَك بضغطة: إن رفض المدير لم يُرسَل النموذج */
      onClick={confirm ? (e) => { if (!window.confirm(confirm)) e.preventDefault(); } : undefined}
    >
      {pending ? pendingText : children}
    </button>
  );
}
