import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Card, Badge, Empty } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import { activateCohort, closeCohort, completeResume, createCohort, pauseCohort, resumeCohort, updatePauseUntil } from "../actions";
import { calendarDays, formatDateTime, formatGregorian, formatHijri, formatShort, keyToDate, todayKey } from "@/lib/dates";
import { countShift, parsePauseLog, resumeError, shiftDaysFor, suggestResume, weeksText, type ShiftItem } from "@/lib/pause";
import { resumeItems, loadResumeInputs, unfinished } from "@/lib/resume";
import { weekName } from "@/lib/obligations";

export const metadata = { title: "الدفعات" };

export default async function CohortsPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string; resume?: string }> }) {
  await requireRole("ADMIN");
  const { ok, err, resume } = await searchParams;
  const cohorts = await db.cohort.findMany({
    orderBy: { startDate: "desc" },
    include: { _count: { select: { users: true, assignments: true, quizzes: true, weeks: true } } },
  });

  return (
    <>
      <PageHeader
        title="الدفعات"
        subtitle="لكل دفعة مشاركوها وجدولها ومهامها واختباراتها وميزانيتها وتقاريرها، لا تختلط بغيرها. المنصة تعمل على الدفعة النشطة."
      />
      <FormMessage ok={ok} err={err} />
      <div className="grid md:grid-cols-[1fr_340px] gap-4 items-start">
        <div className="space-y-3">
          {cohorts.length === 0 ? (
            <Empty>لا دفعات بعد.</Empty>
          ) : (
            cohorts.map((c) => (
              <Card key={c.id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-muted">
                      اللقاء الافتتاحي {formatHijri(keyToDate(c.startDate))} — {formatGregorian(keyToDate(c.startDate))}
                    </div>
                    <div className="text-xs text-muted mt-1">
                      {c._count.users} مستخدماً · {c._count.weeks} أسبوعاً · {c._count.assignments} مهمة · {c._count.quizzes} اختباراً
                    </div>
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {c.active && <Badge tone="ink">نشطة</Badge>}
                    {c.pausedAt && <Badge tone="ink">موقوفة مؤقتاً</Badge>}
                    {c.closedAt && <Badge>مغلقة</Badge>}
                  </div>
                </div>
                {c.pausedAt ? (
                  <PausedPanel cohort={{ ...c, pausedAt: c.pausedAt }} resume={resume} />
                ) : (
                  c.active && !c.closedAt && <PauseForm id={c.id} />
                )}
                <PauseHistory id={c.id} pauses={c.pauses} />
                <div className="flex gap-2 mt-3 flex-wrap">
                  {!c.active && (
                    <form action={activateCohort}>
                      <input type="hidden" name="id" value={c.id} />
                      <SubmitButton className="btn-sm">تفعيل هذه الدفعة</SubmitButton>
                    </form>
                  )}
                  <form action={closeCohort}>
                    <input type="hidden" name="id" value={c.id} />
                    <SubmitButton secondary className="btn-sm">{c.closedAt ? "إعادة فتح" : "إغلاق الدفعة"}</SubmitButton>
                  </form>
                </div>
              </Card>
            ))
          )}
        </div>
        <Card title="دفعة جديدة">
          <form action={createCohort}>
            <div className="field">
              <label className="label">اسم الدفعة</label>
              <input name="name" className="input" required placeholder="الدفعة الثالثة — الفصل الدراسي الثاني 1448هـ" />
            </div>
            <div className="field">
              <label className="label">تاريخ اللقاء الافتتاحي (السبت)</label>
              <input type="date" name="startDate" className="input" required />
            </div>
            <SubmitButton>إنشاء الدفعة</SubmitButton>
          </form>
          <p className="text-xs text-muted mt-3">
            تُنشأ أسابيع الجدول الأربعة عشر بمواعيد محسوبة من تاريخ اللقاء الافتتاحي، وبنود الميزانية من الخطة.
            المكتبة والمواد مشتركة بين الدفعات، فلا تُكرَّر.
          </p>
        </Card>
      </div>
    </>
  );
}

/** نموذج الإيقاف: سببٌ وعودةٌ متوقعة، كلاهما اختياري ويصلان المشاركين في الإشعار */
function PauseForm({ id }: { id: string }) {
  return (
    <details className="mt-3 border-t border-line pt-3">
      <summary className="text-sm cursor-pointer">إيقاف مؤقت</summary>
      <form action={pauseCohort} className="mt-2">
        <input type="hidden" name="id" value={id} />
        <div className="field">
          <label className="label">السبب (يصل المشاركين والمشرفين)</label>
          <input name="reason" className="input" maxLength={300} placeholder="إجازة منتصف الفصل" />
        </div>
        <div className="field">
          <label className="label">سبت العودة المتوقع (اختياري)</label>
          <input type="date" name="until" className="input" min={todayKey()} />
        </div>
        <p className="text-xs text-muted mb-2">
          يقف زمن البرنامج من لحظة الإيقاف: يبقى الأسبوع الحالي، ويقف عدّاد التأخير، وتُحبس التذكيرات، ولا يُقبل إلا تسليم ما تأخّر قبله.
          ولا تُمسّ المواعيد الآن؛ تُزاح بأسابيع كاملة عند الاستئناف.
        </p>
        <SubmitButton secondary className="btn-sm" confirm="إيقاف الدفعة مؤقتاً وإشعار مشاركيها ومشرفيها؟">أوقف الدفعة مؤقتاً</SubmitButton>
      </form>
    </details>
  );
}

const SHIFT_LABELS: Record<ShiftItem["m"], string> = { week: "أسبوع", start: "انطلاق الدفعة", assignment: "مهمة", extension: "تمديد", reminder: "تذكير" };

function shiftLine(i: ShiftItem): string {
  const when = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? formatShort(keyToDate(v)) : formatDateTime(new Date(v)));
  const what = i.m === "week" ? weekName(i.number) : i.m === "assignment" || i.m === "reminder" ? i.title : SHIFT_LABELS[i.m];
  return `${SHIFT_LABELS[i.m]} · ${what}: ${when(i.from)} ← ${when(i.to)}`;
}

