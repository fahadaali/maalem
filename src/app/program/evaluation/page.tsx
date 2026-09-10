import { PageHeader, Card } from "@/components/ui";
import { PROJECT_DESCRIPTION } from "@/lib/program";
import { getCompletionLevels, getContinuous, getProjectRubric } from "@/lib/content";

export const metadata = { title: "نظام التقويم" };

export default async function EvaluationPage() {
  const [continuous, project, levels] = await Promise.all([getContinuous(), getProjectRubric(), getCompletionLevels()]);
  const contTotal = continuous.reduce((s, c) => s + c.points, 0);
  const projTotal = project.reduce((s, r) => s + r.points, 0);
  return (
    <>
      <PageHeader eyebrow="5-4" title="نظام التقويم" subtitle={`تقييم مستمر (${contTotal} درجة) + مشروع تخرج تطبيقي (${projTotal} درجة)`} />
      <Card title={`أ. التقييم المستمر (${contTotal} درجة)`}>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>المكوّن</th><th>الدرجة</th><th>أداة القياس</th><th>الحد الأدنى للقبول</th></tr></thead>
            <tbody>
              {continuous.map((c) => (
                <tr key={c.key}><td className="font-medium">{c.label}</td><td>{c.points}</td><td>{c.tool}</td><td>{c.minimum}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title={`ب. مشروع التخرج التطبيقي (${projTotal} درجة)`} className="mt-6">
        <p className="text-sm mb-4">{PROJECT_DESCRIPTION}</p>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>معيار التحكيم</th><th>الدرجة</th><th>الوصف</th></tr></thead>
            <tbody>
              {project.map((r) => (
                <tr key={r.key}><td className="font-medium">{r.label}</td><td>{r.points}</td><td>{r.description}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title="ج. مستويات الإتمام" className="mt-6">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>المجموع من {contTotal + projTotal}</th><th>المستوى</th><th>الوثيقة</th></tr></thead>
            <tbody>
              {levels.map((l, i) => (
                <tr key={l.level}>
                  <td>{i === 0 ? `${l.min} فأكثر` : i === levels.length - 1 ? `أقل من ${levels[i - 1].min}` : `${l.min} – ${levels[i - 1].min - 1}`}</td>
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
