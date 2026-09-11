import Link from "@/components/Link";
import { Card, Empty, Badge } from "@/components/ui";
import type { Hit } from "@/lib/search";

/** نتائج البحث مجموعةً بحسب مصدرها */
export default function SearchResults({ hits, term }: { hits: Hit[]; term: string }) {
  if (term.trim().length < 2) return <Empty>اكتب حرفين فأكثر للبحث.</Empty>;
  if (!hits.length) return <Empty>لا نتائج لـ «{term}».</Empty>;

  const groups = new Map<string, Hit[]>();
  for (const h of hits) groups.set(h.group, [...(groups.get(h.group) ?? []), h]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">{hits.length} نتيجة في {groups.size} موضعاً.</p>
      {[...groups.entries()].map(([group, rows]) => (
        <Card key={group} title={group} action={<Badge tone="soft">{rows.length}</Badge>}>
          <ul className="divide-y divide-line m-0 p-0 list-none">
            {rows.map((h, i) => (
              <li key={`${h.href}-${i}`} className="py-2">
                <Link href={h.href} className="hover:underline font-medium">{h.title}</Link>
                {h.meta && <span className="text-xs text-muted ms-2">{h.meta}</span>}
                {h.snippet && <p className="text-sm text-muted mt-0.5">{h.snippet}</p>}
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}
