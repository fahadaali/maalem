import Link from "@/components/Link";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Card, Badge } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import { deleteMinutes, saveMinutes } from "../actions";
import { getWeeks, resolveCurrentWeek } from "@/lib/weeks";
import { cn } from "@/lib/utils";
import { cohortWhere } from "@/lib/cohort";

export const metadata = { title: "محاضر اللقاءات" };

export const MINUTES_LABELS: Record<string, string> = {
  INPERSON: "اللقاء الحضوري (السبت)",
  REMOTE: "حلقة النقاش عن بُعد (الثلاثاء)",
  MONTHLY: "اللقاء الشهري مع خبير",
};

export default async function MinutesPage({ searchParams }: { searchParams: Promise<{ week?: string; ok?: string; err?: string }> }) {
  await requireRole("ADMIN");
  const sp = await searchParams;
  const weeks = await getWeeks();
  const cur = resolveCurrentWeek(weeks);
  const parsed = Number(sp.week);
  const week = sp.week != null && Number.isInteger(parsed) ? parsed : Math.max(0, cur);
  const info = weeks.find((w) => w.number === week) ?? weeks[0];
  const [rows, guests] = await Promise.all([
    db.sessionMinutes.findMany({ where: { week, ...(await cohortWhere()) } }),
    db.guest.findMany({ where: { status: { in: ["CONFIRMED", "DONE"] }, ...(await cohortWhere()) }, select: { name: true } }),
  ]);
  const of = (type: string) => rows.find((r) => r.type === type);

  return (
    <>
      <PageHeader
        title="محاضر اللقاءات وحلقات النقاش"
        subtitle="المحضر شاهد متكرر في مصفوفة الكفاءات. دوّنه هنا ليُحفظ في سجل البرنامج ويطّلع عليه المشاركون."
      />
      <FormMessage ok={sp.ok} err={sp.err} />
      <div className="flex gap-1 overflow-x-auto pb-3 mb-3 -mx-4 px-4">
        {weeks.filter((w) => w.number <= 13).map((w) => (
          <Link key={w.number} href={`/admin/minutes?week=${w.number}`} className={cn("badge shrink-0", w.number === week && "badge-ink")}>
            {w.number === 0 ? "الافتتاحي" : w.number === 13 ? "الختامي" : w.number}
          </Link>
        ))}
      </div>
      <p className="text-sm text-muted mb-4">الأسبوع {info.label} · {info.session}</p>
      <div className="space-y-4">
        {Object.entries(MINUTES_LABELS).map(([type, label]) => {
          const m = of(type);
          return (
            <Card key={type} title={label} action={m ? <Badge tone="ink">مُدوَّن</Badge> : <Badge tone="soft">لا محضر</Badge>}>
              <form action={saveMinutes}>
                <input type="hidden" name="week" value={week} />
                <input type="hidden" name="type" value={type} />
                <div className="grid md:grid-cols-3 gap-3">
                  <div className="field">
                    <label className="label">التاريخ</label>
                    <input type="date" name="date" className="input" defaultValue={(m?.date ?? new Date()).toISOString().slice(0, 10)} />
                  </div>
                  <div className="field">
                    <label className="label">العنوان</label>
                    <input name="title" className="input" defaultValue={m?.title ?? (type === "REMOTE" ? info.circle : info.session).slice(0, 80)} />
                  </div>
                  <div className="field">
                    <label className="label">الضيف (إن وُجد)</label>
                    <input name="guestName" className="input" list="guest-names" defaultValue={m?.guestName ?? ""} />
                  </div>
                </div>
                <div className="field">
                  <label className="label">الحاضرون</label>
                  <input name="present" className="input" defaultValue={m?.present ?? ""} placeholder="أسماء الحاضرين" />
                </div>
                <div className="field">
                  <label className="label">نص المحضر</label>
                  <textarea name="minutes" className="textarea" rows={5} required defaultValue={m?.minutes ?? ""} placeholder="أبرز ما طُرح ونوقش" />
                </div>
                <div className="field">
                  <label className="label">القرارات والتكاليف</label>
                  <textarea name="decisions" className="textarea" rows={2} defaultValue={m?.decisions ?? ""} />
                </div>
                <label className="flex items-center gap-2 text-sm mb-3">
                  <input type="checkbox" name="notify" className="accent-black" /> إشعار المشاركين بنشر المحضر
                </label>
                <div className="flex gap-2 flex-wrap">
                  <SubmitButton>{m ? "تحديث المحضر" : "حفظ المحضر"}</SubmitButton>
                </div>
              </form>
              {m && (
                <form action={deleteMinutes} className="mt-2">
                  <input type="hidden" name="week" value={week} />
                  <input type="hidden" name="type" value={type} />
                  <button className="btn btn-ghost btn-sm text-muted">حذف المحضر</button>
                </form>
              )}
            </Card>
          );
        })}
      </div>
      <datalist id="guest-names">
        {guests.map((g) => <option key={g.name} value={g.name} />)}
      </datalist>
    </>
  );
}
