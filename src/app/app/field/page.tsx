import { isPreview, requireParticipantView } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Card, Empty, Progress, Badge } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import Link from "@/components/Link";
import { addFieldLog, deleteFieldLog, updateFieldLog } from "../actions";
import { formatShort, todayKey } from "@/lib/dates";
import { MENTOR_EVAL_CRITERIA } from "@/lib/program";
import { Pencil, Trash2 } from "lucide-react";
import { loadParticipant, loadProgram } from "@/lib/participant-data";
import { openReturnFor } from "@/lib/returns";
import { originalDue } from "@/lib/obligations";
import ReturnedBanner from "@/components/ReturnedBanner";
import Attachments from "@/components/Attachments";
import { programExpectations } from "@/lib/content";
import { toItem } from "@/lib/attachments";

export const metadata = { title: "المعايشة الميدانية" };

export default async function FieldPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string; edit?: string }> }) {
  const user = await requireParticipantView();
  const { ok, err, edit } = await searchParams;
  const [logs, me, evals] = await Promise.all([
    db.fieldLog.findMany({ where: { userId: user.id }, orderBy: { date: "desc" } }),
    db.user.findUnique({ where: { id: user.id }, include: { mentor: { select: { name: true } } } }),
    db.mentorEvaluation.findMany({ where: { userId: user.id }, orderBy: { period: "asc" } }),
  ]);
  const attRows = await db.attachment.findMany({ where: { kind: "FIELD", userId: user.id }, orderBy: { createdAt: "asc" } });
  const [expected, preview] = await Promise.all([programExpectations(), isPreview()]);
  const last = logs[0];
  const [rows, program] = await Promise.all([loadParticipant(user.id), loadProgram()]);
  const returnOf = (id: string) => openReturnFor(rows?.returns ?? [], "FIELD_LOG", id);
  // المُرجَع لا يُحسب في ساعاتك حتى تعيده — كما في درجتك و«مهامي»
  const approved = logs.filter((l) => l.approvedAt && !returnOf(l.id)).reduce((s, l) => s + l.hours, 0);
  const pending = logs.filter((l) => !l.approvedAt && !returnOf(l.id)).reduce((s, l) => s + l.hours, 0);
  // سجلٌ يُعدَّل: ما لم يُعتمد بعد، أو ما أُرجع إلى صاحبه بعد اعتماده
  const editable = (l: (typeof logs)[number]) => !l.approvedAt || !!returnOf(l.id);
  const editing = edit ? logs.find((l) => l.id === edit && editable(l)) : undefined;
  const returnedLogs = logs.filter((l) => returnOf(l.id));

  return (
    <>
      <PageHeader title="سجل المعايشة الميدانية" subtitle={`ساعة أسبوعياً على الأقل مع مشرف خبير أو مجموعة تربوية، من الأسبوع 3 إلى الأسبوع 12 (${expected.fieldHours} ساعة موثقة). يعتمد المشرف المرافق أو مدير المشروع كل سجل.`} />
      <FormMessage ok={ok} err={err} />
      {returnedLogs.map((l) => {
        const r = returnOf(l.id)!;
        return rows ? <ReturnedBanner key={l.id} note={r.note} by={r.returnedBy} due={originalDue("FIELD_LOG", { date: l.date }, rows, program.weeks)} action={`سجل ${formatShort(l.date)} (${l.hours} ساعة): عدّله من زرّ التعديل عليه ثم احفظه.`} /> : null;
      })}
      <div className="grid md:grid-cols-[1fr_320px] gap-4 items-start">
        <Card title={editing ? "تعديل سجل المعايشة" : "تسجيل معايشة"}>
          <form id="form" key={editing?.id ?? "new"} action={editing ? updateFieldLog : addFieldLog}>
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <div className="grid grid-cols-2 gap-3">
              <div className="field">
                <label className="label">التاريخ</label>
                <input type="date" name="date" className="input" defaultValue={editing ? todayKey(editing.date) : todayKey()} max={todayKey()} required />
              </div>
              <div className="field">
                <label className="label">المدة (ساعات)</label>
                <input type="number" name="hours" className="input" step="0.5" min="0.5" max="12" defaultValue={editing ? editing.hours : 1} required inputMode="decimal" />
              </div>
            </div>
            <div className="field">
              <label className="label">المشرف المرافق / المجموعة</label>
              <input name="mentorName" className="input" defaultValue={editing?.mentorName ?? last?.mentorName ?? me?.mentor?.name ?? ""} required />
            </div>
            <div className="field">
              <label className="label">أهم ملاحظة من المعايشة</label>
              <textarea name="note" className="textarea" required placeholder="ما لاحظته وتعلمته، مع حفظ سرية المتربين" defaultValue={editing?.note ?? ""} />
            </div>
            <div className="flex flex-wrap gap-2">
              <SubmitButton>{editing ? (returnOf(editing.id) ? "أعد السجل إلى الاعتماد" : "حفظ التعديل") : "حفظ السجل"}</SubmitButton>
              {editing && <Link href="/app/field" className="btn btn-ghost">إلغاء</Link>}
            </div>
          </form>
        </Card>
        <Card title="الساعات">
          <Progress label="ساعات معتمدة" value={approved} max={expected.fieldHours} />
          <div className="text-xs text-muted mt-2">{approved} ساعة معتمدة من {expected.fieldHours}{pending > 0 ? ` · ${pending} ساعة بانتظار الاعتماد` : ""}</div>
        </Card>
      </div>

      {evals.length > 0 && (
        <Card title="تقييم المشرف المرافق" className="mt-4">
          {evals.map((e) => (
            <div key={e.id} className="border-b border-line last:border-0 py-2 text-sm">
              <div className="flex justify-between gap-2">
                <span className="font-medium">{e.period}</span>
                <Badge tone="ink">{((e.regularity + e.engagement + e.application + e.conduct + e.growth) / 5).toFixed(1)} / 5</Badge>
              </div>
              <ul className="text-xs text-muted mt-1 flex flex-wrap gap-x-4">
                {MENTOR_EVAL_CRITERIA.map((c) => <li key={c.key}>{c.label}: {e[c.key]}</li>)}
              </ul>
              {e.notes && <p className="text-sm mt-1">{e.notes}</p>}
            </div>
          ))}
        </Card>
      )}

      <h2 className="text-xl mt-8 mb-3">السجلات</h2>
      {logs.length === 0 ? (
        <Empty>لا توجد سجلات معايشة بعد.</Empty>
      ) : (
        <div className="space-y-2">
          {logs.map((l) => (
            <div key={l.id} id={`log-${l.id}`} className={`card flex gap-3 items-start ${returnOf(l.id) ? "border-ink" : ""}`}>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                  <span>{formatShort(l.date)}</span>
                  <span>{l.hours} ساعة</span>
                  <span>مع {l.mentorName}</span>
                  {returnOf(l.id) ? <Badge tone="ink">أُرجع إليك</Badge> : l.approvedAt ? <Badge tone="ink">معتمد</Badge> : <Badge>بانتظار الاعتماد</Badge>}
                </div>
                <div className="text-sm mt-1">{l.note}</div>
                <div className="mt-2"><Attachments kind="FIELD" refId={l.id} initial={attRows.filter((r) => r.refId === l.id).map(toItem)} readOnly={!editable(l) || preview} /></div>
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                {editable(l) && (
                  <Link href={`/app/field?edit=${l.id}#form`} className="btn btn-ghost btn-sm" aria-label="تعديل" title="تعديل"><Pencil size={14} /></Link>
                )}
                {!l.approvedAt && (
                  <form action={deleteFieldLog}>
                    <input type="hidden" name="id" value={l.id} />
                    <SubmitButton ghost className="btn-sm" label="حذف" pendingText="…" confirm="حذف سجل المعايشة وملفاته؟"><Trash2 size={14} /></SubmitButton>
                  </form>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
