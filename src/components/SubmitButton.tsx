"use client";
import { useFormStatus } from "react-dom";
import { cn } from "@/lib/utils";

export default function SubmitButton({ children, className, pendingText = "جارٍ الحفظ…", secondary }: { children: React.ReactNode; className?: string; pendingText?: string; secondary?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={cn("btn", secondary && "btn-secondary", className)}>
      {pending ? pendingText : children}
    </button>
  );
}
