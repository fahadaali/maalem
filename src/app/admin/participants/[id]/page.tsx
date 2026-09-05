import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Card, BackLink, Progress, Badge, Empty } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import { addFeedbackSession, updateUser } from "../../actions";
import { computeGrades } from "@/lib/grades";
import { CONTINUOUS_ASSESSMENT } from "@/lib/program";
import { ATTENDANCE_LABELS, PROJECT_STATUS_LABELS, ROLE_LABELS } from "@/lib/utils";
import { formatShort, todayKey } from "@/lib/dates";

export const metadata = { title: "ملف مشارك" };

export default async function ParticipantDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireRole("ADMIN");
  const { id } = await params;
  const { ok, err } = await searchParams;
  const u = await db.user.findUnique({
    where: { id },
    include: {
      mentor: { select: { name: true } },
      attendance: { orderBy: { week: "asc" } },
      weeklyReports: { orderBy: { week: "asc" } },
      submissions: { include: { assignment: true }, orderBy: { submittedAt: "desc" } },
      fieldLogs: { orderBy: { date: "desc" } },
      quizAttempts: { include: { quiz: true } },
      leadership: { include: { evaluations: true } },
      project: true,
      learningPlan: true,
      feedbackSessions: { orderBy: { date: "desc" } },
      tadabbur: true,
      _count: { select: { readingCards: true, reflections: true } },
    },
  });
  if (!u) notFound();
  const mentors = await db.user.findMany({ where: { role: "MENTOR", active: true }, select: { id: true, name: true } });
  const isParticipant = u.role === "PARTICIPANT";
  const g = isParticipant ? await computeGrades(u.id) : null;
  const parts: Record<string, number> = g ? { attendance: g.attendance, reading: g.reading, quizzes: g.quizzes, tasks: g.tasks, field: g.field, leadership: g.leadership } : {};

  return (
    <>
      <BackLink href="/admin/participants">المشاركون</BackLink>
      <PageHeader title={u.name} subtitle={`${ROLE_LABELS[u.role]} · ${u.username}${u.phone ? " · " + u.phone : ""}${u.mentor ? " · المشرف المرافق: " + u.mentor.name : ""}`} actions={g && <Badge tone="ink">{g.total} / 100 · {g.level}</Badge>} />
      <FormMessage ok={ok} err={err} />

      {g && (
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <Card title="التقييم المستمر (70)">
            <div className="space-y-2">
              {CONTINUOUS_ASSESSMENT.map((c) => <Progress key={c.key} label={`${c.component} (${c.points})`} value={parts[c.key]} max={c.points} />)}
            </div>
            <div className="text-xs text-muted mt-3">مشروع التخرج: {g.project}/30 · {g.stats.projectStatus ? PROJECT_STATUS_LABELS[g.stats.projectStatus] : "لم يُحدد"}</div>
          </Card>
          <Card title="ملف الإنجاز">
            <ul className="text-sm divide-y divide-line">
              <li className="py-1.5 flex justify-between"><span>خطة التعلم الشخصية</span><span className="text-muted">{u.learningPlan ? "مسلّمة" : "لم تُسلَّم"}</span></li>
              <li className="py-1.5 flex justify-between"><span>بطاقات القراءة</span><span className="text-muted">{u._count.readingCards}</span></li>
              <li className="py-1.5 flex justify-between"><span>التقارير الأسبوعية</span><span className="text-muted">{u.weeklyReports.length}</span></li>
              <li className="py-1.5 flex justify-between"><span>الاختبارات</span><span className="text-muted">{u.quizAttempts.map((a) => `${a.score}/${a.total}`).join("، ") || "—"}</span></li>
              <li className="py-1.5 flex justify-between"><span>الوقفات التدبرية</span><span className="text-muted">{u.tadabbur.length}</span></li>
              <li className="py-1.5 flex justify-between"><span>الأنشطة القيادية</span><span className="text-muted">{u.leadership.length}</span></li>
              <li className="py-1.5 flex justify-between"><span>دفتر التأمل</span><span className="text-muted">{u._count.reflections}</span></li>
              {u.project && <li className="py-1.5 flex justify-between"><span>مشروع التخرج</span><Link href="/admin/projects" className="text-muted hover:underline">{u.project.topic}</Link></li>}
            </ul>
          </Card>
        </div>
      )}

      {isParticipant && (
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <Card title="الحضور">
            {u.attendance.length === 0 ? <p className="text-sm text-muted">لم يُسجل حضور.</p> : (
              <div className="flex flex-wrap gap-1">
                {u.attendance.map((a) => <span key={a.id} className={`badge ${a.status === "PRESENT" ? "badge-ink" : ""}`}>أ{a.week} {a.type === "INPERSON" ? "حضوري" : "بُعد"}: {ATTENDANCE_LABELS[a.status]}</span>)}
              </div>
            )}
          </Card>
          <Card title="المعايشة الميدانية">
            {u.fieldLogs.length === 0 ? <p className="text-sm text-muted">لا سجلات.</p> : (
              <ul className="text-sm divide-y divide-line">
                {u.fieldLogs.slice(0, 8).map((f) => <li key={f.id} className="py-1.5 flex justify-between gap-2"><span className="truncate">{formatShort(f.date)} · {f.hours} س · {f.mentorName}</span>{f.approvedAt ? <Badge tone="ink">معتمد</Badge> : <Badge>معلّق</Badge>}</li>)}
              </ul>
            )}
          </Card>
          <Card title="التقارير الأسبوعية">
            {u.weeklyReports.length === 0 ? <p className="text-sm text-muted">لا تقارير.</p> : (
              <div className="flex flex-wrap gap-1">
                {u.weeklyReports.map((r) => <Link key={r.id} href={`/admin/reports?week=${r.week}#r-${r.id}`} className={`badge ${r.reviewedAt ? "badge-ink" : ""}`}>الأسبوع {r.week}</Link>)}
              </div>
            )}
          </Card>
          <Card title="المهام">
            {u.submissions.length === 0 ? <p className="text-sm text-muted">لا تسليمات.</p> : (
              <ul className="text-sm divide-y divide-line">
                {u.submissions.map((s) => <li key={s.id} className="py-1.5 flex justify-between gap-2"><Link href={`/admin/tasks/${s.assignmentId}`} className="truncate hover:underline">{s.assignment.title}</Link>{s.gradedAt ? <Badge tone="ink">{(s.completeness ?? 0) + (s.referencing ?? 0) + (s.application ?? 0) + (s.punctuality ?? 0)}/16</Badge> : <Badge>غير مقيّم</Badge>}</li>)}
              </ul>
            )}
          </Card>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {isParticipant && (
          <Card title="جلسات التغذية الراجعة الفردية (15 دقيقة كل أسبوعين)">
            <form action={addFeedbackSession} className="mb-4">
              <input type="hidden" name="userId" value={u.id} />
              <div className="field"><label className="label">التاريخ</label><input type="date" name="date" className="input" defaultValue={todayKey()} /></div>
              <div className="field"><label className="label">ملاحظات الجلسة</label><textarea name="notes" className="textarea" required /></div>
              <SubmitButton>تسجيل الجلسة وإشعار المشارك</SubmitButton>
            </form>
            {u.feedbackSessions.length === 0 ? <Empty>لا جلسات مسجلة.</Empty> : (
              <ul className="text-sm divide-y divide-line">
                {u.feedbackSessions.map((f) => <li key={f.id} className="py-2"><div className="text-xs text-muted">{formatShort(f.date)}</div><div className="whitespace-pre-wrap">{f.notes}</div></li>)}
              </ul>
            )}
          </Card>
        )}
        <Card title="بيانات الحساب">
          <form action={updateUser}>
            <input type="hidden" name="id" value={u.id} />
            <div className="field"><label className="label">الاسم</label><input name="name" className="input" defaultValue={u.name} required /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="field"><label className="label">الجوال</label><input name="phone" className="input" dir="ltr" defaultValue={u.phone ?? ""} /></div>
              <div className="field"><label className="label">البريد</label><input name="email" className="input" dir="ltr" defaultValue={u.email ?? ""} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="field">
                <label className="label">الدور</label>
                <select name="role" className="select" defaultValue={u.role}>
                  <option value="PARTICIPANT">مشارك</option>
                  <option value="MENTOR">مشرف مرافق</option>
                  <option value="ADMIN">مدير المشروع</option>
                </select>
              </div>
              <div className="field">
                <label className="label">المشرف المرافق</label>
                <select name="mentorId" className="select" defaultValue={u.mentorId ?? ""}>
                  <option value="">— بدون —</option>
                  {mentors.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
            </div>
            <div className="field"><label className="label">كلمة مرور جديدة (اتركها فارغة للإبقاء)</label><input name="password" className="input" dir="ltr" minLength={6} autoComplete="new-password" /></div>
            <label className="flex items-center gap-2 text-sm mb-4"><input type="checkbox" name="active" defaultChecked={u.active} className="accent-black" /> الحساب نشط</label>
            <SubmitButton secondary>حفظ</SubmitButton>
          </form>
        </Card>
      </div>
    </>
  );
}
