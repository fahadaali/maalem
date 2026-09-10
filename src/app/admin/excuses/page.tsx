import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Card, Badge, Empty } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import { decideExcuse } from "../actions";
import { EXCUSE_KINDS, EXCUSE_STATUS } from "@/lib/excuses";
import { formatDateTime, formatShort } from "@/lib/dates";
import { participantsWhere } from "@/lib/cohort";

export const metadata = { title: "طلبات الاستئذان" };

export default async function AdminExcusesPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireRole("ADMIN");
  const { ok, err } = await searchParams;
  const ids = (await db.user.findMany({ where: await participantsWhere(), select: { id: true } })).map((u) => u.id);
  const rows = await db.excuseRequest.findMany({
    where: { userId: { in: ids } },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  const assignments = await db.assignment.findMany({ select: { id: true, title: true } });
  const titleOf = new Map(assignments.map((a) => [a.id, a.title]));
  const pending = rows.filter((r) => r.status === "PENDING");
  const decided = rows.filter((r) => r.status !== "PENDING");

  return (
    <>
      <PageHeader
        title="طلبات الاستئذان والتأجيل"
        subtitle="قبول الاستئذان عن لقاء يرصده «معذوراً» في سجل الحضور مباشرةً، فلا يُحتسب على المشارك في نسبته."
      />
      <FormMessage ok={ok} err={err} />

      <Card title={`قيد النظر (${pending.length})`} className="mb-4">
        {pending.length === 0 ? (
          <Empty>لا طلبات تنتظر البتّ.</Empty>
        ) : (
          <div className="space-y-4">
            {pending.map((r) => (
              <div key={r.id} className="border-b border-line pb-4 last:border-0 last:pb-0">
                <div className="flex flex-wrap justify-between gap-2">
                  <div>
                    <span className="font-medium">{r.user.name}</span>
                    <span className="text-muted"> — {EXCUSE_KINDS[r.kind as keyof typeof EXCUSE_KINDS] ?? r.kind}</span>
                  </div>
                  <div className="text-xs text-muted">{formatDateTime(r.createdAt)}</div>
                </div>
                <div className="flex gap-1 mt-1 flex-wrap">
                  {r.week != null && <Badge tone="soft">الأسبوع {r.week}</Badge>}
                  {r.assignmentId && <Badge tone="soft">{titleOf.get(r.assignmentId) ?? "مهمة"}</Badge>}
                  {r.untilAt && <Badge tone="soft">حتى {formatShort(r.untilAt)}</Badge>}
                </div>
                <p className="text-sm mt-2 whitespace-pre-wrap">{r.reason}</p>
                <div className="grid md:grid-cols-2 gap-3 mt-3">
                  <form action={decideExcuse} className="flex items-end gap-2">
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="approve" value="1" />
                    <div className="grow">
                      <label className="label">رد يصل المشارك (اختياري)</label>
                      <input name="decision" className="input" />
                    </div>
                    <SubmitButton className="btn-sm" pendingText="…">قبول</SubmitButton>
                  </form>
                  <form action={decideExcuse} className="flex items-end gap-2">
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="approve" value="0" />
                    <div className="grow">
                      <label className="label">سبب عدم القبول (اختياري)</label>
                      <input name="decision" className="input" />
                    </div>
                    <SubmitButton secondary className="btn-sm" pendingText="…">رفض</SubmitButton>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title={`ما بُتّ فيه (${decided.length})`}>
        {decided.length === 0 ? (
          <Empty>لم يُبتّ في طلب بعد.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>المشارك</th><th>الطلب</th><th>النتيجة</th><th>الردّ</th><th>بتاريخ</th></tr></thead>
              <tbody>
                {decided.map((r) => (
                  <tr key={r.id}>
                    <td>{r.user.name}</td>
                    <td>{EXCUSE_KINDS[r.kind as keyof typeof EXCUSE_KINDS] ?? r.kind}{r.week != null ? ` · الأسبوع ${r.week}` : ""}</td>
                    <td><Badge tone={r.status === "APPROVED" ? "ink" : "default"}>{EXCUSE_STATUS[r.status]}</Badge></td>
                    <td className="text-muted">{r.decision ?? "—"}</td>
                    <td className="text-muted">{r.decidedAt ? formatShort(r.decidedAt) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
