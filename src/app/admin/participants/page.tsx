import { tallyShort } from "@/lib/progress";
import Link from "@/components/Link";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Card, Badge } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import { createUser, importParticipants } from "../actions";
import { computeGradesFor } from "@/lib/grades";
import { obligationsForMany } from "@/lib/obligations";
import { loadParticipantsOnce, waitingCounts } from "@/lib/participant-data";
import { ROLE_LABELS } from "@/lib/utils";
import { cohortWhere } from "@/lib/cohort";

export const metadata = { title: "المشاركون" };

export default async function ParticipantsPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireRole("ADMIN");
  const { ok, err } = await searchParams;
  const users = await db.user.findMany({ where: { OR: [await cohortWhere(), { role: "ADMIN" }] }, orderBy: [{ role: "asc" }, { name: "asc" }], include: { mentor: { select: { name: true } } } });
  const participants = users.filter((u) => u.role === "PARTICIPANT");
  const mentors = users.filter((u) => u.role === "MENTOR");
  const ids = participants.map((p) => p.id);
  // الدرجات والمتأخر وما ينتظر المراجعة من صفوفٍ واحدة تُجلب مرة في الطلب
  const [grades, obligations, rows] = await Promise.all([computeGradesFor(ids), obligationsForMany(ids), loadParticipantsOnce(ids)]);
  const waiting = (id: string) => {
    const r = rows.get(id);
    return r ? waitingCounts(r).total : 0;
  };

  return (
    <>
      <PageHeader title="المشاركون وسجل الأداء" subtitle="ملحق 3: سجل الأداء يُحتسب آلياً من الحضور، وصفحات الورد، والاختبارات، والمهام، والمعايشة، والدور القيادي — والإنجاز فيه من المستحق حتى الآن لا من البرنامج كله." />
      <FormMessage ok={ok} err={err} />
      <div className="table-wrap mb-6">
        <table className="table">
          <thead>
            <tr><th>#</th><th>المشارك</th><th>الحضور %</th><th title="الصفحات المقروءة من المستحقة حتى الآن">الورد</th><th>الاختبارات (متوسط)</th><th title="المسلَّمة من المستحقة حتى الآن">المهام</th><th title="المعتمدة من المستحقة حتى الآن، وبين قوسين ما ينتظر الاعتماد">المعايشة</th><th>الدور القيادي</th><th title="متوسط نسب البنود المستحقة">الإنجاز</th><th title="كل مكوّن بما استُحقّ منه، مردودةً إلى 100 — وتحتها التراكمية">المرحلية</th><th>متأخر</th><th>بانتظار مراجعتك</th><th></th></tr>
          </thead>
          <tbody>
            {participants.map((p, i) => {
              const g = grades[i];
              return (
                <tr key={p.id} className={!p.active ? "opacity-50" : ""}>
                  <td>{i + 1}</td>
                  <td className="font-medium whitespace-nowrap"><Link href={`/admin/participants/${p.id}`} className="hover:underline">{p.name}</Link>{!p.active && <Badge className="ms-1">موقوف</Badge>}</td>
                  <td>{g.stats.attendancePct}%</td>
                  <td className="tabular-nums">{tallyShort(g.due.reading)}</td>
                  <td>{g.stats.quizCount ? `${g.stats.quizAvgPct}%` : "—"}</td>
                  <td className="tabular-nums">{tallyShort(g.due.tasks)}</td>
                  <td className="tabular-nums">{tallyShort(g.due.field)}{g.due.field.pending ? ` (+${g.due.field.pending})` : ""}</td>
                  <td>{g.stats.leadershipActivities ? `${g.stats.peerAvg}/5` : "—"}</td>
                  <td className="tabular-nums">{g.due.percent != null ? `${g.due.percent}%` : "—"}</td>
                  <td className="tabular-nums"><span className="font-bold">{g.interim.total ?? "—"}</span><div className="text-[11px] text-muted">تراكمي {g.total}</div></td>
                  {/* ما تأخّر عليه وما أُرجع إليه، وما ينتظر مراجعتك من إدخالاته — يُفتح كلٌّ في ملفه */}
                  <td>{(() => { const o = obligations.get(p.id); const n = o ? o.counts.overdue + o.counts.returned : 0; return n ? <Link href={`/admin/participants/${p.id}`} className="badge badge-ink">{n}</Link> : <span className="text-muted">—</span>; })()}</td>
                  <td>{waiting(p.id) ? <Link href={`/admin/participants/${p.id}`} className="badge">{waiting(p.id)}</Link> : <span className="text-muted">—</span>}</td>
                  <td><Link href={`/admin/participants/${p.id}`} className="btn btn-secondary btn-sm">الملف</Link></td>
                </tr>
              );
            })}
            {participants.length === 0 && <tr><td colSpan={13} className="text-center text-muted">لا مشاركون بعد. أضف المشاركين (3–5) من النموذج أدناه.</td></tr>}
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
        <Card title="استيراد دفعة من جدول">
          <p className="text-sm text-muted mb-3">
            الصق الصفوف من جدولك — صف لكل مستخدم بهذا الترتيب: الاسم، اسم المستخدم، كلمة المرور، الجوال، البريد.
            كلمة المرور والجوال والبريد اختيارية، ومن تُرك بلا كلمة مرور تُولَّد له واحدة وتظهر لك بعد الإضافة.
            الفاصل بين الحقول: مسافة جدولة أو فاصلة أو «|».
          </p>
          <form action={importParticipants}>
            <div className="field">
              <label className="label">الصفوف</label>
              <textarea name="rows" className="textarea" rows={5} dir="ltr" required placeholder={"عبدالله محمد\tabdullah\tPass#1234\t0500000000\tab@example.com"} />
            </div>
            <div className="field">
              <label className="label">الدور</label>
              <select name="role" className="select" defaultValue="PARTICIPANT">
                <option value="PARTICIPANT">مشارك</option>
                <option value="MENTOR">مشرف مرافق</option>
              </select>
            </div>
            <SubmitButton secondary pendingText="جارٍ الاستيراد…">استيراد</SubmitButton>
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
