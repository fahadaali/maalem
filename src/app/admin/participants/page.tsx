import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Card, Badge } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import { createUser } from "../actions";
import { computeGrades } from "@/lib/grades";
import { ROLE_LABELS } from "@/lib/utils";

export const metadata = { title: "المشاركون" };

export default async function ParticipantsPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireRole("ADMIN");
  const { ok, err } = await searchParams;
  const users = await db.user.findMany({ orderBy: [{ role: "asc" }, { name: "asc" }], include: { mentor: { select: { name: true } } } });
  const participants = users.filter((u) => u.role === "PARTICIPANT");
  const mentors = users.filter((u) => u.role === "MENTOR");
  const grades = await Promise.all(participants.map((p) => computeGrades(p.id)));

  return (
    <>
      <PageHeader title="المشاركون وسجل الأداء" subtitle="ملحق 3: سجل الأداء يُحتسب آلياً من الحضور، والبطاقات، والاختبارات، والمهام، والمعايشة، والدور القيادي." />
      <FormMessage ok={ok} err={err} />
      <div className="table-wrap mb-6">
        <table className="table">
          <thead>
            <tr><th>#</th><th>المشارك</th><th>الحضور %</th><th>بطاقات القراءة</th><th>الاختبارات (متوسط)</th><th>المهام المسلمة</th><th>ساعات المعايشة</th><th>الدور القيادي</th><th>المجموع</th><th></th></tr>
          </thead>
          <tbody>
            {participants.map((p, i) => {
              const g = grades[i];
              return (
                <tr key={p.id} className={!p.active ? "opacity-50" : ""}>
                  <td>{i + 1}</td>
                  <td className="font-medium whitespace-nowrap"><Link href={`/admin/participants/${p.id}`} className="hover:underline">{p.name}</Link>{!p.active && <Badge className="ms-1">موقوف</Badge>}</td>
                  <td>{g.stats.attendancePct}%</td>
                  <td>{g.stats.cards}/{g.stats.expectedCards}</td>
                  <td>{g.stats.quizCount ? `${g.stats.quizAvgPct}%` : "—"}</td>
                  <td>{g.stats.submitted}/{g.stats.assignments}</td>
                  <td>{g.stats.fieldHours}{g.stats.pendingFieldHours ? ` (+${g.stats.pendingFieldHours})` : ""}</td>
                  <td>{g.stats.leadershipActivities ? `${g.stats.peerAvg}/5` : "—"}</td>
                  <td className="font-bold">{g.total}</td>
                  <td><Link href={`/admin/participants/${p.id}`} className="btn btn-secondary btn-sm">الملف</Link></td>
                </tr>
              );
            })}
            {participants.length === 0 && <tr><td colSpan={10} className="text-center text-muted">لا مشاركون بعد. أضف المشاركين (3–5) من النموذج أدناه.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="grid md:grid-cols-2 gap-4 items-start">
        <Card title="إضافة مستخدم">
          <form action={createUser}>
            <div className="field"><label className="label">الاسم</label><input name="name" className="input" required /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="field"><label className="label">اسم المستخدم</label><input name="username" className="input" required dir="ltr" pattern="[a-z0-9_.\-]{3,30}" placeholder="ahmad" /></div>
              <div className="field"><label className="label">كلمة المرور</label><input name="password" className="input" required dir="ltr" minLength={6} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="field"><label className="label">الجوال</label><input name="phone" className="input" dir="ltr" inputMode="tel" /></div>
              <div className="field">
                <label className="label">الدور</label>
                <select name="role" className="select" defaultValue="PARTICIPANT">
                  <option value="PARTICIPANT">مشارك</option>
                  <option value="MENTOR">مشرف مرافق</option>
                  <option value="ADMIN">مدير المشروع</option>
                </select>
              </div>
            </div>
            <div className="field">
              <label className="label">المشرف المرافق (للمشارك)</label>
              <select name="mentorId" className="select" defaultValue="">
                <option value="">— بدون —</option>
                {mentors.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <SubmitButton>إضافة</SubmitButton>
          </form>
        </Card>
        <Card title="المشرفون المرافقون والإداريون">
          <ul className="divide-y divide-line text-sm">
            {users.filter((u) => u.role !== "PARTICIPANT").map((u) => (
              <li key={u.id} className="py-2 flex justify-between gap-2">
                <Link href={`/admin/participants/${u.id}`} className="hover:underline">{u.name}</Link>
                <span className="text-muted text-xs">{ROLE_LABELS[u.role]}{!u.active ? " · موقوف" : ""}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
