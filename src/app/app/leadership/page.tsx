import { requireParticipantView } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Card, Empty, Badge } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import { addLeadershipActivity, submitPeerEvaluation, updateLeadershipReport } from "../actions";
import { formatShort, todayKey } from "@/lib/dates";
import { PEER_CRITERIA } from "@/lib/program";

export const metadata = { title: "الدور القيادي" };

export default async function LeadershipPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const user = await requireParticipantView();
  const { ok, err } = await searchParams;
  const [mine, others] = await Promise.all([
    db.leadershipActivity.findMany({ where: { userId: user.id }, orderBy: { date: "desc" }, include: { evaluations: { include: { evaluator: { select: { name: true } } } } } }),
    db.leadershipActivity.findMany({ where: { userId: { not: user.id } }, orderBy: { date: "desc" }, include: { user: { select: { name: true } }, evaluations: { where: { evaluatorId: user.id } } } }),
  ]);
  const avg = (evs: { c1: number; c2: number; c3: number; c4: number; c5: number }[]) => (evs.length ? (evs.reduce((s, e) => s + (e.c1 + e.c2 + e.c3 + e.c4 + e.c5) / 5, 0) / evs.length).toFixed(1) : "—");

  return (
    <>
      <PageHeader title="الدور القيادي وتقييم الأقران" subtitle="يقود كل مشارك حلقة نقاش أو نشاطاً ميدانياً واحداً على الأقل (الأسبوع 5–12)، ويُقيَّم من أقرانه باستمارة تقييم الأقران (ملحق 5) بما لا يقل عن 3 من 5." />
      <FormMessage ok={ok} err={err} />

      <div className="grid md:grid-cols-2 gap-4 items-start">
        <Card title="تسجيل نشاط قدته">
          <form action={addLeadershipActivity}>
            <div className="field">
              <label className="label">عنوان النشاط أو الحلقة</label>
              <input name="title" className="input" required placeholder="مثال: إدارة حلقة نقاش كتاب المراهق" />
            </div>
            <div className="field">
              <label className="label">التاريخ</label>
              <input type="date" name="date" className="input" defaultValue={todayKey()} required />
            </div>
            <div className="field">
              <label className="label">تقرير النشاط (يمكن إكماله لاحقاً)</label>
              <textarea name="report" className="textarea" placeholder="الهدف، وما جرى، والدروس المستفادة" />
            </div>
            <SubmitButton>تسجيل وإشعار الأقران</SubmitButton>
          </form>
        </Card>

        <div className="space-y-3">
          <h2 className="text-lg">أنشطتي</h2>
          {mine.length === 0 ? (
            <Empty>لم تسجل نشاطاً قيادياً بعد.</Empty>
          ) : (
            mine.map((a) => (
              <Card key={a.id}>
                <div className="flex justify-between gap-2">
                  <div>
                    <div className="font-medium">{a.title}</div>
                    <div className="text-xs text-muted">{formatShort(a.date)} · {a.evaluations.length} تقييم</div>
                  </div>
                  <Badge tone="ink">{avg(a.evaluations)} / 5</Badge>
                </div>
                {a.evaluations.some((e) => e.comment) && (
                  <ul className="text-sm text-muted mt-2 space-y-1">
                    {a.evaluations.filter((e) => e.comment).map((e) => <li key={e.id}>«{e.comment}»</li>)}
                  </ul>
                )}
                <details className="mt-2 text-sm">
                  <summary className="cursor-pointer text-muted">تقرير النشاط</summary>
                  <form action={updateLeadershipReport} className="mt-2">
                    <input type="hidden" name="id" value={a.id} />
                    <textarea name="report" className="textarea" defaultValue={a.report ?? ""} />
                    <SubmitButton className="btn-sm mt-2" secondary>حفظ التقرير</SubmitButton>
                  </form>
                </details>
              </Card>
            ))
          )}
        </div>
      </div>

      <h2 className="text-xl mt-8 mb-3">تقييم أنشطة زملائي</h2>
      {others.length === 0 ? (
        <Empty>لا توجد أنشطة لزملائك بانتظار تقييمك.</Empty>
      ) : (
        <div className="space-y-3">
          {others.map((a) => {
            const mineEval = a.evaluations[0];
            return (
              <Card key={a.id}>
                <div className="flex flex-wrap justify-between gap-2 mb-2">
                  <div>
                    <div className="font-medium">{a.title}</div>
                    <div className="text-xs text-muted">قادها {a.user.name} · {formatShort(a.date)}</div>
                  </div>
                  {mineEval && <Badge tone="ink">قيّمته</Badge>}
                </div>
                <form action={submitPeerEvaluation}>
                  <input type="hidden" name="activityId" value={a.id} />
                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr><th>المعيار</th>{[5, 4, 3, 2, 1].map((n) => <th key={n} className="text-center">{n}</th>)}</tr>
                      </thead>
                      <tbody>
                        {PEER_CRITERIA.map((c) => (
                          <tr key={c.key}>
                            <td>{c.label}</td>
                            {[5, 4, 3, 2, 1].map((n) => (
                              <td key={n} className="text-center">
                                <input type="radio" name={c.key} value={n} required defaultChecked={mineEval ? mineEval[c.key] === n : false} className="accent-black" />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="field mt-3">
                    <input name="comment" className="input" placeholder="ملاحظة للزميل (اختياري)" defaultValue={mineEval?.comment ?? ""} />
                  </div>
                  <SubmitButton secondary className="btn-sm">{mineEval ? "تحديث التقييم" : "إرسال التقييم"}</SubmitButton>
                </form>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
