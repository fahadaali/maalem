import Link from "@/components/Link";
import { Card, Empty } from "@/components/ui";
import type { HelpItemView } from "@/lib/help";

/** أسئلة المساعدة وأجوبتها كما يراها صاحب الدور: سؤالٌ وجواب ورابطٌ داخل المنصة */
export default function HelpList({ items }: { items: HelpItemView[] }) {
  if (!items.length) return <Empty>لم تُضف أسئلة بعد.</Empty>;
  return (
    <Card>
      <dl className="divide-y divide-line m-0">
        {items.map((x) => (
          <div key={x.id} className="py-3 first:pt-0 last:pb-0">
            <dt className="font-medium">{x.question}</dt>
            <dd className="text-sm text-ink-2 mt-1">
              {x.answer}
              {x.href && <> <Link href={x.href} className="underline">{x.hrefLabel ?? "افتح"}</Link>.</>}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
