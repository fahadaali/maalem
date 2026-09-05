import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Card } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import { saveAttendance } from "../actions";
import { WEEKS } from "@/lib/program";
import { currentWeekNumber } from "@/lib/dates";
import { ATTENDANCE_LABELS, cn } from "@/lib/utils";

export const metadata = { title: "الحضور" };

export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ week?: string; ok?: string; err?: string }> }) {
  await requireRole("ADMIN");
  const sp = await searchParams;
  const parsed = Number(sp.week);
  const week = sp.week != null && Number.isInteger(parsed) ? parsed : Math.max(0, Math.min(13, currentWeekNumber()));
  const info = WEEKS.find((w) => w.number === week) ?? WEEKS[0];
  const [participants, rows] = await Promise.all([
    db.user.findMany({ where: { role: "PARTICIPANT", active: true }, orderBy: { name: "asc" } }),
    db.attendance.findMany({ where: { week } }),
  ]);
  const get = (userId: string, type: string) => rows.find((r) => r.userId === userId && r.type === type)?.status ?? "";
  const statuses = ["PRESENT", "LATE", "EXCUSED", "ABSENT"];

  return (
    <>
      <PageHeader title="سجل الحضور" subtitle="اللقاء الحضوري (السبت) وحلقة النقاش عن بُعد (الثلاثاء). الحد الأدنى: 85% حضوري و80% عن بُعد." />
      <FormMessage ok={sp.ok} err={sp.err} />
      <div className="flex gap-1 overflow-x-auto pb-3 mb-3 -mx-4 px-4">
        {WEEKS.filter((w) => w.number <= 13).map((w) => (
          <Link key={w.number} href={`/admin/attendance?week=${w.number}`} className={cn("badge shrink-0", w.number === week && "badge-ink")}>{w.number === 0 ? "الافتتاحي" : w.number === 13 ? "الختامي" : w.number}</Link>
        ))}
      </div>
      <Card title={`الأسبوع ${info.label} · ${info.hijri}`}>
        <div className="text-xs text-muted mb-3">اللقاء: {info.session}</div>
        <form action={saveAttendance}>
          <input type="hidden" name="week" value={week} />
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>المشارك</th><th>اللقاء الحضوري (السبت)</th><th>حلقة النقاش (الثلاثاء)</th></tr></thead>
              <tbody>
                {participants.map((p) => (
                  <tr key={p.id}>
                    <td className="font-medium whitespace-nowrap">{p.name}</td>
                    {["INPERSON", "REMOTE"].map((t) => (
                      <td key={t}>
                        <select name={`att_${p.id}_${t}`} className="select" defaultValue={get(p.id, t)}>
                          <option value="">— لم يُسجل —</option>
                          {statuses.map((s) => <option key={s} value={s}>{ATTENDANCE_LABELS[s]}</option>)}
                        </select>
                      </td>
                    ))}
                  </tr>
                ))}
                {participants.length === 0 && <tr><td colSpan={3} className="text-center text-muted">لا مشاركون.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="mt-3"><SubmitButton>حفظ الحضور</SubmitButton></div>
        </form>
      </Card>
    </>
  );
}
