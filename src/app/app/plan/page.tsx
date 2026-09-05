import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Card, Empty } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import { addTadabbur, deleteTadabbur, saveLearningPlan } from "../actions";
import { ACTIVE_WEEKS, currentWeekNumber } from "@/lib/dates";
import { Trash2 } from "lucide-react";

export const metadata = { title: "خطة التعلم الشخصية" };

export default async function PlanPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const user = await requireRole("PARTICIPANT", "ADMIN");
  const { ok, err } = await searchParams;
  const [plan, stops] = await Promise.all([
    db.learningPlan.findUnique({ where: { userId: user.id } }),
    db.tadabburStop.findMany({ where: { userId: user.id }, orderBy: { week: "asc" } }),
  ]);
  const cur = Math.max(0, Math.min(12, currentWeekNumber()));

  return (
    <>
      <PageHeader title="خطة التعلم الشخصية" subtitle="تُسلَّم خلال 3 أيام من اللقاء الافتتاحي، وتُحدَّث كل جمعة. تشمل الخطة الفصلية، والخطة الأسبوعية، وخطة مراجعة المحفوظ." />
      <FormMessage ok={ok} err={err} />
      <Card>
        <form action={saveLearningPlan}>
          <div className="field">
            <label className="label">أهداف الخطة الفصلية للتعلم الذاتي</label>
            <textarea name="goals" className="textarea" rows={5} required defaultValue={plan?.goals ?? ""} placeholder="ما الذي أريد أن أتقنه بنهاية البرنامج؟ ثلاثة إلى خمسة أهداف قابلة للقياس" />
          </div>
          <div className="field">
            <label className="label">الخطة الأسبوعية (متى أقرأ، ومتى أراجع، ومتى أعايش)</label>
            <textarea name="weeklyPlan" className="textarea" rows={5} defaultValue={plan?.weeklyPlan ?? ""} />
          </div>
          <div className="field">
            <label className="label">خطة مراجعة المحفوظ من القرآن الكريم</label>
            <textarea name="memorization" className="textarea" rows={4} defaultValue={plan?.memorization ?? ""} placeholder="السور أو الأجزاء، وجدول المراجعة اليومي" />
          </div>
          <SubmitButton>{plan ? "تحديث الخطة" : "تسليم الخطة"}</SubmitButton>
        </form>
      </Card>

      <h2 className="text-xl mt-8 mb-1">سجل الوقفات التدبرية</h2>
      <p className="text-sm text-muted mb-3">يتناوب المشاركون على تقديم وقفة تدبرية (15 دقيقة) في اللقاء الحضوري. المطلوب 3 وقفات على الأقل.</p>
      <div className="grid md:grid-cols-[1fr_1fr] gap-4 items-start">
        <Card title="وقفة جديدة">
          <form action={addTadabbur}>
            <div className="field">
              <label className="label">الأسبوع</label>
              <select name="week" className="select" defaultValue={cur}>
                {ACTIVE_WEEKS.map((w) => <option key={w.number} value={w.number}>الأسبوع {w.label}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="label">موضوع الوقفة (الآية أو المعنى الإيماني)</label>
              <input name="topic" className="input" required />
            </div>
            <div className="field">
              <label className="label">أبرز ما طُرح</label>
              <textarea name="notes" className="textarea" />
            </div>
            <SubmitButton>تسجيل الوقفة</SubmitButton>
          </form>
        </Card>
        <div className="space-y-2">
          {stops.length === 0 ? <Empty>لا توجد وقفات مسجلة.</Empty> : stops.map((s) => (
            <div key={s.id} className="card flex gap-3 items-start">
              <div className="flex-1">
                <div className="text-xs text-muted">الأسبوع {s.week}</div>
                <div className="font-medium">{s.topic}</div>
                {s.notes && <div className="text-sm text-muted mt-1">{s.notes}</div>}
              </div>
              <form action={deleteTadabbur}>
                <input type="hidden" name="id" value={s.id} />
                <button className="btn btn-ghost btn-sm" aria-label="حذف"><Trash2 size={14} /></button>
              </form>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
