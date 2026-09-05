import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Card, Stat, Badge } from "@/components/ui";
import { currentWeekNumber, dayName, formatHijri, formatGregorian, getWeek, weekdayIndex, reportDueDate, formatDateTime } from "@/lib/dates";
import { MANAGER_ROUTINE, PHASES } from "@/lib/program";

export const metadata = { title: "لوحة مدير المشروع" };

export default async function AdminDashboard() {
  await requireRole("ADMIN");
  const now = new Date();
  const weekNo = currentWeekNumber(now);
  const week = getWeek(weekNo);
  const wd = weekdayIndex(now);
  const routine = MANAGER_ROUTINE.filter((r) => r.weekday === wd);

  const [participants, reportsThisWeek, pendingField, pendingProjects, ungraded, unpublishedQuizzes, checklist, recent] = await Promise.all([
    db.user.findMany({ where: { role: "PARTICIPANT", active: true }, select: { id: true, name: true } }),
    weekNo >= 0 && weekNo <= 12 ? db.weeklyReport.findMany({ where: { week: weekNo }, select: { userId: true, reviewedAt: true } }) : [],
    db.fieldLog.count({ where: { approvedAt: null } }),
    db.graduationProject.count({ where: { status: "PROPOSED" } }),
    db.submission.count({ where: { gradedAt: null } }),
    db.quiz.count({ where: { published: false } }),
    db.checklistItem.findMany({ where: { done: true } }),
    db.notification.findMany({ where: { user: { role: "ADMIN" } }, orderBy: { createdAt: "desc" }, take: 5, distinct: ["title", "body"] }),
  ]);
  const prepPhase = PHASES[0];
  const prepDone = checklist.filter((c) => c.group === prepPhase.key).length;
  const submitted = new Set(reportsThisWeek.map((r) => r.userId));
  const missing = participants.filter((p) => !submitted.has(p.id));

  return (
    <>
      <PageHeader
        eyebrow={`${dayName(now)} · ${formatHijri(now)} · ${formatGregorian(now)}`}
        title="لوحة مدير المشروع"
        subtitle={weekNo < 0 ? "مرحلة التهيئة — قبل اللقاء الافتتاحي" : weekNo > 14 ? "ما بعد البرنامج — التقويم والإغلاق" : `الأسبوع ${week?.label} — ${week?.competency}`}
      />

      <Card className="mb-4 border-ink" title="مهام اليوم (مصفوفة المتابعة الأسبوعية)">
        {routine.length === 0 ? (
          <p className="text-sm text-muted">لا مهمة ثابتة اليوم. راجع البنود المعلّقة أدناه.</p>
        ) : (
          <ul className="text-sm space-y-1">
            {routine.map((r) => (
              <li key={r.task} className="flex flex-wrap gap-2 items-baseline">
                <span className="font-medium">{r.task}</span>
                <span className="text-muted text-xs">{r.duration} · {r.tool}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-2 mt-3">
          {wd === 6 && <Link href={`/admin/attendance?week=${Math.max(0, weekNo)}&type=INPERSON`} className="btn btn-sm">تسجيل حضور اللقاء</Link>}
          {wd === 2 && <Link href={`/admin/attendance?week=${Math.max(0, weekNo)}&type=REMOTE`} className="btn btn-sm">تسجيل حضور الحلقة</Link>}
          {wd === 0 && <Link href="/admin/notifications" className="btn btn-sm">إرسال تذكير الورد والمهمة</Link>}
          {wd === 4 && <Link href={`/admin/reports?week=${Math.max(0, weekNo)}`} className="btn btn-sm">مراجعة التقارير</Link>}
          {wd === 5 && <Link href="/admin/participants" className="btn btn-sm">سجل الأداء</Link>}
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Stat label="المشاركون" value={participants.length} hint="نشطون" href="/admin/participants" />
        <Stat label="تقارير هذا الأسبوع" value={`${submitted.size}/${participants.length}`} hint={weekNo >= 0 && weekNo <= 12 ? `الموعد ${formatDateTime(reportDueDate(weekNo))}` : "خارج أسابيع التقارير"} href={`/admin/reports?week=${Math.max(0, Math.min(12, weekNo))}`} />
        <Stat label="معايشة بانتظار الاعتماد" value={pendingField} hint="سجل" href="/admin/field" />
        <Stat label="تسليمات غير مقيّمة" value={ungraded} hint="مهمة" href="/admin/tasks" />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card title="بنود معلّقة">
          <ul className="text-sm divide-y divide-line">
            {pendingProjects > 0 && <li className="py-2 flex justify-between"><Link href="/admin/projects" className="hover:underline">موضوعات مشاريع بانتظار الاعتماد</Link><Badge>{pendingProjects}</Badge></li>}
            {unpublishedQuizzes > 0 && <li className="py-2 flex justify-between"><Link href="/admin/quizzes" className="hover:underline">اختبارات غير منشورة</Link><Badge>{unpublishedQuizzes}</Badge></li>}
            {reportsThisWeek.filter((r) => !r.reviewedAt).length > 0 && <li className="py-2 flex justify-between"><Link href={`/admin/reports?week=${weekNo}`} className="hover:underline">تقارير لم تُراجع هذا الأسبوع</Link><Badge>{reportsThisWeek.filter((r) => !r.reviewedAt).length}</Badge></li>}
            {weekNo < 0 && <li className="py-2 flex justify-between"><Link href="/admin/phases" className="hover:underline">قائمة التهيئة</Link><Badge>{prepDone}/{prepPhase.tasks.length}</Badge></li>}
            {missing.length > 0 && weekNo >= 0 && weekNo <= 12 && (
              <li className="py-2">
                <div className="flex justify-between"><span>لم يسلّموا تقرير الأسبوع {weekNo}</span><Badge>{missing.length}</Badge></div>
                <div className="text-xs text-muted mt-1">{missing.map((m) => m.name).join("، ")}</div>
              </li>
            )}
            {pendingProjects === 0 && unpublishedQuizzes === 0 && missing.length === 0 && weekNo >= 0 && <li className="py-2 text-muted">لا بنود معلّقة.</li>}
          </ul>
        </Card>
        <Card title="آخر الأحداث" action={<Link href="/admin/notifications" className="text-xs text-muted underline">الكل</Link>}>
          {recent.length === 0 ? (
            <p className="text-sm text-muted">لا أحداث بعد.</p>
          ) : (
            <ul className="text-sm divide-y divide-line">
              {recent.map((n) => (
                <li key={n.id} className="py-2">
                  <Link href={n.url ?? "/admin/notifications"} className="hover:underline font-medium">{n.title}</Link>
                  <div className="text-xs text-muted">{n.body}</div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