/**
 * الدفعة الموقوفة: منذ متى ولماذا، والعودة المتوقعة، ونموذج الاستئناف بمعاينةٍ لما
 * سيُزاح. المعاينة والاستئناف من الدالة نفسها، فما يُرى قبل الضغط هو ما يُكتب.
 */
async function PausedPanel({ cohort: c, resume }: { cohort: { id: string; startDate: string; pausedAt: Date; pauseReason: string | null; pauseUntil: string | null; pausedBy: string | null; pauses: string }; resume?: string }) {
  const now = new Date();
  const paused = { id: c.id, startDate: c.startDate, pausedAt: c.pausedAt };
  const { ref } = await loadResumeInputs(paused);
  const suggested = suggestResume(ref, c.pausedAt, now, c.pauseUntil);
  // تاريخٌ آخر للمعاينة من الرابط؛ وإن لم يصلح عُرض سببه وبقي المقترح
  const picked = resume && resume !== suggested ? resume : null;
  const pickedError = picked ? resumeError(picked, ref, now) : null;
  const resumeOn = picked && !pickedError ? picked : suggested;
  const shiftDays = shiftDaysFor(ref, resumeOn);
  const { items, weeks } = await resumeItems(paused, shiftDays);
  const moved = countShift(items);
  const next = weeks.filter((w) => w.gregorian >= ref).sort((a, b) => a.gregorian.localeCompare(b.gregorian))[0];
  const days = calendarDays(c.pausedAt, now);

  return (
    <div className="mt-3 border-t border-line pt-3 space-y-3">
      <div className="text-sm">
        <div>
          موقوفة منذ {formatDateTime(c.pausedAt)}
          {days > 0 ? ` — مضى ${days === 1 ? "يوم" : days === 2 ? "يومان" : days <= 10 ? `${days} أيام` : `${days} يوماً`}` : ""}
          {c.pausedBy ? ` — ${c.pausedBy}` : ""}
        </div>
        {c.pauseReason && <div className="text-muted whitespace-pre-wrap">{c.pauseReason}</div>}
      </div>

      <form action={updatePauseUntil} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="id" value={c.id} />
        <div className="field !mb-0">
          <label className="label">سبت العودة المتوقع</label>
          <input type="date" name="until" className="input" defaultValue={c.pauseUntil ?? ""} min={todayKey()} />
        </div>
        <SubmitButton secondary className="btn-sm">حفظ وإشعار</SubmitButton>
      </form>

      <div className="card card-muted">
        <div className="font-medium mb-2">الاستئناف</div>
        <form method="get" className="flex flex-wrap items-end gap-2 mb-2">
          <div className="field !mb-0">
            <label className="label">سبت الاستئناف</label>
            <input type="date" name="resume" className="input" defaultValue={resumeOn} min={todayKey()} />
          </div>
          <button className="btn btn-secondary btn-sm">معاينة</button>
        </form>
        {pickedError && <p className="text-xs mb-2">{pickedError} — عُرض المقترح بدلاً منه.</p>}
        <p className="text-sm">
          {next ? `يبدأ ${weekName(next.number)} ${formatShort(keyToDate(resumeOn))} بدل ${formatShort(keyToDate(next.gregorian))}` : `تُستأنف المواعيد المتبقية من ${formatShort(keyToDate(resumeOn))}`}
          {shiftDays ? `، وتُزاح المواعيد المتبقية ${weeksText(shiftDays)}` : "، بلا إزاحة"}.
        </p>
        <p className="text-xs text-muted mt-1">
          {[moved.weeks && `${moved.weeks} أسبوعاً`, moved.tasks && `${moved.tasks} مهمة`, moved.extensions && `${moved.extensions} تمديداً`, moved.reminders && `${moved.reminders} تذكيراً`].filter(Boolean).join(" · ") || "لا شيء يُزاح"}
          {shiftDays === 0 ? ". ما وقع موعده في الإيقاف يصير متأخراً من يوم الاستئناف، ولا تُحسب عليه أيام الإيقاف." : ". وما بقي من الأسبوع الذي أُوقف فيه يُزاح معه."}
        </p>
        {items.length > 0 && (
          <details className="mt-2">
            <summary className="text-xs cursor-pointer">المواعيد قبل الإزاحة وبعدها</summary>
            <ul className="text-xs text-muted mt-1 space-y-0.5">
              {items.map((i) => (
                <li key={`${i.m}-${i.id}`}>{shiftLine(i)}</li>
              ))}
            </ul>
          </details>
        )}
        <form action={resumeCohort} className="mt-3">
          <input type="hidden" name="id" value={c.id} />
          <input type="hidden" name="resumeOn" value={resumeOn} />
          <SubmitButton className="btn-sm" confirm={`استئناف الدفعة ${formatShort(keyToDate(resumeOn))} وإزاحة المواعيد المتبقية${shiftDays ? ` ${weeksText(shiftDays)}` : ""}؟`}>
            استأنف الدفعة
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}

function CompleteResume({ id, left }: { id: string; left: number }) {
  return (
    <form action={completeResume} className="mt-3 card card-muted flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <span className="text-sm flex-1">لم تكتمل إزاحة الاستئناف الأخير: بقي {left} بنداً.</span>
      <SubmitButton className="btn-sm">أكمل الإزاحة</SubmitButton>
    </form>
  );
}

/** الإيقافات السابقة: مدتها، وإزاحتها، وما أُزيح بها — والإزاحة التي لم تكتمل */
function PauseHistory({ id, pauses }: { id: string; pauses: string }) {
  const log = parsePauseLog(pauses);
  if (!log.length) return null;
  const pending = unfinished(pauses);
  return (
    <>
      {pending && <CompleteResume id={id} left={pending.pending.length} />}
      <details className="mt-3 border-t border-line pt-3">
        <summary className="text-xs text-muted cursor-pointer">الإيقافات السابقة ({log.length})</summary>
        <ul className="text-xs text-muted mt-1 space-y-1">
          {[...log].reverse().map((e) => {
            const m = e.moved ?? { weeks: 0, tasks: 0, extensions: 0, reminders: 0 };
            return (
              <li key={e.at}>
                من {formatDateTime(new Date(e.at))} إلى {formatDateTime(new Date(e.end))}
                {e.reason ? ` — ${e.reason}` : ""}
                {" · "}
                {e.shiftDays ? `أُزيح ${weeksText(e.shiftDays)}: ${m.weeks} أسبوعاً، ${m.tasks} مهمة، ${m.extensions} تمديداً، ${m.reminders} تذكيراً` : "بلا إزاحة"}
                {e.resumedBy ? ` · استأنفها ${e.resumedBy}` : ""}
              </li>
            );
          })}
        </ul>
      </details>
    </>
  );
}
