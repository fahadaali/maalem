import Link from "next/link";
import { Fragment } from "react";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Card } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import { saveAttendance } from "../actions";
import { getWeeks, resolveCurrentWeek } from "@/lib/weeks";

import { ATTENDANCE_LABELS, cn } from "@/lib/utils";
import { PARTICIPATION_SCALE } from "@/lib/program";
import { participantsWhere } from "@/lib/cohort";

export const metadata = { title: "الحضور" };

export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ week?: string; ok?: string; err?: string }> }) {
  await requireRole("ADMIN");
  const sp = await searchParams;
  const weeks = await getWeeks();
  const parsed = Number(sp.week);
  const week = sp.week != null && Number.isInteger(parsed) ? parsed : Math.max(0, Math.min(13, resolveCurrentWeek(weeks)));
  const info = weeks.find((w) => w.number === week) ?? weeks[0];
  const [participants, rows] = await Promise.all([
    db.user.findMany({ where: await participantsWhere(), orderBy: { name: "asc" } }),
    db.attendance.findMany({ where: { week } }),
  ]);
  const cell = (userId: string, type: string) => rows.find((r) => r.userId === userId && r.type === type);
  const get = (userId: string, type: string) => cell(userId, type)?.status ?? "";
  const statuses = ["PRESENT", "LATE", "EXCUSED", "ABSENT"];

  return (
    <>
      <PageHeader title="سجل الحضور" subtitle="اللقاء الحضوري (السبت) وحلقة النقاش عن بُعد (الثلاثاء). الحد الأدنى: 85% حضوري و80% عن بُعد. ورصد المشاركة أداة قياس في الخطة: يدخل في درجة الحضور، والمشاركة في الحلقة تدخل في درجة الورد القرائي." />
      <FormMessage ok={sp.ok} err={sp.err} />
      <div className="flex gap-1 overflow-x-auto pb-3 mb-3 -mx-4 px-4">
        {weeks.filter((w) => w.number <= 13).map((w) => (
          <Link key={w.number} href={`/admin/attendance?week=${w.number}`} className={cn("badge shrink-0", w.number === week && "badge-ink")}>{w.number === 0 ? "الافتتاحي" : w.number === 13 ? "الختامي" : w.number}</Link>
        ))}
      </div>
      <Card title={`الأسبوع ${info.label} · ${info.hijri}`}>
        <div className="text-xs text-muted mb-3">اللقاء: {info.session}</div>
        <form action={saveAttendance}>
          <input type="hidden" name="week" value={week} />
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th rowSpan={2}>المشارك</th>
                  <th colSpan={2}>اللقاء الحضوري (السبت)</th>
                  <th colSpan={3}>حلقة النقاش (الثلاثاء)</th>
                </tr>
                <tr>
                  <th>الحضور</th><th>رصد المشاركة</th>
                  <th>الحضور</th><th>رصد المشاركة</th><th>المشاركة في الحلقة</th>
                </tr>
              </thead>
              <tbody>
                {participants.map((p) => (
                  <tr key={p.id}>
                    <td className="font-medium whitespace-nowrap">{p.name}</td>
                    {["INPERSON", "REMOTE"].map((t) => {
                      const c = cell(p.id, t);
                      return (
                        <Fragment key={t}>
                          <td>
                            <select name={`att_${p.id}_${t}`} className="select" defaultValue={get(p.id, t)}>
                              <option value="">— لم يُسجل —</option>
                              {statuses.map((s) => <option key={s} value={s}>{ATTENDANCE_LABELS[s]}</option>)}
                            </select>
                          </td>
                          <td>
                            <select name={`part_${p.id}_${t}`} className="select" defaultValue={c?.participation ?? ""}>
                              <option value="">—</option>
                              {PARTICIPATION_SCALE.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
                            </select>
                          </td>
                          {t === "REMOTE" && (
                            <td>
                              <select name={`circle_${p.id}_${t}`} className="select" defaultValue={c?.circleScore ?? ""}>
                                <option value="">—</option>
                                {PARTICIPATION_SCALE.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
                              </select>
                            </td>
                          )}
                        </Fragment>
                      );
                    })}
                  </tr>
                ))}
                {participants.length === 0 && <tr><td colSpan={6} className="text-center text-muted">لا مشاركون.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="mt-3"><SubmitButton>حفظ الحضور</SubmitButton></div>
        </form>
      </Card>
    </>
  );
}
