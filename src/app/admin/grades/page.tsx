import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Card } from "@/components/ui";
import { computeGrades } from "@/lib/grades";
import { COMPLETION_LEVELS, CONTINUOUS_ASSESSMENT } from "@/lib/program";

export const metadata = { title: "كشف الدرجات" };

export default async function GradesPage() {
  await requireRole("ADMIN");
  const participants = await db.user.findMany({ where: { role: "PARTICIPANT", active: true }, orderBy: { name: "asc" } });
  const grades = await Promise.all(participants.map((p) => computeGrades(p.id)));
  return (
    <>
      <PageHeader title="كشف الدرجات ومستويات الإتمام" subtitle="تقييم مستمر 70 + مشروع تخرج 30. الدرجات تُحدَّث آلياً." actions={<button className="btn btn-secondary btn-sm no-print" data-print>طباعة</button>} />
      <div className="table-wrap mb-6">
        <table className="table">
          <thead>
            <tr>
              <th>المشارك</th>
              {CONTINUOUS_ASSESSMENT.map((c) => <th key={c.key} className="text-center">{c.component.split(" ").slice(0, 2).join(" ")} ({c.points})</th>)}
              <th className="text-center">المستمر (70)</th><th className="text-center">المشروع (30)</th><th className="text-center">المجموع</th><th>المستوى</th>
            </tr>
          </thead>
          <tbody>
            {participants.map((p, i) => {
              const g = grades[i];
              const parts: Record<string, number> = { attendance: g.attendance, reading: g.reading, quizzes: g.quizzes, tasks: g.tasks, field: g.field, leadership: g.leadership };
              return (
                <tr key={p.id}>
                  <td className="font-medium whitespace-nowrap">{p.name}</td>
                  {CONTINUOUS_ASSESSMENT.map((c) => <td key={c.key} className="text-center">{parts[c.key]}</td>)}
                  <td className="text-center">{g.continuous}</td><td className="text-center">{g.project}</td><td className="text-center font-bold">{g.total}</td><td>{g.level}</td>
                </tr>
              );
            })}
            {participants.length === 0 && <tr><td colSpan={11} className="text-center text-muted">لا مشاركون.</td></tr>}
          </tbody>
        </table>
      </div>
      <Card title="مستويات الإتمام">
        <ul className="text-sm space-y-1">
          {COMPLETION_LEVELS.map((l) => <li key={l.level}><span className="font-medium">{l.level}</span> ({l.min === 0 ? "أقل من 60" : `${l.min} فأكثر`}): {l.certificate}</li>)}
        </ul>
      </Card>
      <script dangerouslySetInnerHTML={{ __html: `document.querySelector('[data-print]')?.addEventListener('click',()=>window.print())` }} />
    </>
  );
}
