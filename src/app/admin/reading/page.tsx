import Link from "@/components/Link";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Card, Badge, Empty } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import WeekChips from "@/components/WeekChips";
import { reviewCards, reviewItem } from "../participants/actions";
import { participantsWhere } from "@/lib/cohort";
import { formatDateTime, formatShort } from "@/lib/dates";
import { getActiveWeeks, resolveCurrentWeek, getWeeks, weekResolver } from "@/lib/weeks";
import { cardPages, equivalentDays, isLargeAmount, weekQuota } from "@/lib/reading-quota";
import { daysLabel, cn, pagesText } from "@/lib/utils";
import { itemAnchor } from "@/lib/items";
import { weekName } from "@/lib/obligations";

export const metadata = { title: "القراءة والخطط" };

/**
 * مراجعة بطاقات القراءة وخطط التعلم للدفعة كلها — بند روتين المدير «تدقيق بطاقات
 * القراءة» كل خميس، ولم يكن له في المنصة موضعٌ تُقرأ فيه البطاقات أصلاً.
 * البطاقات بأسبوعها، غير المراجَع وذو المقدار الكبير أولاً، مع اعتمادٍ بملاحظة
 * لكل بطاقة، واعتمادِ المعروض دفعةً واحدة.
 */
export default async function AdminReadingPage({ searchParams }: { searchParams: Promise<{ tab?: string; week?: string; who?: string; ok?: string; err?: string }> }) {
  await requireRole("ADMIN");
  const sp = await searchParams;
  const tab = sp.tab === "plans" ? "plans" : "cards";
  const [weeks, activeWeeks, participants] = await Promise.all([getWeeks(), getActiveWeeks(), db.user.findMany({ where: await participantsWhere(), select: { id: true, name: true }, orderBy: { name: "asc" } })]);
  const ids = participants.map((p) => p.id);
  const nameOf = new Map(participants.map((p) => [p.id, p.name]));
  const cur = resolveCurrentWeek(weeks);
  const parsed = Number(sp.week);
  const week = sp.week != null && Number.isInteger(parsed) ? parsed : Math.max(0, Math.min(12, cur));
  const who = sp.who && nameOf.has(sp.who) ? sp.who : undefined;
  const back = `/admin/reading?tab=${tab}&week=${week}${who ? `&who=${who}` : ""}`;

  const tabs = (
    <nav className="flex gap-1 mb-4" aria-label="أقسام الصفحة">
      <Link href={`/admin/reading?week=${week}`} prefetch={false} className={cn("badge !py-1 !px-3", tab === "cards" && "badge-ink")} aria-current={tab === "cards" ? "page" : undefined}>بطاقات القراءة</Link>
      <Link href="/admin/reading?tab=plans" prefetch={false} className={cn("badge !py-1 !px-3", tab === "plans" && "badge-ink")} aria-current={tab === "plans" ? "page" : undefined}>خطط التعلم</Link>
    </nav>
  );

  if (tab === "plans") {
    const plans = await db.learningPlan.findMany({ where: { userId: { in: ids } }, orderBy: { updatedAt: "desc" } });
    const sorted = [...plans].sort((a, b) => Number(!!a.reviewedAt) - Number(!!b.reviewedAt));
    const missing = participants.filter((p) => !plans.some((x) => x.userId === p.id));
    return (
      <>
        <PageHeader title="القراءة والخطط" subtitle="خطط التعلم الشخصية وخطط مراجعة المحفوظ للدفعة، كاملةً بمراجعتها." />
        <FormMessage ok={sp.ok} err={sp.err} />
        {tabs}
        {missing.length > 0 && <div className="card card-muted text-sm mb-4">لم يكتب خطته بعد: {missing.map((m) => m.name).join("، ")}</div>}
        {sorted.length === 0 ? <Empty>لا خطط بعد.</Empty> : (
          <div className="space-y-3">
            {sorted.map((p) => (
              <Card
                key={p.id}
                title={<Link href={`/admin/participants/${p.userId}?tab=reading#${itemAnchor("LEARNING_PLAN", p.id)}`} prefetch={false} className="hover:underline">{nameOf.get(p.userId)}</Link>}
                action={p.reviewedAt ? <Badge tone="ink">رُوجعت</Badge> : <Badge>لم تُراجَع</Badge>}
              >
                <div className="text-xs text-muted mb-2">آخر تحديث {formatDateTime(p.updatedAt)}</div>
                <dl className="space-y-2 text-sm">
                  <div><dt className="text-xs text-muted">الأهداف</dt><dd className="whitespace-pre-wrap">{p.goals}</dd></div>
                  <div><dt className="text-xs text-muted">الخطة الأسبوعية</dt><dd className="whitespace-pre-wrap">{p.weeklyPlan || "—"}</dd></div>
                  <div><dt className="text-xs text-muted">مراجعة المحفوظ</dt><dd className="whitespace-pre-wrap">{p.memorization || "—"}</dd></div>
                </dl>
                <form action={reviewItem} className="mt-3 flex flex-wrap gap-2 items-center">
                  <input type="hidden" name="kind" value="LEARNING_PLAN" />
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="back" value="/admin/reading?tab=plans" />
                  <input name="feedback" className="input flex-1 min-w-48" placeholder="ملاحظة لصاحبها (اختيارية)" defaultValue={p.feedback ?? ""} />
                  <SubmitButton secondary className="btn-sm">{p.reviewedAt ? "تحديث المراجعة" : "اعتماد الخطة"}</SubmitButton>
                </form>
              </Card>
            ))}
          </div>
        )}
      </>
    );
  }

  const w = weeks.find((x) => x.number === week);
  const quota = w ? weekQuota(w) : null;
  // بطاقات الأسبوع المختار: من سبته إلى ما قبل سبت الأسبوع التالي في جدول الدفعة
  const weekOf = weekResolver(weeks);
  const all = await db.readingCard.findMany({ where: { userId: { in: who ? [who] : ids } }, orderBy: { date: "asc" } });
  const cards = all.filter((c) => weekOf(c.date) === week);
  const open = new Set((await db.itemReturn.findMany({ where: { kind: "READING_CARD", resolvedAt: null, recordId: { in: cards.map((c) => c.id) } }, select: { recordId: true } })).map((r) => r.recordId));
  const rank = (c: (typeof cards)[number]) => (c.reviewedAt ? 2 : 0) + (isLargeAmount(cardPages(c), quota) ? 0 : 1);
  const sorted = [...cards].sort((a, b) => rank(a) - rank(b) || a.date.getTime() - b.date.getTime());
  const pending = sorted.filter((c) => !c.reviewedAt && !open.has(c.id));
  const readBy = new Map<string, number>();
  for (const c of cards) if (!open.has(c.id)) readBy.set(c.userId, (readBy.get(c.userId) ?? 0) + cardPages(c));

  return (
    <>
      <PageHeader title="القراءة والخطط" subtitle="بطاقات القراءة بأسبوعها: صفحاتها مقابل نصاب الأسبوع في الجدول، وفوائدها وأسئلتها. ما لم يُراجَع وما مقداره كبير أولاً." />
      <FormMessage ok={sp.ok} err={sp.err} />
      {tabs}
      <WeekChips weeks={activeWeeks} selected={week} current={cur} href={(n) => `/admin/reading?week=${n}${who ? `&who=${who}` : ""}`} />
      <form action="/admin/reading" className="flex flex-wrap gap-2 items-end mb-4">
        <input type="hidden" name="week" value={week} />
        <div>
          <label className="label">المشارك</label>
          <select name="who" className="select" defaultValue={who ?? ""}>
            <option value="">الجميع</option>
            {participants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <button className="btn btn-secondary btn-sm">عرض</button>
      </form>

      <Card title={`${weekName(week)}${quota ? ` — نصابه ${quota.pages} صفحة` : ""}`} className="mb-4">
        <ul className="text-sm flex flex-wrap gap-1">
          {(who ? participants.filter((p) => p.id === who) : participants).map((p) => {
            const read = readBy.get(p.id) ?? 0;
            return <li key={p.id}><Badge tone={quota && read >= quota.pages ? "ink" : "default"}>{p.name}: {read}{quota ? ` / ${quota.pages}` : ""} صفحة</Badge></li>;
          })}
        </ul>
      </Card>

      {sorted.length === 0 ? <Empty>لا بطاقات في هذا الأسبوع.</Empty> : (
        <>
          {pending.length > 0 && (
            <form action={reviewCards} className="mb-3 flex flex-wrap items-center gap-2">
              {pending.map((c) => <input key={c.id} type="hidden" name="ids" value={c.id} />)}
              <input type="hidden" name="back" value={back} />
              <SubmitButton secondary className="btn-sm" confirm={`اعتماد ${pending.length} بطاقة لم تُراجَع في هذا الأسبوع بلا ملاحظات؟`}>اعتماد البطاقات المعروضة ({pending.length})</SubmitButton>
              <span className="text-xs text-muted">تُعتمد بلا ملاحظة؛ والمُرجَع منها لا يُعتمد حتى يعيده صاحبه.</span>
            </form>
          )}
          <div className="space-y-2">
            {sorted.map((c) => {
              const pages = cardPages(c);
              const large = isLargeAmount(pages, quota);
              return (
                <section key={c.id} className={cn("card", (large || open.has(c.id)) && "border-ink")}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link href={`/admin/participants/${c.userId}?tab=reading#${itemAnchor("READING_CARD", c.id)}`} prefetch={false} className="font-medium hover:underline">{nameOf.get(c.userId)}</Link>
                      <div className="text-xs text-muted">{formatShort(c.date)} · {c.book} · ص {c.fromPage}–{c.toPage}</div>
                      <div className="text-sm mt-0.5"><strong>{pagesText(pages)}</strong> — تعادل {daysLabel(equivalentDays(pages, quota))}{large && <Badge tone="ink" className="ms-2">مقدار كبير — تحقّق منه</Badge>}</div>
                    </div>
                    {open.has(c.id) ? <Badge tone="ink">مُرجَعة لصاحبها</Badge> : c.reviewedAt ? <Badge tone="ink">رُوجعت</Badge> : <Badge>لم تُراجَع</Badge>}
                  </div>
                  <div className="text-sm mt-2 whitespace-pre-wrap">{c.benefit}</div>
                  {c.question && <div className="text-sm text-muted mt-1">سؤال: {c.question}</div>}
                  {!open.has(c.id) && (
                    <form action={reviewItem} className="mt-2 flex flex-wrap gap-2 items-center">
                      <input type="hidden" name="kind" value="READING_CARD" />
                      <input type="hidden" name="id" value={c.id} />
                      <input type="hidden" name="back" value={back} />
                      <input name="feedback" className="input flex-1 min-w-48" placeholder="ملاحظة لصاحبها (اختيارية)" defaultValue={c.feedback ?? ""} />
                      <SubmitButton secondary className="btn-sm">{c.reviewedAt ? "تحديث" : "اعتماد"}</SubmitButton>
                      <Link href={`/admin/participants/${c.userId}?tab=reading&ret=READING_CARD:${c.id}#${itemAnchor("READING_CARD", c.id)}`} prefetch={false} className="btn btn-ghost btn-sm">إرجاع أو تعديل…</Link>
                    </form>
                  )}
                </section>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
