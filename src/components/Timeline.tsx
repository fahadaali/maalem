import Link from "next/link";
import { Empty } from "@/components/ui";
import { formatDateTime } from "@/lib/dates";
import type { Entry } from "@/lib/timeline";

/** سجل النشاط: بند لكل حدث، مرتباً من الأحدث */
export default function Timeline({ entries }: { entries: Entry[] }) {
  if (!entries.length) return <Empty>لا نشاط مسجَّل بعد.</Empty>;
  return (
    <ol className="relative m-0 p-0 list-none ps-4 border-s border-line">
      {entries.map((e, i) => (
        <li key={i} className="relative pb-4 last:pb-0">
          <span className="absolute -start-[21px] top-1.5 w-2 h-2 rounded-full bg-ink" aria-hidden />
          <div className="text-xs text-muted">{formatDateTime(e.at)} · {e.kind}</div>
          <div className="text-sm font-medium">
            {e.href ? <Link href={e.href} className="hover:underline">{e.title}</Link> : e.title}
          </div>
          {e.detail && <div className="text-sm text-muted whitespace-pre-wrap">{e.detail}</div>}
        </li>
      ))}
    </ol>
  );
}
