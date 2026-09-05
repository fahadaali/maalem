import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Card, Progress } from "@/components/ui";
import { toggleChecklist } from "../actions";
import { PHASES, RISKS } from "@/lib/program";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const metadata = { title: "مراحل المشروع" };

export default async function PhasesPage() {
  await requireRole("ADMIN");
  const items = await db.checklistItem.findMany();
  const done = (group: string, order: number) => items.find((i) => i.group === group && i.order === order)?.done ?? false;
  return (
    <>
      <PageHeader title="مراحل المشروع ومهامه" subtitle="قوائم تحقق مراحل خطة مدير المشروع: التهيئة، والانطلاق، والتنفيذ والمتابعة، ومشروع التخرج، والتقويم والإغلاق." />
      <div className="space-y-4">
        {PHASES.map((p) => {
          const count = p.tasks.filter((_, i) => done(p.key, i)).length;
          return (
            <Card key={p.key} title={p.name} action={<span className="text-xs text-muted">{p.schedule}</span>}>
              <Progress value={count} max={p.tasks.length} label={`${count} من ${p.tasks.length}`} />
              <ul className="mt-3 space-y-1">
                {p.tasks.map((t, i) => {
                  const d = done(p.key, i);
                  return (
                    <li key={t}>
                      <form action={toggleChecklist}>
                        <input type="hidden" name="group" value={p.key} />
                        <input type="hidden" name="order" value={i} />
                        <button className={cn("w-full text-start flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-paper-2 text-sm", d && "text-muted line-through")}>
                          <span className={cn("w-5 h-5 rounded border flex items-center justify-center shrink-0", d ? "bg-ink border-ink text-paper" : "border-line-2")}>{d && <Check size={14} />}</span>
                          {t}
                        </button>
                      </form>
                    </li>
                  );
                })}
              </ul>
              <div className="grid md:grid-cols-2 gap-2 text-xs text-muted mt-3">
                <div><span className="block font-medium text-ink-2">مؤشر الإنجاز</span>{p.indicator}</div>
                <div><span className="block font-medium text-ink-2">الشواهد</span>{p.evidence}</div>
              </div>
            </Card>
          );
        })}
        <Card title="سجل المخاطر">
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>الخطر</th><th>الاحتمال</th><th>الأثر</th><th>الاستجابة</th></tr></thead>
              <tbody>{RISKS.map((r) => <tr key={r.risk}><td>{r.risk}</td><td>{r.likelihood}</td><td>{r.impact}</td><td>{r.response}</td></tr>)}</tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
