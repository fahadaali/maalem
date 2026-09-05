import { Card, Empty, Badge } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import { approveFieldLog, rejectFieldLog } from "@/app/admin/actions";
import { formatShort } from "@/lib/dates";

type Log = { id: string; date: Date; hours: number; mentorName: string; note: string; approvedAt: Date | null; user: { name: string } };

export default function FieldLogReview({ pending, approved, back }: { pending: Log[]; approved: Log[]; back: string }) {
  return (
    <>
      <h2 className="text-lg mb-2">بانتظار الاعتماد</h2>
      {pending.length === 0 ? <Empty>لا سجلات معلّقة.</Empty> : (
        <div className="space-y-3">
          {pending.map((l) => (
            <Card key={l.id}>
              <div className="flex flex-wrap gap-2 text-xs text-muted mb-1">
                <span className="font-medium text-ink text-sm">{l.user.name}</span><span>{formatShort(l.date)}</span><span>{l.hours} ساعة</span><span>مع {l.mentorName}</span>
              </div>
              <div className="text-sm mb-3">{l.note}</div>
              <div className="flex flex-wrap gap-2 items-center">
                <form action={approveFieldLog}><input type="hidden" name="id" value={l.id} /><input type="hidden" name="back" value={back} /><SubmitButton className="btn-sm">اعتماد</SubmitButton></form>
                <form action={rejectFieldLog} className="flex gap-2"><input type="hidden" name="id" value={l.id} /><input type="hidden" name="back" value={back} /><input name="reason" className="input" placeholder="سبب الرفض (اختياري)" /><SubmitButton secondary className="btn-sm">رفض</SubmitButton></form>
              </div>
            </Card>
          ))}
        </div>
      )}
      <h2 className="text-lg mt-8 mb-2">سجلات معتمدة مؤخراً</h2>
      {approved.length === 0 ? <Empty>لا سجلات معتمدة بعد.</Empty> : (
        <ul className="space-y-1 text-sm">
          {approved.map((l) => <li key={l.id} className="card py-2 flex justify-between gap-2"><span className="truncate">{l.user.name} · {formatShort(l.date)} · {l.hours} س · {l.mentorName}</span><Badge tone="ink">معتمد</Badge></li>)}
        </ul>
      )}
    </>
  );
}
