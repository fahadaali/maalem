import Link from "@/components/Link";
import { db } from "@/lib/db";
import { Card, Badge, Empty, Progress } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import Attachments from "@/components/Attachments";
import ReportTasks from "@/components/ReportTasks";
import MentorEvalForm from "@/components/MentorEvalForm";
import CompetencyCard from "@/components/CompetencyCard";
import Timeline from "@/components/Timeline";
import ObligationList from "@/components/ObligationList";
import { addFeedbackSession, approveFieldLog, gradeSubmission, resetQuizAttempt, reviewReport, updateProjectAdmin, updateUser } from "../../actions";
import { reviewItem } from "../actions";
import { ItemActions, ItemPanel, MenuAction, ReturnedNote, itemLinks, type Panel } from "./parts";
import { REPORT_ROWS } from "@/lib/report";
import { RUBRIC_LEVEL_LABELS, TASK_RUBRIC } from "@/lib/program";
import { ATTENDANCE_LABELS, PROJECT_STATUS_LABELS, daysLabel } from "@/lib/utils";
import { EXCUSE_KINDS, EXCUSE_STATUS } from "@/lib/excuses";
import { formatDateTime, formatShort, reportDueFrom, todayKey } from "@/lib/dates";
import { toItem, withFiles } from "@/lib/attachments";
import { buildTimeline } from "@/lib/timeline";
import { computeCompetencies, overallAttainment } from "@/lib/competencies";
import { getCompetencies, getContinuous, getProjectRubric } from "@/lib/content";
import { weekResolver } from "@/lib/weeks";
import { dueFor, type ParticipantRows, type ProgramData } from "@/lib/participant-data";
import { cardPages, equivalentDays, isLargeAmount, readingByWeek, readingTotals, weekQuota } from "@/lib/reading-quota";
import { daysLate, overdueLabel, weekName, type Obligation, type ObligationsResult } from "@/lib/obligations";
import { itemAnchor, type FileTab } from "@/lib/items";
import { openReturnFor, returnedIds } from "@/lib/returns";
import type { GradeBreakdown } from "@/lib/grades";

/**
 * تبويبات ملف المشارك عند المدير. يجلب كلُّ تبويبٍ ما يعرضه وحده — فالملف كاملاً
 * في طلبٍ واحد يتجاوز سقف الطلبات الفرعية في العامل — وصفوف المشارك الأساسية من
 * المُحمِّل المشترك تقرؤها الترويسة والتبويب معاً.
 */

export type Ctx = {
  userId: string;
  name: string;
  panel: Panel;
  now: Date;
  rows: ParticipantRows;
  program: ProgramData;
  obligations: ObligationsResult | null;
};

const scroll = "scroll-mt-24";

/** رابط بندٍ من «مهامي» إلى موضعه في الملف */
function fileLink(userId: string, o: Obligation): string {
  const base = `/admin/participants/${userId}`;
  if (o.returned) {
    const tab: FileTab = o.returned.kind === "SUBMISSION" || o.returned.kind === "WEEKLY_REPORT" ? "work" : o.returned.kind === "READING_CARD" || o.returned.kind === "LEARNING_PLAN" ? "reading" : "field";
    return `${base}?tab=${tab}#${itemAnchor(o.returned.kind, o.returned.recordId)}`;
  }
  switch (o.kind) {
    case "ASSIGNMENT":
      return `${base}?tab=work#${itemAnchor("ASSIGNMENT", o.key.split(":")[1])}`;
    case "REPORT":
      return `${base}?tab=work#${itemAnchor("REPORT_WEEK", String(o.week))}`;
    case "READING":
    case "PLAN":
      return `${base}?tab=reading`;
    case "QUIZ":
    case "DIAGNOSTIC":
      return `${base}?tab=quizzes`;
    case "TADABBUR":
      return `${base}?tab=journal`;
    case "CHARTER":
    case "SURVEY":
    case "PORTFOLIO":
      return `${base}?tab=log`;
    default:
      return `${base}?tab=field`;
  }
}

// ——— نظرة عامة ———

