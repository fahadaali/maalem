import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Card } from "@/components/ui";
import { computeGradesFor } from "@/lib/grades";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import { Badge } from "@/components/ui";
import { approveFinalGrade, reopenFinalGrade } from "../actions";
import { formatShort } from "@/lib/dates";
import { getCompletionLevels, getContinuous, type Level } from "@/lib/content";

function levelName(levels: Level[], total: number) {
  return (levels.find((l) => total >= l.min) ?? levels[levels.length - 1]).level;
}
import PrintButton from "@/components/PrintButton";
import { participantsWhere } from "@/lib/cohort";

export const metadata = { title: "كشف الدرجات" };

export default async function GradesPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireRole("ADMIN");
  const { ok, err } = await searchParams;
  const participants = await db.user.findMany({ where: await participantsWhere(), orderBy: { name: "asc" } });
  const [continuous, levels] = await Promise.all([getContinuous(), getCompletionLevels()]);
  const contMax = continuous.reduce((s, c) => s + c.points, 0);
  const grades = await computeGradesFor(participants.map((p) => p.id));
  const finals = await db.finalGrade.findMany({ where: { userId: { in: participants.map((p) => p.id) } } });
  const finalOf = (id: string) => finals.find((f) => f.userId === id);
  const finalTotal = (f: { computed: number; adjustment: number }) => Math.max(0, Math.min(100, Math.round((f.computed + f.adjustment) * 10) / 10));
  return (
    <>
      <FormMessage ok={ok} err={err} />
      <PageHeader title="كشف الدرجات ومستويات الإتمام" subtitle={`تقييم مستمر ${contMax} + مشروع تخرج ${grades[0]?.maxes.project ?? 30}. الدرجات تُحتسب آلياً حتى تُعتمد، ثم تُجمَّد. ويمكن تعديلها بمسوّغ يُسجَّل.`} actions={<PrintButton />} />
      <div className="table-wrap mb-6">
        <table className="table">
          <thead>
            <tr>
              <th>المشارك</th>
              {continuous.map((c) => <th key={c.key} className="text-center">{c.label.split(" ").slice(0, 2).join(" ")} ({c.points})</th>)}
              <th className="text-center">المستمر ({contMax})</th><th className="text-center">المشروع ({grades[0]?.maxes.project ?? 30})</th><th className="text-center">المحتسَب</th><th className="text-center">النهائي المعتمد</th><th>المستوى</th><th>الاعتماد</th>
            </tr>
          </thead>
          <tbody>
            {participants.map((p, i) => {
              const g = grades[i];
              const f = finalOf(p.id);
              const parts: Record<string, number> = { attendance: g.attendance, reading: g.reading, quizzes: g.quizzes, tasks: g.tasks, field: g.field, leadership: g.leadership };
              return (
                <tr key={p.id}>
                  <td className="font-medium whitespace-nowrap">{p.name}</td>
                  {continuous.map((c) => <td key={c.key} className="text-center">{parts[c.key]}</td>)}
                  <td className="text-center">{g.continuous}</td><td className="text-center">{g.project}</td>
                  <td className="text-center">{g.total}</td>
                  <td className="text-center font-bold">{f ? finalTotal(f) : "—"}</td>
                  <td>{f ? levelName(levels, finalTotal(f)) : g.level}</td>
                  <td className="no-print">
                    {f ? (
                      <div className="flex flex-col gap-1 items-start">
                        <Badge tone="ink">معتمدة {formatShort(f.approvedAt)}</Badge>
                        {f.adjustment !== 0 && <span className="text-xs text-muted">تعديل {f.adjustment > 0 ? "+" : ""}{f.adjustment}: {f.reason}</span>}
                        <form action={reopenFinalGrade}>
                          <input type="hidden" name="userId" value={p.id} />
                          <button className="btn btn-ghost btn-sm text-muted">إلغاء الاعتماد</button>
                        </form>
                      </div>
                    ) : (
                      <form action={approveFinalGrade} className="flex gap-1 items-center">
                        <input type="hidden" name="userId" value={p.id} />
                        <input type="number" name="adjustment" step="0.5" min={-20} max={20} defaultValue={0} className="input w-16" title="تعديل مبرَّر" />
                        <input name="reason" className="input" placeholder="مسوّغ التعديل" />
                        <SubmitButton className="btn-sm" pendingText="…">اعتماد</SubmitButton>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
            {participants.length === 0 && <tr><td colSpan={11} className="text-center text-muted">لا مشاركون.</td></tr>}
          </tbody>
        </table>
      </div>
      <Card title="مستويات الإتمام">
        <ul className="text-sm space-y-1">
          {levels.map((l, i) => <li key={l.level}><span className="font-medium">{l.level}</span> ({l.min === 0 ? `أقل من ${levels[i - 1]?.min ?? 60}` : `${l.min} فأكثر`}): {l.certificate}</li>)}
        </ul>
      </Card>
    </>
  );
}
