import Link from "@/components/Link";
import { BookOpen } from "lucide-react";
import { titleFromFilename } from "@/lib/files";

export type ResumeItem = { id: string; name: string; page: number; pages: number };

/**
 * «تابع القراءة»: آخرُ ما قرأه المشارك وأين وقف فيه.
 *
 * بابُه هنا لأنّ ما يُحفظ في حسابه لا يُعرف إن لم يُعرض: من قرأ على جهازٍ ثم
 * جلس إلى آخر لا يدري أن المنصة تحفظ له موضعه حتى يراه مكتوباً.
 */
export default function ResumeReading({ items, from }: { items: ResumeItem[]; from: string }) {
  if (items.length === 0) return null;
  return (
    <section className="mb-6">
      <h2 className="text-sm text-muted mb-2 flex items-center gap-1.5">
        <BookOpen size={15} /> تابع القراءة
      </h2>
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2">
        {items.map((it) => {
          // النسبةُ من الموضع إلى عدد الصفحات، ولا تبلغ صفراً فيبدو الشريط فارغاً لمن بدأ
          const pct = Math.min(100, Math.max(2, Math.round((it.page / it.pages) * 100)));
          return (
            <Link
              key={it.id}
              href={`/file/${it.id}?from=${encodeURIComponent(from)}`}
              className="card p-3 block hover:bg-paper-2"
            >
              <div className="font-medium text-sm truncate">{titleFromFilename(it.name)}</div>
              <div className="text-xs text-muted mt-0.5 tabular-nums">صفحة {it.page} من {it.pages} · {pct}٪</div>
              <div className="mt-2 h-1 rounded-full bg-line overflow-hidden">
                <div className="h-full bg-ink" style={{ width: `${pct}%` }} />
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
