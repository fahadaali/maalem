import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Card, Badge, Empty } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import QuestionFields from "@/components/QuestionFields";
import { addBankQuestion, deleteBankQuestion } from "../actions";
import { cohortWhere } from "@/lib/cohort";
import { getActiveWeeks } from "@/lib/weeks";
import { QUESTION_KINDS, QUIZ_TOPICS } from "@/lib/quiz";
import { parseJSON } from "@/lib/utils";
import { Trash2 } from "lucide-react";

export const metadata = { title: "بنك الأسئلة" };

export default async function BankPage({ searchParams }: { searchParams: Promise<{ topic?: string; ok?: string; err?: string }> }) {
  await requireRole("ADMIN");
  const sp = await searchParams;
  const topic = sp.topic && sp.topic in QUIZ_TOPICS ? sp.topic : undefined;
  const [rows, weeks] = await Promise.all([
    db.bankQuestion.findMany({ where: { ...(await cohortWhere()), ...(topic ? { topic } : {}) }, orderBy: { createdAt: "desc" } }),
    getActiveWeeks(),
  ]);

  return (
    <>
      <PageHeader
        title="بنك الأسئلة"
        subtitle="أسئلة محفوظة تُنسخ إلى أي اختبار بضغطة، فلا يُعاد كتابتها كل أسبوع. ثلاثة أنواع: اختيار من متعدد، وصواب وخطأ، وإجابة قصيرة تُصحَّح آلياً."
      />
      <FormMessage ok={sp.ok} err={sp.err} />
      <div className="flex gap-1 mb-4 flex-wrap">
        <a href="/admin/bank" className={`badge ${!topic ? "badge-ink" : ""}`}>الكل ({rows.length})</a>
        {Object.entries(QUIZ_TOPICS).map(([k, v]) => (
          <a key={k} href={`/admin/bank?topic=${k}`} className={`badge ${topic === k ? "badge-ink" : ""}`}>{v}</a>
        ))}
      </div>

      <div className="grid md:grid-cols-[1fr_380px] gap-4 items-start">
        <div className="space-y-3">
          {rows.length === 0 ? <Empty>لا أسئلة في البنك بعد.</Empty> : rows.map((q) => {
            const opts = parseJSON<string[]>(q.options, []);
            return (
              <Card key={q.id}>
                <div className="flex justify-between gap-2">
                  <div className="font-medium">{q.text}</div>
                  <form action={deleteBankQuestion}>
                    <input type="hidden" name="id" value={q.id} />
                    <button className="btn btn-ghost btn-sm" aria-label="حذف السؤال"><Trash2 size={14} /></button>
                  </form>
                </div>
                <div className="flex gap-1 mt-1 flex-wrap">
                  <Badge tone="soft">{QUESTION_KINDS[q.kind as keyof typeof QUESTION_KINDS] ?? q.kind}</Badge>
                  <Badge tone="soft">{QUIZ_TOPICS[q.topic as keyof typeof QUIZ_TOPICS] ?? q.topic}</Badge>
                  {q.week != null && <Badge tone="soft">الأسبوع {q.week}</Badge>}
                </div>
                {q.kind === "SHORT" ? (
                  <p className="text-sm mt-2">الإجابة: <span className="font-medium">{(q.answers ?? "").split("|").join(" · ")}</span></p>
                ) : (
                  <ol className="text-sm mt-2 space-y-0.5">
                    {opts.map((o, i) => <li key={i} className={i === q.correctIndex ? "font-bold" : "text-muted"}>{i === q.correctIndex ? "✓ " : "· "}{o}</li>)}
                  </ol>
                )}
                {q.explanation && <p className="text-xs text-muted mt-2">الشرح: {q.explanation}</p>}
              </Card>
            );
          })}
        </div>
        <Card title="سؤال جديد في البنك">
          <form action={addBankQuestion}>
            <QuestionFields showBankFields weeks={weeks.map((w) => ({ number: w.number, label: w.label }))} />
            <SubmitButton>حفظ في البنك</SubmitButton>
          </form>
        </Card>
      </div>
    </>
  );
}
