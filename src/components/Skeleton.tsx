import { cn } from "@/lib/utils";

/**
 * مستطيل رمادي نابض يحجز مكان المحتوى ريثما يصل.
 * يُستعمل داخل حدود Suspense في الصفحة نفسها، لا في loading.tsx على مستوى المسار:
 * حدّ التحميل على مستوى المسار يُفرغ الصفحة بعد أي إجراء خادم يُعيد التوجيه إليها.
 */
export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <span className={cn("skeleton", className)} style={style} aria-hidden />;
}
