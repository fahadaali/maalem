import Link from "@/components/Link";
import { requireParticipantView } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Card, Empty, Badge } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import ReadingAmountHint from "@/components/ReadingAmountHint";
import { addReadingCard, deleteReadingCard, updateReadingCard } from "../actions";
import { READING_NOTE } from "@/lib/program";
import { getBookTitles, bookProgress } from "@/lib/content";
import { formatShort, todayKey } from "@/lib/dates";
import { resolveCurrentWeek, weekResolver } from "@/lib/weeks";
import { loadParticipant, loadProgram } from "@/lib/participant-data";
import { cardPages, daysLabel, equivalentDays, readingByWeek, readingTotals, weekQuota } from "@/lib/reading-quota";
import { pagesText } from "@/lib/utils";
import { daysLate, originalDue, overdueLabel, weekName } from "@/lib/obligations";
import { openReturnFor, returnedIds } from "@/lib/returns";
import { Pencil, Trash2 } from "lucide-react";

export const metadata = { title: "الورد القرائي" };

/**
 * الورد القرائي وبطاقاته. المقدار صفحاتٌ تُقاس بنصاب كل أسبوع في الجدول — لا عدد
 * بطاقات — فمن قرأ في يومه أكثر من نصابه كتب صفحاته كلها في بطاقته وحُسبت له.
 */
