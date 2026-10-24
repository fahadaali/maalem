import SubmitButton from "@/components/SubmitButton";
import { RUBRIC_LEVEL_LABELS, TASK_RUBRIC } from "@/lib/program";
import { daysLate } from "@/lib/obligations";
import type { SchedulePause } from "@/lib/pause";

type Graded = {
  id: string;
  completeness: number | null;
  referencing: number | null;
  application: number | null;
  punctuality: number | null;
  feedback: string | null;
  gradedAt: Date | null;
  submittedAt: Date;
};

/**
 * «الالتزام بالموعد» مقترحاً من وقت التسليم نفسه: في الموعد 3، وتأخّر يوماً 2،
 * وأكثر 1 — بأيام التقويم بعد طرح أيام الإيقاف، وبالموعد الساري بعد التمديد.
 */
export function suggestedPunctuality(submittedAt: Date, due: Date, pause?: SchedulePause): { value: number; late: number } {
  if (submittedAt.getTime() <= due.getTime()) return { value: 3, late: 0 };
  const late = Math.max(1, daysLate(due, submittedAt, pause));
  return { value: late <= 1 ? 2 : 1, late };
}

/**
 * نموذج التقييم بسلّم التقدير (ملحق 2) — واحدٌ لكل من يقيّم: صفحة المهمة، وملف
 * المشارك، وصفحة المشرف المرافق. كانت ثلاث نسخ: إحداها تقترح «الالتزام بالموعد»
 * من وقت التسليم والأخريان لا، فيختلف التقييم المقترح باختلاف الباب.
 *
 * `returned`: التسليم مُرجَع إلى صاحبه — لا يُقيَّم حتى يعيده، فيُقال بدل النموذج.
 */
export default function RubricGradeForm({
  action,
  s,
  due,
  pause,
  back,
  returned,
}: {
  action: (formData: FormData) => Promise<void>;
  s: Graded;
  due: Date;
  pause?: SchedulePause;
  back?: string;
  returned?: boolean;
}) {
  if (returned) {
    return <p className="text-sm text-muted border-t border-line pt-3 mt-3">مُرجَعٌ إلى صاحبه للتعديل — يُقيَّم بعد أن يعيده، أو يُلغى الإرجاع من ملفه.</p>;
  }
  const suggestion = suggestedPunctuality(s.submittedAt, due, pause);
  const values: Record<string, number | null> = {
    completeness: s.completeness,
    referencing: s.referencing,
    application: s.application,
    punctuality: s.punctuality ?? suggestion.value,
  };
  return (
    <form action={action} className="border-t border-line pt-3 mt-3">
      <input type="hidden" name="id" value={s.id} />
      {back && <input type="hidden" name="back" value={back} />}
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>المعيار</th>{RUBRIC_LEVEL_LABELS.map((l) => <th key={l} className="text-center">{l}</th>)}</tr></thead>
          <tbody>
            {TASK_RUBRIC.map((r) => (
              <tr key={r.key}>
                <td className="font-medium whitespace-nowrap">
                  {r.criterion}
                  {r.key === "punctuality" && s.punctuality == null && (
                    <div className="text-[11px] text-muted font-normal">
                      مقترحٌ من وقت التسليم: {suggestion.late ? `تأخّر ${suggestion.late === 1 ? "يوماً" : suggestion.late === 2 ? "يومين" : `${suggestion.late} أيام`}` : "في الموعد"}
                    </div>
                  )}
                </td>
                {r.levels.map((desc, i) => {
                  const val = 4 - i;
                  return (
                    <td key={val}>
                      <label className="flex items-start gap-1.5 cursor-pointer text-xs">
                        <input type="radio" name={r.key} value={val} required defaultChecked={values[r.key] === val} className="accent-black mt-0.5" />
                        <span>{desc}</span>
                      </label>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="field mt-3"><label className="label">تغذية راجعة</label><textarea name="feedback" className="textarea" rows={2} defaultValue={s.feedback ?? ""} /></div>
      <SubmitButton className="btn-sm">{s.gradedAt ? "تحديث التقييم" : "اعتماد التقييم"}</SubmitButton>
    </form>
  );
}
