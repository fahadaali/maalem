import { PageHeader, Card } from "@/components/ui";
import { PEER_CRITERIA, RUBRIC_LEVEL_LABELS, TASK_RUBRIC, WEEKLY_REPORT_FIELDS } from "@/lib/program";

export const metadata = { title: "الملاحق والنماذج" };

export default function AppendicesPage() {
  return (
    <>
      <PageHeader eyebrow="سابعاً" title="الملاحق والنماذج" subtitle="هذه النماذج مدمجة في المنصة: التقرير الأسبوعي، وبطاقة القراءة، وسلم التقدير، وسجل الأداء، واستمارة تقييم الأقران." />
      <Card title="ملحق 1: قالب التقرير الأسبوعي للمشارك">
        <ol className="list-decimal ps-5 text-sm space-y-1">
          <li>الاسم / الأسبوع / التاريخ</li>
          {WEEKLY_REPORT_FIELDS.map((f) => <li key={f}>{f}</li>)}
        </ol>
      </Card>
      <Card title="ملحق 2: سلم تقدير المهمة الأسبوعية" className="mt-6">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>المعيار</th>{RUBRIC_LEVEL_LABELS.map((l) => <th key={l}>{l}</th>)}</tr></thead>
            <tbody>
              {TASK_RUBRIC.map((r) => (
                <tr key={r.key}><td className="font-medium">{r.criterion}</td>{r.levels.map((l) => <td key={l}>{l}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title="ملحق 3: سجل الأداء (لمدير المشروع)" className="mt-6">
        <p className="text-sm">يُحتسب آلياً في لوحة مدير المشروع: الحضور %، بطاقات القراءة، الاختبارات (متوسط)، المهام المسلمة، ساعات المعايشة، الدور القيادي، وملاحظات المتابعة.</p>
      </Card>
      <Card title="ملحق 4: بطاقة القراءة اليومية" className="mt-6">
        <p className="text-sm">اليوم، التاريخ، الكتاب، من صفحة، إلى صفحة، أهم فائدة، سؤال أطرحه في الحلقة — من الأحد إلى الخميس.</p>
      </Card>
      <Card title="ملحق 5: استمارة تقييم الأقران للدور القيادي" className="mt-6">
        <ol className="list-decimal ps-5 text-sm space-y-1">
          {PEER_CRITERIA.map((c) => <li key={c.key}>{c.label} (من 1 إلى 5)</li>)}
        </ol>
      </Card>
    </>
  );
}
