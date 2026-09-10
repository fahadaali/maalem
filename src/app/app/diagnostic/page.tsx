import { requireParticipantView } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Card, Alert, Progress } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import { saveDiagnostic } from "../actions";
import { COMPETENCIES } from "@/lib/program";
import { currentWeekNumber } from "@/lib/weeks";
import { parseJSON } from "@/lib/utils";

export const metadata = { title: "التقييم التشخيصي" };

const LEVELS = ["1 مبتدئ", "2 أساسي", "3 متوسط", "4 جيد", "5 متمكّن"];

export default async function DiagnosticPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const user = await requireParticipantView();
  const { ok, err } = await searchParams;
  const [rows, weekNo] = await Promise.all([
    db.diagnostic.findMany({ where: { userId: user.id } }),
    currentWeekNumber(),
  ]);
  const pre = rows.find((r) => r.stage === "PRE");
  const post = rows.find((r) => r.stage === "POST");
  // القبلي في بداية البرنامج، والبعدي من الأسبوع 12 فصاعداً
  const stage = !pre ? "PRE" : weekNo >= 12 && !post ? "POST" : null;
  const scoresOf = (r?: { scores: string }) => (r ? parseJSON<Record<string, number>>(r.scores, {}) : null);
  const preScores = scoresOf(pre);
  const postScores = scoresOf(post);

  return (
    <>
      <PageHeader
        title="التقييم التشخيصي"
        subtitle="قياس ذاتي لمستواك في الكفاءات الثماني: مرة قبل البرنامج ومرة في ختامه، ليتبيّن أثر البرنامج عليك. لا يدخل في درجاتك."
      />
      <FormMessage ok={ok} err={err} />

      {(preScores || postScores) && (
        <Card title="نتيجتك" className="mb-4">
          <div className="space-y-3">
            {COMPETENCIES.map((c) => (
              <div key={c.slug}>
                <div className="flex justify-between text-xs text-muted mb-1">
                  <span>{c.name}</span>
                  <span>
                    قبل: {preScores?.[c.slug] ?? "—"}
                    {postScores ? ` · بعد: ${postScores[c.slug]}` : ""}
                    {preScores && postScores ? ` · الفرق ${postScores[c.slug] - preScores[c.slug] >= 0 ? "+" : ""}${postScores[c.slug] - preScores[c.slug]}` : ""}
                  </span>
                </div>
                <Progress value={(postScores ?? preScores)?.[c.slug] ?? 0} max={5} />
              </div>
            ))}
          </div>
        </Card>
      )}

      {stage ? (
        <Card title={stage === "PRE" ? "التقييم القبلي" : "التقييم البعدي"}>
          <form action={saveDiagnostic}>
            <input type="hidden" name="stage" value={stage} />
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>الكفاءة</th>{LEVELS.map((l) => <th key={l} className="text-center whitespace-nowrap">{l}</th>)}</tr>
                </thead>
                <tbody>
                  {COMPETENCIES.map((c) => (
                    <tr key={c.slug}>
                      <td className="whitespace-nowrap">{c.name} <span className="text-muted text-xs">{c.weight}%</span></td>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <td key={n} className="text-center">
                          <input type="radio" name={c.slug} value={n} required className="accent-black" />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="field mt-4">
              <label className="label">ما الذي تتطلع إلى اكتسابه؟ (اختياري)</label>
              <textarea name="notes" className="textarea" />
            </div>
            <SubmitButton>حفظ التقييم</SubmitButton>
          </form>
        </Card>
      ) : (
        <Alert>{post ? "اكتمل التقييمان القبلي والبعدي." : "التقييم البعدي يُفتح في الأسبوع 12 من البرنامج."}</Alert>
      )}
    </>
  );
}
