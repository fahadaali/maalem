import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Card, Stat, Empty } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import { deleteBudgetEntry, saveBudgetEntry } from "../actions";
import { BUDGET } from "@/lib/program";
import { cohortWhere } from "@/lib/cohort";

export const metadata = { title: "الميزانية" };

const money = (n: number) => n.toLocaleString("en") + " ريال";

export default async function BudgetPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireRole("ADMIN");
  const { ok, err } = await searchParams;
  const rows = await db.budgetEntry.findMany({ where: await cohortWhere(), orderBy: [{ order: "asc" }, { item: "asc" }] });
  const base = rows.filter((r) => !r.optional);
  const opt = rows.filter((r) => r.optional);
  const sum = (xs: typeof rows, k: "planned" | "actual") => xs.reduce((s, r) => s + (r[k] ?? 0), 0);
  const plannedBase = sum(base, "planned");
  const actualAll = sum(rows, "actual");
  const plannedAll = sum(rows, "planned");
  const spentCount = rows.filter((r) => r.actual != null).length;

  return (
    <>
      <PageHeader title="الميزانية: المقدّر مقابل الفعلي" subtitle={BUDGET.note} />
      <FormMessage ok={ok} err={err} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Stat label="الإجمالي الأساسي المقدّر" value={money(plannedBase)} />
        <Stat label="المقدّر مع الاختياري" value={money(plannedAll)} />
        <Stat label="المصروف الفعلي" value={money(actualAll)} hint={`${spentCount} بنداً مسجّلاً`} />
        <Stat label="الفرق" value={money(plannedAll - actualAll)} hint={actualAll > plannedAll ? "تجاوز" : "متبقٍّ"} />
      </div>

      {rows.length === 0 ? (
        <Empty>لم تُبذر بنود الميزانية بعد.</Empty>
      ) : (
        <div className="space-y-4">
          {[
            { title: "البنود الأساسية", data: base },
            { title: "البنود الاختيارية", data: opt },
          ].map((g) =>
            g.data.length === 0 ? null : (
              <Card key={g.title} title={g.title}>
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr><th>البند</th><th>الأساس</th><th>المقدّر</th><th>الفعلي</th><th>ملاحظة</th><th></th></tr>
                    </thead>
                    <tbody>
                      {g.data.map((r) => (
                        <tr key={r.id}>
                          <td className="font-medium">{r.item}</td>
                          <td className="text-muted text-xs whitespace-nowrap">{r.basis ?? "—"}</td>
                          <td>{r.planned.toLocaleString("en")}</td>
                          <td>
                            <form action={saveBudgetEntry} className="flex gap-1 items-center">
                              <input type="hidden" name="id" value={r.id} />
                              <input type="hidden" name="item" value={r.item} />
                              <input type="hidden" name="basis" value={r.basis ?? ""} />
                              <input type="hidden" name="planned" value={r.planned} />
                              <input type="hidden" name="note" value={r.note ?? ""} />
                              <input type="hidden" name="order" value={r.order} />
                              {r.optional && <input type="hidden" name="optional" value="on" />}
                              <input type="number" name="actual" step="0.5" min="0" className="input w-24" defaultValue={r.actual ?? ""} placeholder="—" />
                              <SubmitButton secondary className="btn-sm" pendingText="…">حفظ</SubmitButton>
                            </form>
                          </td>
                          <td className="text-muted text-xs">{r.note ?? "—"}</td>
                          <td>
                            <form action={deleteBudgetEntry}>
                              <input type="hidden" name="id" value={r.id} />
                              <button className="btn btn-ghost btn-sm text-muted">حذف</button>
                            </form>
                          </td>
                        </tr>
                      ))}
                      <tr className="font-bold bg-paper-2">
                        <td colSpan={2}>الإجمالي</td>
                        <td>{sum(g.data, "planned").toLocaleString("en")}</td>
                        <td>{sum(g.data, "actual").toLocaleString("en")}</td>
                        <td colSpan={2}></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </Card>
            ),
          )}
        </div>
      )}

      <Card title="إضافة بند" className="mt-4">
        <form action={saveBudgetEntry}>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="field"><label className="label">البند</label><input name="item" className="input" required /></div>
            <div className="field"><label className="label">الأساس</label><input name="basis" className="input" placeholder="5 نسخ × 40" /></div>
          </div>
          <div className="grid md:grid-cols-3 gap-3">
            <div className="field"><label className="label">المقدّر</label><input type="number" name="planned" className="input" step="0.5" min="0" defaultValue={0} /></div>
            <div className="field"><label className="label">الفعلي (اختياري)</label><input type="number" name="actual" className="input" step="0.5" min="0" /></div>
            <div className="field"><label className="label">الترتيب</label><input type="number" name="order" className="input" defaultValue={99} /></div>
          </div>
          <div className="field"><label className="label">ملاحظة</label><input name="note" className="input" /></div>
          <label className="flex items-center gap-2 text-sm mb-3"><input type="checkbox" name="optional" className="accent-black" /> بند اختياري</label>
          <SubmitButton>إضافة البند</SubmitButton>
        </form>
      </Card>
    </>
  );
}
