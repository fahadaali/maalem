import { requireParticipantView } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Card, Badge, Empty } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import { requestExcuse, cancelExcuse } from "../actions";
import { EXCUSE_KINDS, EXCUSE_STATUS } from "@/lib/excuses";
import { getActiveWeeks, currentWeekNumber } from "@/lib/weeks";
import { formatDateTime, formatShort, todayKey } from "@/lib/dates";
import { cohortWhere } from "@/lib/cohort";
import ExcuseForm from "@/components/ExcuseForm";

export const metadata = { title: "الاستئذان والتأجيل" };

export default async function ExcusesPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const user = await requireParticipantView();
  const { ok, err } = await searchParams;
  const [rows, weeks, assignments, now] = await Promise.all([
    db.excuseRequest.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
    getActiveWeeks(),
    db.assignment.findMany({ where: await cohortWhere(), orderBy: { week: "asc" }, select: { id: true, title: true, week: true } }),
    currentWeekNumber(),
  ]);

  return (
    <>
      <PageHeader
        title="الاستئذان والتأجيل"
        subtitle="عذرٌ يعرض فيُبتّ فيه، لا غيابٌ يُحتسب عليك. الاستئذان المقبول يُرصد «معذوراً» فلا يُنقص نسبة حضورك."
      />
      <FormMessage ok={ok} err={err} />
      <div className="grid md:grid-cols-[380px_1fr] gap-4 items-start">
        <Card title="طلب جديد">
          <form action={requestExcuse}>
            <ExcuseForm
              weeks={weeks.map((w) => ({ number: w.number, label: w.label }))}
              assignments={assignments.map((a) => ({ id: a.id, title: a.title, week: a.week }))}
              currentWeek={Math.max(0, now)}
              today={todayKey()}
            />
            <SubmitButton>إرسال الطلب</SubmitButton>
          </form>
        </Card>

        <div>
          {rows.length === 0 ? (
            <Empty>لا طلبات سابقة.</Empty>
          ) : (
            <div className="space-y-3">
              {rows.map((r) => (
                <Card key={r.id}>
                  <div className="flex flex-wrap justify-between gap-2">
                    <div className="font-medium">{EXCUSE_KINDS[r.kind as keyof typeof EXCUSE_KINDS] ?? r.kind}</div>
                    <Badge tone={r.status === "APPROVED" ? "ink" : "default"}>{EXCUSE_STATUS[r.status]}</Badge>
                  </div>
                  <div className="text-xs text-muted mt-1">
                    {r.week != null ? `الأسبوع ${r.week} · ` : ""}
                    {r.untilAt ? `حتى ${formatShort(r.untilAt)} · ` : ""}
                    قُدّم {formatDateTime(r.createdAt)}
                  </div>
                  <p className="text-sm mt-2 whitespace-pre-wrap">{r.reason}</p>
                  {r.decision && <p className="text-sm text-ink-2 mt-2 border-t border-line pt-2"><span className="text-xs text-muted block">رد مدير المشروع</span>{r.decision}</p>}
                  {r.status === "PENDING" && (
                    <form action={cancelExcuse} className="mt-2">
                      <input type="hidden" name="id" value={r.id} />
                      <SubmitButton ghost className="btn-sm !px-0" pendingText="…">سحب الطلب</SubmitButton>
                    </form>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
