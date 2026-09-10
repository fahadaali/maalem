import { Card, Badge } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import { saveMentorEvaluation } from "@/app/admin/actions";
import { MENTOR_EVAL_CRITERIA, PARTICIPATION_SCALE } from "@/lib/program";
import { formatShort } from "@/lib/dates";

type Ev = { period: string; regularity: number; engagement: number; application: number; conduct: number; growth: number; notes: string | null; updatedAt: Date };

/** استمارة تقييم المشرف المرافق — أداة قياس المعايشة الميدانية في الخطة */
export default function MentorEvalForm({ userId, name, existing, readOnly }: { userId: string; name: string; existing: Ev[]; readOnly?: boolean }) {
  const periods = ["منتصف البرنامج", "ختامي"];
  const avgOf = (e: Ev) => ((e.regularity + e.engagement + e.application + e.conduct + e.growth) / 5).toFixed(1);
  return (
    <Card title={`تقييم المعايشة الميدانية — ${name}`}>
      <p className="text-xs text-muted mb-3">
        تقييم المشرف المرافق أداة قياس في خطة البرنامج، ويشكّل 30% من درجة المعايشة الميدانية، والساعات المعتمدة 70%.
      </p>
      {periods.map((period) => {
        const e = existing.find((x) => x.period === period);
        return (
          <details key={period} className="border-b border-line last:border-0 py-2" open={!e && !readOnly && period === "منتصف البرنامج"}>
            <summary className="cursor-pointer text-sm flex items-center justify-between gap-2">
              <span className="font-medium">{period}</span>
              {e ? <Badge tone="ink">{avgOf(e)} / 5 · {formatShort(e.updatedAt)}</Badge> : <Badge tone="soft">لم يُقيَّم</Badge>}
            </summary>
            {readOnly ? (
              e ? (
                <ul className="text-sm mt-2 space-y-1">
                  {MENTOR_EVAL_CRITERIA.map((c) => <li key={c.key}>{c.label}: {e[c.key]} / 5</li>)}
                  {e.notes && <li className="text-muted">ملاحظة: {e.notes}</li>}
                </ul>
              ) : <p className="text-sm text-muted mt-2">لا تقييم.</p>
            ) : (
              <form action={saveMentorEvaluation} className="mt-2">
                <input type="hidden" name="userId" value={userId} />
                <input type="hidden" name="period" value={period} />
                <div className="table-wrap">
                  <table className="table">
                    <thead><tr><th>المعيار</th>{PARTICIPATION_SCALE.map((x) => <th key={x.value} className="text-center">{x.value}</th>)}</tr></thead>
                    <tbody>
                      {MENTOR_EVAL_CRITERIA.map((c) => (
                        <tr key={c.key}>
                          <td>{c.label}</td>
                          {PARTICIPATION_SCALE.map((x) => (
                            <td key={x.value} className="text-center">
                              <input type="radio" name={c.key} value={x.value} required defaultChecked={e ? e[c.key] === x.value : false} className="accent-black" />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="field mt-3">
                  <label className="label">ملاحظة للمشارك</label>
                  <textarea name="notes" className="textarea" rows={2} defaultValue={e?.notes ?? ""} />
                </div>
                <SubmitButton className="btn-sm">{e ? "تحديث التقييم" : "حفظ التقييم"}</SubmitButton>
              </form>
            )}
          </details>
        );
      })}
    </Card>
  );
}
