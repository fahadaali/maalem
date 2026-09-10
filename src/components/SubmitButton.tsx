"use client";
import { useFormStatus } from "react-dom";
import { cn } from "@/lib/utils";

export default function SubmitButton({ children, className, pendingText = "جارٍ الحفظ…", secondary, ghost }: { children: React.ReactNode; className?: string; pendingText?: string; secondary?: boolean; ghost?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={cn("btn", secondary && "btn-secondary", ghost && "btn-ghost", className)}>
      {pending ? pendingText : children}
    </button>
  );
}
