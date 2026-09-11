import { cn } from "@/lib/utils";

/** مستطيل رمادي نابض يحجز مكان المحتوى ريثما يصل */
export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <span className={cn("skeleton", className)} style={style} aria-hidden />;
}

/** هيكل صفحة كامل: ترويسة وبطاقات، يُعرض أثناء انتقال المسار */
export default function PageSkeleton({ cards = 3, stats = 0 }: { cards?: number; stats?: number }) {
  return (
    <div role="status" aria-label="جارٍ التحميل">
      <div className="mb-6">
        <Skeleton className="h-7 w-56 mb-2" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>
      {stats > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {Array.from({ length: stats }).map((_, i) => (
            <div key={i} className="card">
              <Skeleton className="h-3 w-20 mb-2" />
              <Skeleton className="h-7 w-16" />
            </div>
          ))}
        </div>
      )}
      <div className="space-y-4">
        {Array.from({ length: cards }).map((_, i) => (
          <div key={i} className="card">
            <Skeleton className="h-5 w-40 mb-3" />
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-5/6 mb-2" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ))}
      </div>
      <span className="sr-only">جارٍ التحميل…</span>
    </div>
  );
}
