import { requireParticipantView } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Card, Empty } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import { addHabit, deleteHabit, toggleHabit } from "../actions";
import { todayKey } from "@/lib/dates";
import { Trash2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const metadata = { title: "متتبع العادات" };

function lastDays(n: number) {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(todayKey(new Date(Date.now() - i * 86400000)));
  return out;
}

export default async function HabitsPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const user = await requireParticipantView();
  const { ok, err } = await searchParams;
  const habits = await db.habit.findMany({ where: { userId: user.id }, include: { logs: true }, orderBy: { createdAt: "asc" } });
  const days = lastDays(14);
  const today = todayKey();
  const dayLabel = (k: string) => new Intl.DateTimeFormat("ar-EG-u-nu-latn", { day: "numeric", timeZone: "Asia/Riyadh" }).format(new Date(k + "T12:00:00+03:00"));

  return (
    <>
      <PageHeader title="متتبع العادات" subtitle="كفاءة فقه النفس: حدّد ثلاث عادات تبنيها ووثّق التزامك بها 4 أسابيع. تشمل أيضاً جلسات النشاط البدني (8 جلسات)." />
      <FormMessage ok={ok} err={err} />
      {habits.length < 5 && (
        <Card className="mb-4">
          <form action={addHabit} className="flex gap-2">
            <input name="name" className="input" placeholder="عادة جديدة: مثال — ورد قرآني يومي، مشي 30 دقيقة" required />
            <SubmitButton className="shrink-0">إضافة</SubmitButton>
          </form>
        </Card>
      )}
      {habits.length === 0 ? (
        <Empty>لم تضف عادات بعد.</Empty>
      ) : (
        <div className="space-y-3">
          {habits.map((h) => {
            const done = new Set(h.logs.map((l) => l.date));
            const streak = days.slice().reverse().findIndex((d) => !done.has(d));
            return (
              <Card key={h.id}>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div>
                    <div className="font-medium">{h.name}</div>
                    <div className="text-xs text-muted">{h.logs.length} يوم موثق · سلسلة {streak === -1 ? days.length : streak} يوم</div>
                  </div>
                  <form action={deleteHabit}>
                    <input type="hidden" name="id" value={h.id} />
                    <button className="btn btn-ghost btn-sm" aria-label="حذف"><Trash2 size={14} /></button>
                  </form>
                </div>
                <div className="flex gap-1 overflow-x-auto pb-1" dir="ltr">
                  {days.map((d) => (
                    <form key={d} action={toggleHabit}>
                      <input type="hidden" name="habitId" value={h.id} />
                      <input type="hidden" name="date" value={d} />
                      <button
                        title={d}
                        className={cn("w-9 h-11 rounded-lg border text-[11px] flex flex-col items-center justify-center gap-0.5", done.has(d) ? "bg-ink text-paper border-ink" : "border-line-2 text-muted", d === today && "ring-1 ring-ink")}
                      >
                        <span>{dayLabel(d)}</span>
                        {done.has(d) && <Check size={12} />}
                      </button>
                    </form>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