export default async function ReadingPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string; edit?: string }> }) {
  const user = await requireParticipantView();
  const { ok, err, edit } = await searchParams;
  const now = new Date();
  const [bookTitles, cards, progress, rows, program] = await Promise.all([
    getBookTitles(),
    db.readingCard.findMany({ where: { userId: user.id }, orderBy: { date: "desc" } }),
    bookProgress(user.id),
    loadParticipant(user.id),
    loadProgram(),
  ]);
  const weeks = program.weeks;
  const returns = rows?.returns ?? [];
  const returned = returnedIds(returns, "READING_CARD");
  const cur = resolveCurrentWeek(weeks, now);
  const week = weeks.find((w) => w.number === cur);
  const quota = week ? weekQuota(week) : null;
  const perWeek = readingByWeek(cards, weeks, returned);
  const thisWeek = perWeek.find((r) => r.week === cur);
  const totals = readingTotals(cards, weeks, now, returned, rows?.user.createdAt);
  const behind = Math.max(0, totals.requiredSoFar - totals.read);
  const weekOf = weekResolver(weeks);
  const quotaOf = new Map(weeks.map((w) => [w.number, weekQuota(w)]));
  const byNumber = new Map(weeks.map((w) => [w.number, w]));

  const editing = edit ? cards.find((c) => c.id === edit) : undefined;
  const editLocked = editing ? !!editing.reviewedAt && !returned.has(editing.id) : false;
  const last = cards[0];
  const hintWeeks = weeks
    .filter((w) => weekQuota(w))
    .sort((a, b) => a.gregorian.localeCompare(b.gregorian))
    .map((w) => ({ start: w.gregorian, daily: weekQuota(w)!.daily, label: weekName(w.number) }));

  // البطاقات مجمّعة بأسبوعها، الأحدث أولاً
  const groups = new Map<number | null, typeof cards>();
  for (const c of cards) {
    const n = weekOf(c.date);
    groups.set(n, [...(groups.get(n) ?? []), c]);
  }
  const groupKeys = [...groups.keys()].sort((a, b) => (b ?? -1) - (a ?? -1));
  const returnedCards = cards.filter((c) => returned.has(c.id));

  const form = editing && !editLocked ? editing : undefined;
  return (
    <>
      <PageHeader
        title="الورد القرائي"
        subtitle="سجّل ما قرأته في بطاقة: من صفحة إلى صفحة، وأهم فائدة. يُحسب وردك بالصفحات مقابل نصاب كل أسبوع في الجدول، فمن قرأ في يومه أكثر من نصابه كتب صفحاته كلها في بطاقته."
      />
      <FormMessage ok={ok} err={err} />

      {returnedCards.length > 0 && (
        <Card className="mb-4 border-ink" title="أُرجعت إليك للتعديل">
          <ul className="divide-y divide-line text-sm">
            {returnedCards.map((c) => {
              const r = openReturnFor(returns, "READING_CARD", c.id)!;
              const wk = byNumber.get(weekOf(c.date) ?? -99);
              const due = originalDue("READING_CARD", { date: c.date }, rows ?? { extensions: new Map() }, weeks);
              return (
                <li key={c.id} className="py-2 flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium">{c.book} · ص {c.fromPage}–{c.toPage}</div>
                    <div className="text-muted whitespace-pre-wrap">ملاحظة مدير المشروع: {r.note}</div>
                    {due && due < now && <div className="text-xs mt-0.5">{overdueLabel(daysLate(due, now))} عن موعد ورد {weekName(wk?.number)}</div>}
                  </div>
                  <Link href={`/app/reading?edit=${c.id}#form`} className="btn btn-sm shrink-0">عدّل وأعدها</Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <Card title={week ? `ورد ${weekName(week.number)}` : "ورد الأسبوع"}>
          {week && quota ? (
            <>
              <p className="text-sm">{week.reading}</p>
              <p className="text-xs text-muted mt-1">
                النصاب في الجدول {pagesText(quota.pages)} — نحو {pagesText(quota.daily)} يومياً من الأحد إلى الخميس
                {quota.parsed ? "" : " (تقديرٌ لقراءةٍ حرة بلا أرقام صفحات)"}
              </p>
              <div className="flex justify-between text-xs mt-3 mb-1">
                <span>ما قرأته هذا الأسبوع</span>
                <span className="tabular-nums">{thisWeek?.read ?? 0} / {quota.pages} صفحة</span>
              </div>
              <div className="progress"><span style={{ width: `${Math.min(100, Math.round(((thisWeek?.read ?? 0) / quota.pages) * 100))}%` }} /></div>
            </>
          ) : (
            <p className="text-sm text-muted">لا ورد مقرّراً في هذا الأسبوع.</p>
          )}
        </Card>
        <Card title="ورد البرنامج كله">
          <div className="flex justify-between text-xs mb-1">
            <span>مجموع ما قرأته</span>
            <span className="tabular-nums">{totals.read} / {totals.required} صفحة</span>
          </div>
          <div className="progress"><span style={{ width: `${Math.round(totals.ratio * 100)}%` }} /></div>
          <p className="text-xs mt-2">
            {behind > 0 ? (
              <>ينقصك <strong>{pagesText(behind)}</strong> من ورد ما مضى من الأسابيع ({totals.requiredSoFar} صفحة). يُستدرك بقراءتها وتسجيلها في بطاقاتك القادمة.</>
            ) : (
              <span className="text-muted">أنت على نصاب ما مضى من الأسابيع.</span>
            )}
          </p>
          <p className="text-xs text-muted mt-1">الدرجة من مجموع الصفحات مقابل نصاب الجدول، فالاستدراك في أسبوع لاحق يُحتسب.</p>
        </Card>
      </div>

      <div className="grid md:grid-cols-[1fr_320px] gap-4 items-start">
        <Card title={form ? "تعديل البطاقة" : "بطاقة جديدة"}>
          {editing && editLocked ? (
            <p className="text-sm text-muted">راجع مدير المشروع هذه البطاقة فأُقفلت. اطلب منه إرجاعها إن أردت تعديلها.</p>
          ) : (
            <form id="form" key={form?.id ?? "new"} action={form ? updateReadingCard : addReadingCard}>
              {form && <input type="hidden" name="id" value={form.id} />}
              <div className="grid grid-cols-2 gap-3">
                <div className="field">
                  <label className="label">التاريخ</label>
                  <input type="date" name="date" className="input" defaultValue={form ? todayKey(form.date) : todayKey()} max={todayKey()} required />
                </div>
                <div className="field">
                  <label className="label">الكتاب</label>
                  <select name="book" className="select" defaultValue={form ? (bookTitles.includes(form.book) ? form.book : "__other") : last?.book && bookTitles.includes(last.book) ? last.book : bookTitles[0]}>
                    {bookTitles.map((b) => <option key={b} value={b}>{b}</option>)}
                    <option value="__other">كتاب آخر…</option>
                  </select>
                </div>
              </div>
              <div className="field">
                <label className="label">اسم الكتاب (إن اخترت «كتاب آخر»)</label>
                <input name="bookOther" className="input" placeholder="مثال: مرجع مشروع التخرج" defaultValue={form && !bookTitles.includes(form.book) ? form.book : ""} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="field">
                  <label className="label">من صفحة</label>
                  <input type="number" name="fromPage" className="input" min={1} defaultValue={form ? form.fromPage : last ? last.toPage + 1 : 1} required inputMode="numeric" />
                </div>
                <div className="field">
                  <label className="label">إلى صفحة</label>
                  <input type="number" name="toPage" className="input" min={1} defaultValue={form ? form.toPage : last ? last.toPage + Math.round(quota?.daily ?? 10) : Math.round(quota?.daily ?? 10)} required inputMode="numeric" />
                </div>
              </div>
              <ReadingAmountHint weeks={hintWeeks} />
              <div className="field">
                <label className="label">أهم فائدة</label>
                <textarea name="benefit" className="textarea" required placeholder="أبرز ما استفدته من قراءتك" defaultValue={form?.benefit ?? ""} />
              </div>
              <div className="field">
                <label className="label">سؤال أطرحه في الحلقة (اختياري)</label>
                <input name="question" className="input" defaultValue={form?.question ?? ""} />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <SubmitButton>{form ? (returned.has(form.id) ? "أعد البطاقة إلى مدير المشروع" : "حفظ التعديل") : "حفظ البطاقة"}</SubmitButton>
                {form && <Link href="/app/reading" className="btn btn-ghost">إلغاء</Link>}
              </div>
            </form>
          )}
        </Card>
        <div className="space-y-4">
          <Card title="تقدّمي في الكتب">
            <p className="text-xs text-muted mb-3">النسبة من أبعد صفحة سجّلتها في كل كتاب.</p>
            <div className="space-y-3">
              {progress.filter((b) => b.pages > 0).map((b) => (
                <div key={b.title}>
                  <div className="flex justify-between text-xs mb-1 gap-2">
                    <span className="truncate">{b.title}</span>
                    <span className="text-muted tabular-nums shrink-0">{b.furthestPage} / {b.pages}</span>
                  </div>
                  <div className="progress"><span style={{ width: `${b.percent}%` }} /></div>
                </div>
              ))}
              {progress.filter((b) => b.pages > 0).length === 0 && <p className="text-sm text-muted">لا كتب مسجّلة بصفحاتها.</p>}
            </div>
          </Card>
          <div className="card card-muted text-xs text-muted">{READING_NOTE}</div>
        </div>
      </div>

      <h2 className="text-xl mt-8 mb-3">بطاقاتي</h2>
      {cards.length === 0 ? (
        <Empty>لا توجد بطاقات بعد. ابدأ بتسجيل قراءة اليوم.</Empty>
      ) : (
        <div className="space-y-6">
          {groupKeys.map((n) => {
            const list = groups.get(n)!;
            const q = n != null ? quotaOf.get(n) ?? null : null;
            const read = list.filter((c) => !returned.has(c.id)).reduce((s, c) => s + cardPages(c), 0);
            return (
              <section key={n ?? "none"}>
                <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
                  <h3 className="text-base">{n == null ? "قبل البرنامج" : weekName(n)}</h3>
                  <span className="text-xs text-muted tabular-nums">{q ? `${read} من ${q.pages} صفحة` : `${read} صفحة`}</span>
                </div>
                <div className="space-y-2">
                  {list.map((c) => {
                    const pages = cardPages(c);
                    const isReturned = returned.has(c.id);
                    const editable = !c.reviewedAt || isReturned;
                    return (
                      <div key={c.id} id={`card-${c.id}`} className={`card flex gap-3 items-start ${isReturned ? "border-ink" : ""}`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-xs text-muted">{formatShort(c.date)} · {c.book} · ص {c.fromPage}–{c.toPage}</div>
                            {isReturned ? <Badge>أُرجعت إليك</Badge> : c.reviewedAt ? <Badge tone="ink">تمت المراجعة</Badge> : <Badge tone="soft">بانتظار المراجعة</Badge>}
                          </div>
                          <div className="text-xs mt-0.5">{pagesText(pages)} · تعادل {daysLabel(equivalentDays(pages, q))} من ورد أسبوعها</div>
                          <div className="text-sm mt-1 whitespace-pre-wrap">{c.benefit}</div>
                          {c.question && <div className="text-sm text-muted mt-1">سؤال: {c.question}</div>}
                          {c.feedback && <div className="text-sm mt-2 border-s-2 border-ink ps-2">ملاحظة مدير المشروع: {c.feedback}</div>}
                        </div>
                        {editable && (
                          <div className="flex flex-col gap-1 shrink-0">
                            <Link href={`/app/reading?edit=${c.id}#form`} className="btn btn-ghost btn-sm" aria-label="تعديل" title="تعديل"><Pencil size={14} /></Link>
                            <form action={deleteReadingCard}>
                              <input type="hidden" name="id" value={c.id} />
                              <SubmitButton ghost className="btn-sm" label="حذف" pendingText="…" confirm={`حذف بطاقة «${c.book}» ص ${c.fromPage}–${c.toPage}؟`}><Trash2 size={14} /></SubmitButton>
                            </form>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
