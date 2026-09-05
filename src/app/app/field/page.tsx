import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Card, Empty, Progress, Badge } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import { addFieldLog, deleteFieldLog } from "../actions";
import { formatShort, todayKey } from "@/lib/dates";
import { Trash2 } from "lucide-react";
import Attachments from "@/components/Attachments";

export const metadata = { title: "المعايشة الميدانية" };

export default async function FieldPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const user = await requireRole("PARTICIPANT");
  const { ok, err } = await searchParams;
  const [logs, me] = await Promise.all([
    db.fieldLog.findMany({ where: { userId: user.id }, orderBy: { date: "desc" } }),
    db.user.findUnique({ where: { id: user.id }, include: { mentor: { select: { name: true } } } }),
  ]);
  const attRows = await db.attachment.findMany({ where: { kind: "FIELD", userId: user.id }, orderBy: { createdAt: "asc" } });
  const approved = logs.filter((l) => l.approvedAt).reduce((s, l) => s + l.hours, 0);
  const pending = logs.filter((l) => !l.approvedAt).reduce((s, l) => s + l.hours, 0);
  const last = logs[0];

  return (
    <>
      <PageHeader title="سجل المعايشة الميدانية" subtitle="ساعة أسبوعياً على الأقل مع مشرف خبير أو مجموعة تربوية، من الأسبوع 3 إلى الأسبوع 12 (12 ساعة موثقة). يعتمد المشرف المرافق أو مدير المشروع كل سجل." />
      <FormMessage ok={ok} err={err} />
      <div className="grid md:grid-cols-[1fr_320px] gap-4 items-start">
        <Card title="تسجيل معايشة">
          <form action={addFieldLog}>
            <div className="grid grid-cols-2 gap-3">
              <div className="field">
                <label className="label">التاريخ</label>
                <input type="date" name="date" className="input" defaultValue={todayKey()} required />
              </div>
              <div className="field">
                <label className="label">المدة (ساعات)</label>
                <input type="number" name="hours" className="input" step="0.5" min="0.5" max="12" defaultValue="1" required inputMode="decimal" />
              </div>
            </div>
            <div className="field">
              <label className="label">المشرف المرافق / المجموعة</label>
              <input name="mentorName" className="input" defaultValue={last?.mentorName ?? me?.mentor?.name ?? ""} required />
            </div>
            <div className="field">
              <label className="label">أهم ملاحظة من المعايشة</label>
              <textarea name="note" className="textarea" required placeholder="ما لاحظته وتعلمته، مع حفظ سرية المتربين" />
            </div>
            <SubmitButton>حفظ السجل</SubmitButton>
          </form>
        </Card>
        <Card title="الساعات">
          <Progress label="ساعات معتمدة" value={approved} max={12} />
          <div className="text-xs text-muted mt-2">{approved} ساعة معتمدة من 12{pending > 0 ? ` · ${pending} ساعة بانتظار الاعتماد` : ""}</div>
        </Card>
      </div>

      <h2 className="text-xl mt-8 mb-3">السجلات</h2>
      {logs.length === 0 ? (
        <Empty>لا توجد سجلات معايشة بعد.</Empty>
      ) : (
        <div className="space-y-2">
          {logs.map((l) => (
            <div key={l.id} className="card flex gap-3 items-start">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                  <span>{formatShort(l.date)}</span>
                  <span>{l.hours} ساعة</span>
                  <span>مع {l.mentorName}</span>
                  {l.approvedAt ? <Badge tone="ink">معتمد</Badge> : <Badge>بانتظار الاعتماد</Badge>}
                </div>
                <div className="text-sm mt-1">{l.note}</div>
                <div className="mt-2"><Attachments kind="FIELD" refId={l.id} initial={attRows.filter((r) => r.refId === l.id).map((r) => ({ id: r.id, name: r.name, size: r.size, url: `/api/files/${r.key}` }))} readOnly={!!l.approvedAt} /></div>
              </div>
              {!l.approvedAt && (
                <form action={deleteFieldLog}>
                  <input type="hidden" name="id" value={l.id} />
                  <button className="btn btn-ghost btn-sm" aria-label="حذف"><Trash2 size={14} /></button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
