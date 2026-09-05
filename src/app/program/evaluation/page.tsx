import { PageHeader, Card } from "@/components/ui";
import { COMPLETION_LEVELS, CONTINUOUS_ASSESSMENT, PROJECT_DESCRIPTION, PROJECT_RUBRIC } from "@/lib/program";

export const metadata = { title: "نظام التقويم" };

export default function EvaluationPage() {
  return (
    <>
      <PageHeader eyebrow="5-4" title="نظام التقويم" subtitle="تقييم مستمر (70 درجة) + مشروع تخرج تطبيقي (30 درجة)" />
      <Card title="أ. التقييم المستمر (70 درجة)">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>المكوّن</th><th>الدرجة</th><th>أداة القياس</th><th>الحد الأدنى للقبول</th></tr></thead>
            <tbody>
              {CONTINUOUS_ASSESSMENT.map((c) => (
                <tr key={c.key}><td className="font-medium">{c.component}</td><td>{c.points}</td><td>{c.tool}</td><td>{c.minimum}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title="ب. مشروع التخرج التطبيقي (30 درجة)" className="mt-6">
        <p className="text-sm mb-4">{PROJECT_DESCRIPTION}</p>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>معيار التحكيم</th><th>الدرجة</th><th>الوصف</th></tr></thead>
            <tbody>
              {PROJECT_RUBRIC.map((r) => (
                <tr key={r.key}><td className="font-medium">{r.criterion}</td><td>{r.points}</td><td>{r.description}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title="ج. مستويات الإتمام" className="mt-6">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>المجموع من 100</th><th>المستوى</th><th>الوثيقة</th></tr></thead>
            <tbody>
              {COMPLETION_LEVELS.map((l, i) => (
                <tr key={l.level}>
                  <td>{i === 0 ? "90 فأكثر" : i === COMPLETION_LEVELS.length - 1 ? "أقل من 60" : `${l.min} – ${COMPLETION_LEVELS[i - 1].min - 1}`}</td>
                  <td className="font-medium">{l.level}</td>
                  <td>{l.certificate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