export async function OverviewTab({ ctx, grades }: { ctx: Ctx; grades: GradeBreakdown }) {
  const { userId, rows, now, obligations } = ctx;
  const [continuous, comps] = await Promise.all([getContinuous(), computeCompetencies(userId)]);
  const parts: Record<string, number> = { attendance: grades.attendance, reading: grades.reading, quizzes: grades.quizzes, tasks: grades.tasks, field: grades.field, leadership: grades.leadership };
  const items = obligations?.items ?? [];
  const pressing = items.filter((o) => o.state === "returned" || o.state === "overdue" || o.state === "due");
  const returnedSubs = returnedIds(rows.returns, "SUBMISSION");
  const review = [
    { n: rows.submissions.filter((s) => !s.gradedAt && !returnedSubs.has(s.id)).length, label: "تسليمات بانتظار التقييم", tab: "work" },
    { n: rows.reports.filter((r) => !r.reviewedAt).length, label: "تقارير بانتظار المراجعة", tab: "work" },
    { n: rows.cards.filter((c) => !c.reviewedAt).length, label: "بطاقات قراءة لم تُراجَع", tab: "reading" },
    { n: rows.plan && !rows.plan.reviewedAt ? 1 : 0, label: "خطة التعلم لم تُراجَع", tab: "reading" },
    { n: rows.fieldLogs.filter((f) => !f.approvedAt).length, label: "سجلات معايشة بانتظار الاعتماد", tab: "field" },
  ].filter((r) => r.n > 0);

  return (
    <div className="space-y-4">
      {obligations?.otherCohort && <div className="card card-muted text-sm">هذا المشارك في دفعةٍ غير الدفعة النشطة، فلا تُحسب عليه مواعيد جدولها.</div>}
      <Card title="ما عليه الآن" action={<Badge tone={pressing.length ? "ink" : "soft"}>{obligations?.counts.overdue ?? 0} متأخر · {obligations?.counts.returned ?? 0} مُرجَع</Badge>}>
        {pressing.length === 0 ? <p className="text-sm text-muted">لا شيء متأخر عليه ولا مطلوب هذا الأسبوع.</p> : <ObligationList items={pressing} now={now} readOnly hrefFor={(o) => fileLink(userId, o)} />}
      </Card>
      <div className="grid md:grid-cols-2 gap-4">
        <Card title="بانتظار مراجعتك">
          {review.length === 0 ? (
            <p className="text-sm text-muted">لا شيء ينتظر مراجعتك من إدخالاته.</p>
          ) : (
            <ul className="text-sm divide-y divide-line">
              {review.map((r) => (
                <li key={r.label} className="py-1.5 flex justify-between gap-2">
                  <Link href={`/admin/participants/${userId}?tab=${r.tab}`} prefetch={false} className="hover:underline">{r.label}</Link>
                  <Badge>{r.n}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title={`التقييم المستمر (${grades.maxes.continuous})`}>
          <div className="space-y-2">
            {continuous.map((c) => <Progress key={c.key} label={`${c.label} (${c.points})`} value={parts[c.key] ?? 0} max={c.points} />)}
          </div>
          <div className="text-xs text-muted mt-3">
            مشروع التخرج: {grades.project}/{grades.maxes.project} · {grades.stats.projectStatus ? PROJECT_STATUS_LABELS[grades.stats.projectStatus] : "لم يُحدد"} · الورد {grades.stats.readingPages} من {grades.stats.readingRequired} صفحة
          </div>
        </Card>
      </div>
      <CompetencyCard rows={comps} overall={overallAttainment(comps)} compact />
    </div>
  );
}

// ——— المهام والتقارير ———

function GradeForm({ s, back }: { s: { id: string; completeness: number | null; referencing: number | null; application: number | null; punctuality: number | null; feedback: string | null; gradedAt: Date | null }; back: string }) {
  const values: Record<string, number | null> = { completeness: s.completeness, referencing: s.referencing, application: s.application, punctuality: s.punctuality };
  return (
    <form action={gradeSubmission} className="mt-2">
      <input type="hidden" name="id" value={s.id} />
      <input type="hidden" name="back" value={back} />
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>المعيار</th>{RUBRIC_LEVEL_LABELS.map((l) => <th key={l} className="text-center">{l}</th>)}</tr></thead>
          <tbody>
            {TASK_RUBRIC.map((r) => (
              <tr key={r.key}>
                <td className="font-medium whitespace-nowrap">{r.criterion}</td>
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

export async function WorkTab({ ctx }: { ctx: Ctx }) {
  const { userId, rows, program, panel, now } = ctx;
  const [subs, files, reports] = await Promise.all([
    db.submission.findMany({ where: { userId } }),
    db.attachment.findMany({ where: { kind: "SUBMISSION", userId }, orderBy: { createdAt: "asc" } }),
    db.weeklyReport.findMany({ where: { userId }, include: { tasks: { orderBy: { order: "asc" } } } }),
  ]);
  const subOf = new Map(subs.map((s) => [s.assignmentId, s]));
  const reportOf = new Map(reports.map((r) => [r.week, r]));
  const weeks = program.weeks.filter((w) => w.number >= 0 && w.number <= 12);

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-xl mb-3">المهام المقيَّمة ({subs.length} من {program.assignments.length} مسلَّمة)</h2>
        {program.assignments.length === 0 ? <Empty>لا مهام منشورة في الدفعة. أنشئها من «المهام والتقييم».</Empty> : (
          <div className="space-y-3">
            {program.assignments.map((a) => {
              const s = subOf.get(a.id);
              const due = dueFor(a, rows.extensions);
              const returned = s ? openReturnFor(rows.returns, "SUBMISSION", s.id) : undefined;
              const total = s?.gradedAt ? (s.completeness ?? 0) + (s.referencing ?? 0) + (s.application ?? 0) + (s.punctuality ?? 0) : null;
              const l = itemLinks(userId, "work", "SUBMISSION", s?.id ?? a.id);
              const mine = files.filter((f) => f.refId === a.id).map(toItem);
              return (
                <section key={a.id} id={s ? l.anchor : itemAnchor("ASSIGNMENT", a.id)} className={`card ${scroll} ${returned ? "border-ink" : ""}`}>
                  {s && <span id={itemAnchor("ASSIGNMENT", a.id)} className={scroll} />}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs text-muted">{weekName(a.week)} · موعده {formatDateTime(due)}{due.getTime() !== a.dueAt.getTime() ? " (مُدَّد له)" : ""}</div>
                      <Link href={`/admin/tasks/${a.id}`} prefetch={false} className="font-medium hover:underline">{a.title}</Link>
                    </div>
                    <div className="flex items-start gap-1 shrink-0">
                      {returned ? <Badge tone="ink">مُرجَع لصاحبه</Badge> : total != null ? <Badge tone="ink">{total}/16</Badge> : s ? <Badge>بانتظار التقييم</Badge> : due < now ? <Badge tone="ink">لم يُسلَّم — {overdueLabel(daysLate(due, now))}</Badge> : <Badge tone="soft">لم يُسلَّم بعد</Badge>}
                      {s && <ItemActions userId={userId} tab="work" kind="SUBMISSION" activity="SUBMISSION" id={s.id} label={`تسليم «${a.title}»`} returned={returned} />}
                    </div>
                  </div>
                  {returned && <ReturnedNote r={returned} due={due} now={now} />}
                  {s && (
                    <>
                      <div className="text-xs text-muted mt-2">سُلّم {formatDateTime(s.submittedAt)}{s.submittedAt > due ? " — بعد موعده" : ""}</div>
                      <div className="text-sm whitespace-pre-wrap mt-1">{s.content}</div>
                      {s.link && <a href={s.link} target="_blank" rel="noopener" className="text-sm underline break-all" dir="ltr">{s.link}</a>}
                      {mine.length > 0 && <div className="mt-2"><Attachments kind="SUBMISSION" refId={a.id} initial={mine} readOnly /></div>}
                      {s.feedback && <div className="text-sm mt-2 border-s-2 border-line ps-2"><span className="text-muted">التغذية الراجعة: </span>{s.feedback}</div>}
                      <details className="mt-2">
                        <summary className="cursor-pointer text-sm text-muted">{s.gradedAt ? "تعديل التقييم بالسلّم" : "التقييم بسلّم التقدير (ملحق 2)"}</summary>
                        <GradeForm s={s} back={l.back} />
                      </details>
                      <ItemPanel panel={panel} userId={userId} tab="work" kind="SUBMISSION" id={s.id} values={s} label={`تسليم «${a.title}»`} />
                    </>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xl mb-3">التقارير الأسبوعية ({reports.length} من {weeks.length})</h2>
        <div className="space-y-3">
          {weeks.map((w) => {
            const r = reportOf.get(w.number);
            const due = reportDueFrom(w.gregorian);
            const returned = r ? openReturnFor(rows.returns, "WEEKLY_REPORT", r.id) : undefined;
            const l = itemLinks(userId, "work", "WEEKLY_REPORT", r?.id ?? String(w.number));
            const future = due > now && !r;
            return (
              <section key={w.number} id={r ? l.anchor : itemAnchor("REPORT_WEEK", String(w.number))} className={`card ${scroll} ${returned ? "border-ink" : ""}`}>
                {r && <span id={itemAnchor("REPORT_WEEK", String(w.number))} className={scroll} />}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">تقرير {weekName(w.number)}</div>
                    <div className="text-xs text-muted">موعده {formatDateTime(due)}{r ? ` · سُلّم ${formatDateTime(r.submittedAt)}${r.submittedAt > due ? " — بعد موعده" : ""}` : ""}</div>
                  </div>
                  <div className="flex items-start gap-1 shrink-0">
                    {returned ? <Badge tone="ink">مُرجَع لصاحبه</Badge> : r ? (r.reviewedAt ? <Badge tone="ink">تمت المراجعة</Badge> : <Badge>بانتظار المراجعة</Badge>) : future ? <Badge tone="soft">لم يحن</Badge> : <Badge tone="ink">لم يُسلَّم — {overdueLabel(daysLate(due, now))}</Badge>}
                    {r && <ItemActions userId={userId} tab="work" kind="WEEKLY_REPORT" activity="WEEKLY_REPORT" id={r.id} label={`تقرير ${weekName(w.number)}`} returned={returned} />}
                  </div>
                </div>
                {returned && <ReturnedNote r={returned} due={due} now={now} />}
                {r && (
                  <>
                    <div className="mt-3"><ReportTasks report={r} /></div>
                    <dl className="grid md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                      {REPORT_ROWS.map(([label, key]) => (r[key] ? <div key={key}><dt className="text-xs text-muted">{label}</dt><dd className="whitespace-pre-wrap">{r[key]}</dd></div> : null))}
                    </dl>
                    <details className="mt-3" open={!r.reviewedAt && !returned}>
                      <summary className="cursor-pointer text-sm text-muted">{r.reviewedAt ? "تعديل المراجعة" : "المراجعة والتغذية الراجعة"}</summary>
                      <form action={reviewReport} className="mt-2">
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="back" value={l.back} />
                        <div className="field"><label className="label">تغذية راجعة للمشارك</label><textarea name="feedback" className="textarea" rows={2} defaultValue={r.feedback ?? ""} /></div>
                        <SubmitButton secondary className="btn-sm">{r.reviewedAt ? "تحديث المراجعة" : "اعتماد المراجعة"}</SubmitButton>
                      </form>
                    </details>
                    <ItemPanel panel={panel} userId={userId} tab="work" kind="WEEKLY_REPORT" id={r.id} values={r} label={`تقرير ${weekName(w.number)}`} />
                  </>
                )}
              </section>
            );
          })}
        </div>
      </section>
    </div>
  );
}

// ——— القراءة والخطة ———

export async function ReadingTab({ ctx }: { ctx: Ctx }) {
  const { userId, rows, program, panel, now } = ctx;
  const [cards, plan] = await Promise.all([
    db.readingCard.findMany({ where: { userId }, orderBy: { date: "desc" } }),
    db.learningPlan.findUnique({ where: { userId } }),
  ]);
  const returned = returnedIds(rows.returns, "READING_CARD");
  const totals = readingTotals(cards, program.weeks, now, returned);
  const perWeek = readingByWeek(cards, program.weeks, returned);
  const weekOf = weekResolver(program.weeks);
  const quotaOf = new Map(program.weeks.map((w) => [w.number, weekQuota(w)]));
  const groups = new Map<number | null, typeof cards>();
  for (const c of cards) {
    const n = weekOf(c.date);
    groups.set(n, [...(groups.get(n) ?? []), c]);
  }
  const keys = [...groups.keys()].sort((a, b) => (b ?? -1) - (a ?? -1));
  const planReturn = plan ? openReturnFor(rows.returns, "LEARNING_PLAN", plan.id) : undefined;
  const planLinks = itemLinks(userId, "reading", "LEARNING_PLAN", plan?.id ?? "none");

  return (
    <div className="space-y-6">
      <Card title="الورد القرائي بالصفحات" action={<Badge tone="ink">{totals.read} / {totals.required} صفحة</Badge>}>
        <p className="text-xs text-muted mb-2">
          يُحسب الورد بصفحات البطاقات مقابل نصاب كل أسبوع في الجدول، تراكمياً. المطلوب حتى نهاية آخر أسبوع مضى: {totals.requiredSoFar} صفحة
          {totals.requiredSoFar > totals.read ? ` — ينقصه ${totals.requiredSoFar - totals.read}` : ""}.
        </p>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>الأسبوع</th><th>النصاب</th><th>قرأ</th><th>البطاقات</th></tr></thead>
            <tbody>
              {perWeek.map((r) => (
                <tr key={r.week}>
                  <td>{weekName(r.week)}</td>
                  <td className="tabular-nums">{r.quota.pages}{r.quota.parsed ? "" : " (تقدير)"}</td>
                  <td className="tabular-nums">{r.read}{r.read >= r.quota.pages ? " ✓" : ""}</td>
                  <td className="tabular-nums">{r.cards}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <section>
        <h2 className="text-xl mb-3">بطاقات القراءة ({cards.length})</h2>
        {cards.length === 0 ? <Empty>لم يسجّل بطاقة بعد.</Empty> : (
          <div className="space-y-5">
            {keys.map((n) => {
              const list = groups.get(n)!;
              const q = n != null ? quotaOf.get(n) ?? null : null;
              return (
                <div key={n ?? "none"}>
                  <h3 className="text-base mb-2">{n == null ? "قبل البرنامج" : weekName(n)}{q ? ` — نصابه ${q.pages} صفحة` : ""}</h3>
                  <div className="space-y-2">
                    {list.map((c) => {
                      const pages = cardPages(c);
                      const r = openReturnFor(rows.returns, "READING_CARD", c.id);
                      const l = itemLinks(userId, "reading", "READING_CARD", c.id);
                      return (
                        <section key={c.id} id={l.anchor} className={`card ${scroll} ${r ? "border-ink" : ""}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-xs text-muted">{formatShort(c.date)} · {c.book} · ص {c.fromPage}–{c.toPage}</div>
                              <div className="text-sm mt-0.5">
                                <strong>{pages} صفحة</strong> — تعادل {daysLabel(equivalentDays(pages, q))} من ورد أسبوعها
                                {isLargeAmount(pages, q) && <Badge tone="ink" className="ms-2">مقدار كبير — تحقّق منه</Badge>}
                              </div>
                            </div>
                            <div className="flex items-start gap-1 shrink-0">
                              {r ? <Badge tone="ink">مُرجَعة</Badge> : c.reviewedAt ? <Badge tone="ink">رُوجعت</Badge> : <Badge>لم تُراجَع</Badge>}
                              <ItemActions userId={userId} tab="reading" kind="READING_CARD" activity="READING_CARD" id={c.id} label={`بطاقة «${c.book}» ص ${c.fromPage}–${c.toPage}`} returned={r} reviewable />
                            </div>
                          </div>
                          <div className="text-sm mt-2 whitespace-pre-wrap">{c.benefit}</div>
                          {c.question && <div className="text-sm text-muted mt-1">سؤال: {c.question}</div>}
                          {c.feedback && <div className="text-sm mt-2 border-s-2 border-line ps-2"><span className="text-muted">ملاحظتك: </span>{c.feedback}</div>}
                          {r && <ReturnedNote r={r} now={now} />}
                          {!c.reviewedAt && !r && (
                            <form action={reviewItem} className="mt-2 flex flex-wrap gap-2 items-center">
                              <input type="hidden" name="kind" value="READING_CARD" />
                              <input type="hidden" name="id" value={c.id} />
                              <input type="hidden" name="back" value={l.back} />
                              <input name="feedback" className="input flex-1 min-w-48" placeholder="ملاحظة لصاحبها (اختيارية)" />
                              <SubmitButton secondary className="btn-sm">اعتماد</SubmitButton>
                            </form>
                          )}
                          <ItemPanel panel={panel} userId={userId} tab="reading" kind="READING_CARD" id={c.id} values={c} feedback={c.feedback} label="البطاقة" />
                        </section>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section id={planLinks.anchor} className={scroll}>
        <h2 className="text-xl mb-3">خطة التعلم الشخصية وخطة مراجعة المحفوظ</h2>
        {!plan ? <Empty>لم يكتب خطته بعد.</Empty> : (
          <Card
            className={planReturn ? "border-ink" : undefined}
            title={<span className="text-sm text-muted font-normal">آخر تحديث {formatDateTime(plan.updatedAt)}</span>}
            action={
              <div className="flex items-start gap-1">
                {planReturn ? <Badge tone="ink">مُرجَعة</Badge> : plan.reviewedAt ? <Badge tone="ink">رُوجعت</Badge> : <Badge>لم تُراجَع</Badge>}
                <ItemActions userId={userId} tab="reading" kind="LEARNING_PLAN" activity="LEARNING_PLAN" id={plan.id} label="خطة التعلم" returned={planReturn} reviewable />
              </div>
            }
          >
            <dl className="space-y-3 text-sm">
              <div><dt className="text-xs text-muted">أهداف الخطة الفصلية</dt><dd className="whitespace-pre-wrap">{plan.goals}</dd></div>
              <div><dt className="text-xs text-muted">الخطة الأسبوعية</dt><dd className="whitespace-pre-wrap">{plan.weeklyPlan || "—"}</dd></div>
              <div><dt className="text-xs text-muted">خطة مراجعة المحفوظ</dt><dd className="whitespace-pre-wrap">{plan.memorization || "—"}</dd></div>
            </dl>
            {plan.feedback && <div className="text-sm mt-3 border-s-2 border-line ps-2"><span className="text-muted">ملاحظتك: </span>{plan.feedback}</div>}
            {planReturn && <ReturnedNote r={planReturn} now={now} />}
            {!plan.reviewedAt && !planReturn && (
              <form action={reviewItem} className="mt-3 flex flex-wrap gap-2 items-center">
                <input type="hidden" name="kind" value="LEARNING_PLAN" />
                <input type="hidden" name="id" value={plan.id} />
                <input type="hidden" name="back" value={planLinks.back} />
                <input name="feedback" className="input flex-1 min-w-48" placeholder="ملاحظة لصاحبها (اختيارية)" />
                <SubmitButton secondary className="btn-sm">اعتماد الخطة</SubmitButton>
              </form>
            )}
            <ItemPanel panel={panel} userId={userId} tab="reading" kind="LEARNING_PLAN" id={plan.id} values={plan} feedback={plan.feedback} label="خطة التعلم" />
          </Card>
        )}
      </section>
    </div>
  );
}

// ——— الميدان والقيادة والمشروع ———

export async function FieldTab({ ctx }: { ctx: Ctx }) {
  const { userId, name, rows, panel, now } = ctx;
  const [logs, evals, activities, given, project, projectFiles, rubric] = await Promise.all([
    db.fieldLog.findMany({ where: { userId }, orderBy: { date: "desc" } }),
    db.mentorEvaluation.findMany({ where: { userId }, orderBy: { period: "asc" } }),
    db.leadershipActivity.findMany({ where: { userId }, orderBy: { date: "desc" }, include: { evaluations: { include: { evaluator: { select: { name: true } } } } } }),
    db.peerEvaluation.findMany({ where: { evaluatorId: userId }, include: { activity: { select: { title: true, user: { select: { name: true } } } } } }),
    db.graduationProject.findUnique({ where: { userId } }),
    db.attachment.findMany({ where: { kind: "PROJECT", userId }, orderBy: { createdAt: "asc" } }),
    getProjectRubric(),
  ]);
  const withLogFiles = await withFiles(logs);
  const hours = logs.reduce((s, l) => s + (l.approvedAt ? l.hours : 0), 0);
  const projectReturn = project ? openReturnFor(rows.returns, "PROJECT", project.id) : undefined;
  const avg = (e: { c1: number; c2: number; c3: number; c4: number; c5: number }[]) => (e.length ? (e.reduce((s, x) => s + (x.c1 + x.c2 + x.c3 + x.c4 + x.c5) / 5, 0) / e.length).toFixed(1) : "—");
  const projectBack = project ? itemLinks(userId, "field", "PROJECT", project.id).back : "";

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-xl mb-3">المعايشة الميدانية ({hours} ساعة معتمدة)</h2>
        {withLogFiles.length === 0 ? <Empty>لا سجلات معايشة.</Empty> : (
          <div className="space-y-2">
            {withLogFiles.map((f) => {
              const r = openReturnFor(rows.returns, "FIELD_LOG", f.id);
              const l = itemLinks(userId, "field", "FIELD_LOG", f.id);
              return (
                <section key={f.id} id={l.anchor} className={`card ${scroll} ${r ? "border-ink" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-xs text-muted">{formatShort(f.date)} · {f.hours} ساعة · مع {f.mentorName}</div>
                    <div className="flex items-start gap-1 shrink-0">
                      {r ? <Badge tone="ink">مُرجَع</Badge> : f.approvedAt ? <Badge tone="ink">معتمد</Badge> : <Badge>بانتظار الاعتماد</Badge>}
                      <ItemActions
                        userId={userId} tab="field" kind="FIELD_LOG" activity="FIELD_LOG" id={f.id} label={`سجل المعايشة ${formatShort(f.date)}`} returned={r}
                        extra={!f.approvedAt ? <MenuAction action={approveFieldLog} fields={{ id: f.id, back: l.back }}>اعتماد</MenuAction> : undefined}
                      />
                    </div>
                  </div>
                  <div className="text-sm mt-1 whitespace-pre-wrap">{f.note}</div>
                  {f.files.length > 0 && <div className="mt-2"><Attachments kind="FIELD" refId={f.id} initial={f.files} readOnly /></div>}
                  {r && <ReturnedNote r={r} now={now} />}
                  <ItemPanel panel={panel} userId={userId} tab="field" kind="FIELD_LOG" id={f.id} values={f} label="سجل المعايشة" />
                </section>
              );
            })}
          </div>
        )}
      </section>

      <MentorEvalForm userId={userId} name={name} existing={evals} />

      <section>
        <h2 className="text-xl mb-3">الدور القيادي</h2>
        {activities.length === 0 ? <Empty>لم يسجّل نشاطاً قيادياً.</Empty> : (
          <div className="space-y-2">
            {activities.map((a) => {
              const r = openReturnFor(rows.returns, "LEADERSHIP", a.id);
              const l = itemLinks(userId, "field", "LEADERSHIP", a.id);
              return (
                <section key={a.id} id={l.anchor} className={`card ${scroll} ${r ? "border-ink" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium">{a.title}</div>
                      <div className="text-xs text-muted">{formatShort(a.date)} · {a.evaluations.length} تقييم أقران · متوسط {avg(a.evaluations)} / 5</div>
                    </div>
                    <div className="flex items-start gap-1 shrink-0">
                      {r && <Badge tone="ink">مُرجَع</Badge>}
                      <ItemActions userId={userId} tab="field" kind="LEADERSHIP" activity="LEADERSHIP" id={a.id} label={`النشاط «${a.title}»`} returned={r} />
                    </div>
                  </div>
                  <div className="text-sm mt-2 whitespace-pre-wrap">{a.report || <span className="text-muted">لم يكتب تقرير النشاط بعد.</span>}</div>
                  {a.evaluations.some((e) => e.comment) && (
                    <ul className="text-sm text-muted mt-2 space-y-1">
                      {a.evaluations.filter((e) => e.comment).map((e) => <li key={e.id}>{e.evaluator.name}: «{e.comment}»</li>)}
                    </ul>
                  )}
                  {r && <ReturnedNote r={r} now={now} />}
                  <ItemPanel panel={panel} userId={userId} tab="field" kind="LEADERSHIP" id={a.id} values={a} label="النشاط القيادي" />
                </section>
              );
            })}
          </div>
        )}
        {given.length > 0 && (
          <details className="card mt-3">
            <summary className="cursor-pointer text-sm">تقييماته لأنشطة زملائه ({given.length})</summary>
            <ul className="text-sm mt-2 divide-y divide-line">
              {given.map((g) => <li key={g.id} className="py-1.5">{g.activity.user.name} — {g.activity.title}: {((g.c1 + g.c2 + g.c3 + g.c4 + g.c5) / 5).toFixed(1)} / 5{g.comment ? ` · «${g.comment}»` : ""}</li>)}
            </ul>
          </details>
        )}
      </section>

      <section id={project ? itemAnchor("PROJECT", project.id) : undefined} className={scroll}>
        <h2 className="text-xl mb-3">مشروع التخرج</h2>
        {!project ? <Empty>لم يقترح موضوع مشروعه بعد.</Empty> : (
          <Card
            className={projectReturn ? "border-ink" : undefined}
            title={project.topic}
            action={
              <div className="flex items-start gap-1">
                <Badge tone="ink">{PROJECT_STATUS_LABELS[project.status]}</Badge>
                <ItemActions userId={userId} tab="field" kind="PROJECT" activity="PROJECT" id={project.id} label={`المشروع «${project.topic}»`} returned={projectReturn} returnable={project.status !== "JUDGED"} />
              </div>
            }
          >
            {project.problem && <p className="text-sm whitespace-pre-wrap">{project.problem}</p>}
            <div className="text-sm mt-2 space-y-1" dir="auto">
              {project.draftLink && <div>المسودة: <a href={project.draftLink} target="_blank" rel="noopener" className="underline break-all" dir="ltr">{project.draftLink}</a></div>}
              {project.finalLink && <div>النهائية: <a href={project.finalLink} target="_blank" rel="noopener" className="underline break-all" dir="ltr">{project.finalLink}</a></div>}
            </div>
            {projectFiles.length > 0 && <div className="mt-2"><Attachments kind="PROJECT" initial={projectFiles.map(toItem)} readOnly /></div>}
            {project.status === "JUDGED" && (
              <div className="text-sm mt-2">التحكيم: {rubric.reduce((s, r) => s + ((project as unknown as Record<string, number | null>)[r.key] ?? 0), 0)} / {rubric.reduce((s, r) => s + r.points, 0)}{project.judgeNote ? ` — ${project.judgeNote}` : ""}</div>
            )}
            {projectReturn && <ReturnedNote r={projectReturn} now={now} />}
            <details className="mt-3">
              <summary className="cursor-pointer text-sm text-muted">الحالة والمرشد وملاحظة المدير</summary>
              <form action={updateProjectAdmin} className="mt-2">
                <input type="hidden" name="id" value={project.id} />
                <input type="hidden" name="back" value={projectBack} />
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="field">
                    <label className="label">الحالة</label>
                    <select name="status" className="select" defaultValue={project.status}>
                      {Object.entries(PROJECT_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div className="field"><label className="label">المرشد</label><input name="mentorName" className="input" defaultValue={project.mentorName ?? ""} /></div>
                </div>
                <div className="field"><label className="label">ملاحظة لصاحبه</label><textarea name="adminNote" className="textarea" rows={2} defaultValue={project.adminNote ?? ""} /></div>
                <SubmitButton secondary className="btn-sm">حفظ</SubmitButton>
                <Link href="/admin/projects" prefetch={false} className="text-sm underline ms-3">التحكيم في صفحة المشاريع</Link>
              </form>
            </details>
            <ItemPanel panel={panel} userId={userId} tab="field" kind="PROJECT" id={project.id} values={project} label="المشروع" />
          </Card>
        )}
      </section>
    </div>
  );
}

// ——— الاختبارات والحضور ———

export async function QuizzesTab({ ctx }: { ctx: Ctx }) {
  const { userId, program } = ctx;
  const [attempts, attendance, excuses, diagnostics, comps] = await Promise.all([
    db.quizAttempt.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    db.attendance.findMany({ where: { userId }, orderBy: [{ week: "asc" }, { type: "asc" }] }),
    db.excuseRequest.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
    db.diagnostic.findMany({ where: { userId } }),
    getCompetencies(),
  ]);
  const attemptOf = new Map(attempts.map((a) => [a.quizId, a]));
  const quizzes = program.quizzes.filter((q) => q.published);
  const back = `/admin/participants/${userId}?tab=quizzes`;
  const att = (week: number, type: string) => attendance.find((a) => a.week === week && a.type === type);
  const weeks = program.weeks.filter((w) => w.number >= 0 && w.number <= 13);
  const stage = (s: string) => diagnostics.find((d) => d.stage === s);
  const scoresOf = (s: string): Record<string, number> => {
    try {
      return JSON.parse(stage(s)?.scores ?? "{}");
    } catch {
      return {};
    }
  };

  return (
    <div className="space-y-6">
      <Card title={`الاختبارات التكوينية (${attempts.length} من ${quizzes.length})`}>
        {quizzes.length === 0 ? <p className="text-sm text-muted">لا اختبارات منشورة.</p> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>الاختبار</th><th>الأسبوع</th><th>النتيجة</th><th>التاريخ</th><th></th></tr></thead>
              <tbody>
                {quizzes.map((q) => {
                  const a = attemptOf.get(q.id);
                  return (
                    <tr key={q.id}>
                      <td><Link href={`/admin/quizzes/${q.id}`} prefetch={false} className="hover:underline">{q.title}</Link></td>
                      <td>{q.week ?? "—"}</td>
                      <td className="tabular-nums">{a ? `${a.score} / ${a.total}` : "لم يؤدِّه"}</td>
                      <td className="text-xs">{a ? formatShort(a.createdAt) : ""}</td>
                      <td>
                        {a && (
                          <details>
                            <summary className="cursor-pointer text-xs text-muted">إعادة فتح</summary>
                            <form action={resetQuizAttempt} className="flex gap-1 mt-1">
                              <input type="hidden" name="quizId" value={q.id} />
                              <input type="hidden" name="userId" value={userId} />
                              <input type="hidden" name="back" value={back} />
                              <input name="reason" className="input" placeholder="السبب" required />
                              <SubmitButton secondary className="btn-sm" confirm="تُحذف محاولته ويُعاد فتح الاختبار له. متابعة؟">فتح</SubmitButton>
                            </form>
                          </details>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="الحضور والمشاركة" action={<Link href="/admin/attendance" prefetch={false} className="text-sm underline">صفحة الحضور</Link>}>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>الأسبوع</th><th>اللقاء الحضوري</th><th>رصد المشاركة</th><th>حلقة النقاش</th><th>المشاركة في الحلقة</th><th>ملاحظة</th></tr></thead>
            <tbody>
              {weeks.map((w) => {
                const a = att(w.number, "INPERSON");
                const b = att(w.number, "REMOTE");
                return (
                  <tr key={w.number}>
                    <td><Link href={`/admin/attendance?week=${w.number}`} prefetch={false} className="hover:underline">{weekName(w.number)}</Link></td>
                    <td>{a ? ATTENDANCE_LABELS[a.status] : "—"}</td>
                    <td className="tabular-nums">{a?.participation ?? "—"}</td>
                    <td>{b ? ATTENDANCE_LABELS[b.status] : "—"}</td>
                    <td className="tabular-nums">{b?.circleScore ?? "—"}</td>
                    <td className="text-xs">{[a?.note, b?.note].filter(Boolean).join(" · ")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="طلبات الاستئذان والتأجيل" action={<Link href="/admin/excuses" prefetch={false} className="text-sm underline">البتّ في الطلبات</Link>}>
        {excuses.length === 0 ? <p className="text-sm text-muted">لا طلبات.</p> : (
          <ul className="text-sm divide-y divide-line">
            {excuses.map((x) => (
              <li key={x.id} className="py-2">
                <div className="flex justify-between gap-2">
                  <span className="font-medium">{EXCUSE_KINDS[x.kind as keyof typeof EXCUSE_KINDS] ?? x.kind}{x.week != null ? ` · ${weekName(x.week)}` : ""}</span>
                  <Badge tone={x.status === "PENDING" ? "default" : "ink"}>{EXCUSE_STATUS[x.status] ?? x.status}</Badge>
                </div>
                <div className="text-muted">{x.reason}</div>
                {x.decision && <div className="text-xs">القرار: {x.decision}</div>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="التقييم التشخيصي">
        {diagnostics.length === 0 ? <p className="text-sm text-muted">لم يعبّئه بعد.</p> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>الكفاءة</th><th>القبلي</th><th>البعدي</th></tr></thead>
              <tbody>
                {comps.map((c) => (
                  <tr key={c.slug}><td>{c.name}</td><td className="tabular-nums">{scoresOf("PRE")[c.slug] ?? "—"}</td><td className="tabular-nums">{scoresOf("POST")[c.slug] ?? "—"}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

// ——— اليوميات ———

export async function JournalTab({ ctx }: { ctx: Ctx }) {
  const { userId } = ctx;
  const [reflections, habits, stops] = await Promise.all([
    db.reflection.findMany({ where: { userId }, orderBy: { date: "desc" } }),
    db.habit.findMany({ where: { userId }, include: { logs: { orderBy: { date: "desc" } } } }),
    db.tadabburStop.findMany({ where: { userId }, orderBy: { week: "asc" } }),
  ]);
  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-xl mb-3">الوقفات التدبرية ({stops.length} من 3 على الأقل)</h2>
        {stops.length === 0 ? <Empty>لم يسجّل وقفة بعد.</Empty> : (
          <div className="space-y-2">
            {stops.map((t) => (
              <div key={t.id} className="card flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs text-muted">{weekName(t.week)}</div>
                  <div className="font-medium">{t.topic}</div>
                  {t.notes && <div className="text-sm text-muted mt-1 whitespace-pre-wrap">{t.notes}</div>}
                </div>
                <ItemActions userId={userId} tab="journal" activity="TADABBUR" id={t.id} label={`الوقفة «${t.topic}»`} />
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xl mb-3">دفتر التأمل ({reflections.length})</h2>
        {reflections.length === 0 ? <Empty>لا تدوينات.</Empty> : (
          <div className="space-y-2">
            {reflections.map((r) => (
              <div key={r.id} className="card flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs text-muted">{formatShort(r.date)}</div>
                  <div className="text-sm whitespace-pre-wrap">{r.text}</div>
                </div>
                <ItemActions userId={userId} tab="journal" activity="REFLECTION" id={r.id} label="هذه التدوينة" />
              </div>
            ))}
          </div>
        )}
      </section>

      <Card title="متتبع العادات">
        {habits.length === 0 ? <p className="text-sm text-muted">لا عادات.</p> : (
          <ul className="text-sm divide-y divide-line">
            {habits.map((h) => (
              <li key={h.id} className="py-2 flex justify-between gap-2">
                <span>{h.name}</span>
                <span className="text-muted tabular-nums">{h.logs.length} يوماً{h.logs[0] ? ` · آخرها ${h.logs[0].date}` : ""}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

// ——— السجل والحساب ———

export async function LogTab({ ctx, isParticipant }: { ctx: Ctx; isParticipant: boolean }) {
  const { userId } = ctx;
  const [u, mentors, sessions, entries] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { id: true, name: true, phone: true, email: true, role: true, mentorId: true, active: true, charterAcceptedAt: true, charterName: true, surveyDoneAt: true, portfolioSubmittedAt: true } }),
    db.user.findMany({ where: { role: "MENTOR", active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    isParticipant ? db.feedbackSession.findMany({ where: { userId }, orderBy: { date: "desc" } }) : Promise.resolve([]),
    isParticipant ? buildTimeline(userId, 200, "admin") : Promise.resolve([]),
  ]);
  if (!u) return null;
  return (
    <div className="space-y-4">
      {isParticipant && (
        <div className="grid md:grid-cols-2 gap-4">
          <Card title="الميثاق والاستبانة وملف الإنجاز">
            <ul className="text-sm divide-y divide-line">
              <li className="py-1.5 flex justify-between gap-2"><span>ميثاق المشاركة</span><span className="text-muted">{u.charterAcceptedAt ? `موقّع باسم ${u.charterName} · ${formatShort(u.charterAcceptedAt)}` : "غير موقّع"}</span></li>
              <li className="py-1.5 flex justify-between gap-2"><span>استبانة الرضا</span><span className="text-muted">{u.surveyDoneAt ? `عُبّئت ${formatShort(u.surveyDoneAt)} (مجهولة المحتوى)` : "لم تُعبّأ"}</span></li>
              <li className="py-1.5 flex justify-between gap-2"><span>ملف الإنجاز</span><span className="text-muted">{u.portfolioSubmittedAt ? `سُلّم ${formatShort(u.portfolioSubmittedAt)}` : "لم يُسلَّم"}</span></li>
            </ul>
            <Link href={`/admin/participants/${userId}/portfolio`} prefetch={false} className="btn btn-sm btn-secondary mt-3">عرض ملف الإنجاز وطباعته</Link>
          </Card>
          <Card title="جلسات التغذية الراجعة الفردية">
            <form action={addFeedbackSession} className="mb-3">
              <input type="hidden" name="userId" value={userId} />
              <div className="field"><label className="label">التاريخ</label><input type="date" name="date" className="input" defaultValue={todayKey()} /></div>
              <div className="field"><label className="label">ملاحظات الجلسة</label><textarea name="notes" className="textarea" required /></div>
              <SubmitButton className="btn-sm">تسجيل الجلسة وإشعار المشارك</SubmitButton>
            </form>
            {sessions.length === 0 ? <p className="text-sm text-muted">لا جلسات مسجلة.</p> : (
              <ul className="text-sm divide-y divide-line">
                {sessions.map((f) => <li key={f.id} className="py-2"><div className="text-xs text-muted">{formatShort(f.date)}</div><div className="whitespace-pre-wrap">{f.notes}</div></li>)}
              </ul>
            )}
          </Card>
        </div>
      )}
      {isParticipant && (
        <Card title="سجل النشاط">
          <p className="text-xs text-muted mb-3">كل ما سجّله أو سُجّل عليه، من الأحدث. والروابط إلى موضعه في هذا الملف.</p>
          <Timeline entries={entries} />
        </Card>
      )}
      <Card title="بيانات الحساب">
        <form action={updateUser}>
          <input type="hidden" name="id" value={u.id} />
          <div className="field"><label className="label">الاسم</label><input name="name" className="input" defaultValue={u.name} required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="field"><label className="label">الجوال</label><input name="phone" className="input" dir="ltr" defaultValue={u.phone ?? ""} /></div>
            <div className="field"><label className="label">البريد</label><input name="email" className="input" dir="ltr" defaultValue={u.email ?? ""} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="field">
              <label className="label">الدور</label>
              <select name="role" className="select" defaultValue={u.role}>
                <option value="PARTICIPANT">مشارك</option>
                <option value="MENTOR">مشرف مرافق</option>
                <option value="ADMIN">مدير المشروع</option>
              </select>
            </div>
            <div className="field">
              <label className="label">المشرف المرافق</label>
              <select name="mentorId" className="select" defaultValue={u.mentorId ?? ""}>
                <option value="">— بدون —</option>
                {mentors.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          </div>
          <div className="field"><label className="label">كلمة مرور جديدة (اتركها فارغة للإبقاء)</label><input name="password" className="input" dir="ltr" minLength={6} autoComplete="new-password" /></div>
          <label className="flex items-center gap-2 text-sm mb-4"><input type="checkbox" name="active" defaultChecked={u.active} className="accent-black" /> الحساب نشط</label>
          <SubmitButton secondary>حفظ</SubmitButton>
        </form>
      </Card>
    </div>
  );
}
