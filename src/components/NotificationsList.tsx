import Link from "next/link";
import { Empty } from "@/components/ui";
import { formatDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";

export default function NotificationsList({ items }: { items: { id: string; title: string; body: string; url: string | null; readAt: Date | null; createdAt: Date }[] }) {
  if (items.length === 0) return <Empty>لا توجد إشعارات.</Empty>;
  return (
    <ul className="space-y-2">
      {items.map((n) => {
        const inner = (
          <>
            <div className="flex justify-between gap-2">
              <div className={cn("font-medium", !n.readAt && "font-bold")}>{n.title}</div>
              {!n.readAt && <span className="w-2 h-2 rounded-full bg-ink mt-2 shrink-0" />}
            </div>
            <div className="text-sm text-ink-2 mt-0.5">{n.body}</div>
            <div className="text-xs text-muted mt-1">{formatDateTime(n.createdAt)}</div>
          </>
        );
        return (
          <li key={n.id}>
            {n.url ? (
              <Link href={n.url} className={cn("card block hover:bg-paper-2", !n.readAt && "border-ink")}>{inner}</Link>
            ) : (
              <div className={cn("card", !n.readAt && "border-ink")}>{inner}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
