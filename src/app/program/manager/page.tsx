import { PageHeader, Card } from "@/components/ui";
import { BUDGET, MANAGER_ROUTINE, PHASES, RISKS } from "@/lib/program";

export const metadata = { title: "خطة مدير المشروع" };

export default function ManagerPlanPage() {
  return (
    <>
      <PageHeader eyebrow="رابعاً" title="خطة مدير المشروع" />
      <Card title="4-1 مراحل المشروع ومهامه">
        <div className="space-y-4">
          {PHASES.map((p) => (
            <div key={p.key} className="border-b border-line last:border-b-0 pb-4 last:pb-0">
              <div className="flex flex-wrap items-baseline gap-2 mb-1">
                <h3 className="text-base">{p.name}</h3>
                <span className="text-xs text-muted">{p.schedule}</span>
              </div>
              <ul className="list-disc ps-5 text-sm space-y-0.5 mb-2">
                {p.tasks.map((t) => <li key={t}>{t}</li>)}
              </ul>
              <div className="grid md:grid-cols-2 gap-2 text-sm">
                <div><span className="text-xs text-muted block">مؤشر الإنجاز</span>{p.indicator}</div>
                <div><span className="text-xs text-muted block">الشواهد</span>{p.evidence}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Card title="4-2 مصفوفة المتابعة الأسبوعية لمدير المشروع" className="mt-6">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>اليوم</th><th>المهمة</th><th>المدة التقديرية</th><th>الأداة</th></tr></thead>
            <tbody>
              {MANAGER_ROUTINE.map((r) => (
                <tr key={r.day}><td className="font-medium">{r.day}</td><td>{r.task}</td><td>{r.duration}</td><td>{r.tool}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title="4-3 سجل المخاطر" className="mt-6">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>الخطر</th><th>الاحتمال</th><th>الأثر</th><th>الاستجابة</th></tr></thead>
            <tbody>
              {RISKS.map((r) => (
                <tr key={r.risk}><td className="font-medium">{r.risk}</td><td>{r.likelihood}</td><td>{r.impact}</td><td>{r.response}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title="4-4 الميزانية التقديرية (الحد الأدنى)" className="mt-6">
        <p className="text-sm text-muted mb-3">{BUDGET.note}</p>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>البند</th><th>الأساس</th><th>التكلفة (ريال)</th><th>ملاحظة</th></tr></thead>
            <tbody>
              {BUDGET.items.filter((i) => !i.optional).map((i) => (
                <tr key={i.item}><td>{i.item}</td><td>{i.basis}</td><td>{i.cost}</td><td>{i.note}</td></tr>
              ))}
              <tr className="font-bold bg-paper-2"><td colSpan={2}>الإجمالي الأساسي</td><td>{BUDGET.baseTotal.toLocaleString("en")}</td><td></td></tr>
              {BUDGET.items.filter((i) => i.optional).map((i) => (
                <tr key={i.item}><td>{i.item}</td><td>{i.basis}</td><td>{i.cost}</td><td>{i.note}</td></tr>
              ))}
              <tr className="font-bold bg-paper-2"><td colSpan={2}>الإجمالي مع البنود الاختيارية</td><td>{BUDGET.fullTotal.toLocaleString("en")}</td><td></td></tr>
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
