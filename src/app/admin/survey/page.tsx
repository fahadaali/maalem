import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Card, Progress, Empty, Stat } from "@/components/ui";
import { SURVEY_QUESTIONS } from "@/lib/program";
import { parseJSON } from "@/lib/utils";

export const metadata = { title: "نتائج الاستبانة" };

export default async function AdminSurveyPage() {
  await requireRole("ADMIN");
  const [responses, participants, done] = await Promise.all([
    db.surveyResponse.findMany({ orderBy: { createdAt: "asc" } }),
    db.user.count({ where: { role: "PARTICIPANT", active: true } }),
    db.user.count({ where: { role: "PARTICIPANT", active: true, surveyDoneAt: { not: null } } }),
  ]);
  const answers = responses.map((r) => parseJSON<Record<string, number>>(r.answers, {}));
  const avgOf = (key: string) => {
    const vals = answers.map((a) => a[key]).filter((v) => typeof v === "number");
    return vals.length ? Math.round((vals.reduce((x, y) => x + y, 0) / vals.length) * 10) / 10 : null;
  };
  const overall = (() => {
    const all = answers.flatMap((a) => Object.values(a));
    return all.length ? Math.round((all.reduce((x, y) => x + y, 0) / all.length) * 10) / 10 : null;
  })();

  return (
    <>
      <PageHeader
        title="نتائج استبانة الرضا"
        subtitle="الإجابات مجهولة المصدر ولا تُربط بأصحابها؛ يُسجَّل فقط من عبّأ ومن لم يعبّئ."
      />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
        <Stat label="الردود" value={responses.length} hint={`من ${participants} مشاركاً`} />
        <Stat label="نسبة الاستجابة" value={participants ? `${Math.round((done / participants) * 100)}%` : "—"} />
        <Stat label="متوسط الرضا العام" value={overall ?? "—"} hint="من 5" />
      </div>
      {responses.length === 0 ? (
        <Empty>لم تصل ردود بعد. يُعبّئها المشاركون من صفحة «استبانة الرضا».</Empty>
      ) : (
        <>
          <Card title="متوسط كل بند" className="mb-4">
            <div className="space-y-3">
              {SURVEY_QUESTIONS.map((q) => {
                const v = avgOf(q.key);
                return (
                  <div key={q.key}>
                    <div className="flex justify-between text-xs text-muted mb-1"><span>{q.label}</span><span>{v ?? "—"} / 5</span></div>
                    <Progress value={v ?? 0} max={5} />
                  </div>
                );
              })}
            </div>
          </Card>
          <div className="grid md:grid-cols-2 gap-4">
            <Card title="أكثر ما نفعهم">
              <ul className="text-sm space-y-2">
                {responses.filter((r) => r.liked).map((r) => <li key={r.id} className="border-b border-line pb-2 last:border-0">«{r.liked}»</li>)}
                {responses.every((r) => !r.liked) && <li className="text-muted">لا ملاحظات.</li>}
              </ul>
            </Card>
            <Card title="مقترحات التحسين">
              <ul className="text-sm space-y-2">
                {responses.filter((r) => r.improve).map((r) => <li key={r.id} className="border-b border-line pb-2 last:border-0">«{r.improve}»</li>)}
                {responses.every((r) => !r.improve) && <li className="text-muted">لا مقترحات.</li>}
              </ul>
            </Card>
          </div>
        </>
      )}
    </>
  );
}
