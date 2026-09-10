import { requireParticipantView } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Card, Alert } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import { submitSurvey } from "../actions";
import { SURVEY_QUESTIONS, SURVEY_SCALE } from "@/lib/program";

export const metadata = { title: "استبانة الرضا" };

export default async function SurveyPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const user = await requireParticipantView();
  const { ok, err } = await searchParams;
  const me = await db.user.findUnique({ where: { id: user.id }, select: { surveyDoneAt: true } });

  return (
    <>
      <PageHeader
        title="استبانة رضا المشاركين"
        subtitle="تُعبَّأ في ختام البرنامج، وتُعين على تحسين الدفعة القادمة."
      />
      <FormMessage ok={ok} err={err} />
      <Alert>
        <span className="font-medium">مجهولة المصدر:</span> تُحفظ إجاباتك بلا اسمك ولا معرّفك، ولا يستطيع مدير المشروع ربطها بك.
        ولا يُسجَّل إلا أنك عبّأتها، حتى لا تُطالَب بها مرة أخرى.
      </Alert>
      {me?.surveyDoneAt ? (
        <Card><p className="text-sm">شكراً لك، سُجّلت إجابتك. جزاك الله خيراً.</p></Card>
      ) : (
        <Card>
          <form action={submitSurvey}>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>البند</th>{SURVEY_SCALE.map((s) => <th key={s} className="text-center whitespace-nowrap">{s}</th>)}</tr>
                </thead>
                <tbody>
                  {SURVEY_QUESTIONS.map((q) => (
                    <tr key={q.key}>
                      <td>{q.label}</td>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <td key={n} className="text-center"><input type="radio" name={q.key} value={n} required className="accent-black" /></td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="field mt-4">
              <label className="label">أكثر ما نفعك في البرنامج</label>
              <textarea name="liked" className="textarea" rows={3} />
            </div>
            <div className="field">
              <label className="label">ما الذي تقترح تحسينه في الدفعة القادمة؟</label>
              <textarea name="improve" className="textarea" rows={3} />
            </div>
            <SubmitButton>إرسال الاستبانة</SubmitButton>
          </form>
        </Card>
      )}
    </>
  );
}
