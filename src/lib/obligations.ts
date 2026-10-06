import { cache } from "react";
import { keyToDate, reportDueFrom } from "./dates";
import { resolveCurrentWeek, weekResolver, type LiveWeek } from "./weeks";
import { dueFor, loadParticipant, loadParticipantsOnce, loadProgram, type ParticipantRows, type ProgramData } from "./participant-data";
import { readingByWeek, readingDeadline, weekQuota } from "./reading-quota";
import { RETURN_KINDS, returnedIds, type OpenReturn, type ReturnKind } from "./returns";
import { remaining } from "./week-state";

/**
 * «مهامي»: كل ما يُطلب من المشارك في قائمة واحدة، بحاله وموعده.
 *
 * كان المطلوب موزّعاً على أربع عشرة صفحة لا تجمعها واحدة: المهمة في «المهام»،
 * والتقرير في «التقارير» وزرُّه يوم الخميس وحده، والورد في «القراءة»، والخطة
 * والمشروع والقيادة كلٌّ في بابه — ولا يظهر في الرئيسية إلا مهامُّ لم يحن موعدها،
 * فما تأخّر منها اختفى من عين صاحبه وهو أحوج ما يكون إلى رؤيته.
 *
 * دالةٌ نقية على صفوف `loadParticipant` و`loadProgram`، فيتقاسمها عدّاد التنقّل
 * و«مهامي» والرئيسية وملف المشارك عند المدير في الطلب نفسه بلا استعلام زائد.
 *
 * والموعد الأصلي هو المرجع دائماً: ما أُرجع إلى صاحبه يعود بعدّاد موعده الذي
 * كان، لا بمهلة جديدة — فيبادر إليه.
 */

export type ObligationKind =
  | "ASSIGNMENT" | "REPORT" | "READING" | "QUIZ" | "FIELD" | "PLAN" | "CHARTER" | "DIAGNOSTIC"
  | "LEADERSHIP" | "PEER_EVAL" | "PROJECT" | "TADABBUR" | "SURVEY" | "PORTFOLIO";

/** المُرجَع للتعديل · المتأخر · المطلوب هذا الأسبوع · القادم · المنجز */
export type ObligationState = "returned" | "overdue" | "due" | "upcoming" | "done";

/** شرائح التصفية في «مهامي» */
export type ObligationGroup = "tasks" | "reports" | "reading" | "quizzes" | "field" | "other";

export type Obligation = {
  key: string;
  kind: ObligationKind;
  group: ObligationGroup;
  title: string;
  week?: number;
  /** الموعد الساري — وللمُرجَع موعده الأصلي */
  dueAt: Date | null;
  state: ObligationState;
  href: string;
  /** فعلُ الزر: «سلّم الآن»، «أكمل»… */
  action: string;
  detail?: string;
  /** تقدّمٌ لما يُقاس بالكمّ: صفحات الورد، ساعات المعايشة، الوقفات */
  progress?: { done: number; total: number; unit: string };
  /** للمُرجَع: نوع السجل ومعرّفه وملاحظة المدير */
  returned?: { kind: ReturnKind; recordId: string; note: string; returnedAt: Date; by: string };
  /** وحداتٌ أخرى يُنجز فيها جزء من هذا البند — مهمةٌ نصُّها «خطة التعلم + خطة المحفوظ» تُكتب في صفحة الخطة */
  related?: { label: string; href: string; done: boolean }[];
  /** ما يُكتب على البند المنجز: «مقيَّمة 14/16»، «تمت المراجعة» */
  doneLabel?: string;
};

export type ObligationsResult = {
  items: Obligation[];
  /** المتأخر والمُرجَع — رقم العدّاد */
  outstanding: number;
  counts: Record<ObligationState, number>;
  /** المشارك في دفعةٍ غير الدفعة النشطة: لا يُحسب عليه جدولٌ ليس جدوله */
  otherCohort: boolean;
  /** رقم الأسبوع الحالي: -1 قبل البرنامج، 15 بعد انتهائه */
  currentWeek: number;
};

const DAY = 86400000;

/** آخر لحظة في أسبوع البرنامج: الجمعة 23:59:59 بتوقيت الرياض */
export function weekEnd(w: Pick<LiveWeek, "gregorian">): Date {
  return new Date(keyToDate(w.gregorian).getTime() + 7 * DAY - 1000);
}

/** ثلاثة أيام بعد اللقاء الافتتاحي، العاشرة مساءً — موعد الخطة والميثاق والتشخيص القبلي */
function openingDeadline(w0: Pick<LiveWeek, "gregorian">): Date {
  return new Date(keyToDate(w0.gregorian).getTime() + 3 * DAY + 22 * 3600000);
}

/**
 * عناوين مهامٍّ تُنجز في وحدةٍ لها بابها: خطة الأسبوع الافتتاحي تُكتب في صفحة
 * الخطة، وموضوع المشروع ومسودته في صفحة المشروع. فلا تظهر الوحدة بنداً ثانياً
 * إلى جانب المهمة، وإنما تُذكر داخلها رابطاً — ويتخطّاها مُنشئ المهام الناقصة.
 */
export const NATIVE: { kind: "PLAN" | "PROJECT_TOPIC" | "PROJECT_DRAFT" | "HABITS" | "FIELD_START" | "PORTFOLIO"; label: string; href: string; match: RegExp }[] = [
  { kind: "PLAN", label: "خطة التعلم الشخصية", href: "/app/plan", match: /خطة التعلم|خطة مراجعة المحفوظ/ },
  { kind: "PROJECT_TOPIC", label: "موضوع مشروع التخرج", href: "/app/project", match: /موضوع مشروع التخرج/ },
  { kind: "PROJECT_DRAFT", label: "مسودة مشروع التخرج", href: "/app/project", match: /مسودة مشروع التخرج/ },
  { kind: "HABITS", label: "متتبع العادات", href: "/app/habits", match: /متتبع العادات/ },
  { kind: "FIELD_START", label: "سجل المعايشة", href: "/app/field", match: /بدء المعايشة/ },
  { kind: "PORTFOLIO", label: "ملف الإنجاز", href: "/app/portfolio", match: /ملف الإنجاز/ },
];

/** أجزاء عنوان المهمة المطابقة لوحدةٍ لها بابها */
export function nativeParts(title: string) {
  return title
    .split(/\s+\+\s+/)
    .map((part) => ({ part, native: NATIVE.find((n) => n.match.test(part)) }));
}

/** «فات موعده اليوم» و«متأخر يوماً واحداً» و«متأخر يومين» و«متأخر 3 أيام» و«متأخر 12 يوماً» */
export function overdueLabel(days: number): string {
  if (days <= 0) return "فات موعده اليوم";
  if (days === 1) return "متأخر يوماً واحداً";
  if (days === 2) return "متأخر يومين";
  if (days <= 10) return `متأخر ${days} أيام`;
  return `متأخر ${days} يوماً`;
}

/** أيام التأخر صراحةً — لا بتقريب `daysUntil` إلى أعلى فيقرأ «متأخر 0 يوم» */
export function daysLate(due: Date, now: Date): number {
  return Math.floor((now.getTime() - due.getTime()) / DAY);
}

/** سطر العدّاد تحت البند: كم بقي، أو كم تأخّر عن موعده (الأصلي للمُرجَع) */
export function timingLabel(o: Pick<Obligation, "dueAt" | "state">, now: Date): string {
  if (!o.dueAt || o.state === "done") return "";
  if (o.dueAt.getTime() < now.getTime()) return overdueLabel(daysLate(o.dueAt, now));
  return remaining(Math.max(0, Math.ceil((o.dueAt.getTime() - now.getTime()) / DAY)));
}

/** «ساعة» و«ساعتان» و«3 ساعات» */
function hoursText(n: number): string {
  const v = Math.round(n * 10) / 10;
  if (v === 1) return "ساعة";
  if (v === 2) return "ساعتان";
  return v <= 10 ? `${v} ساعات` : `${v} ساعة`;
}

export function obligationsFrom(rows: ParticipantRows, program: ProgramData, now: Date = new Date()): ObligationsResult {
  const { weeks } = program;
  const cur = resolveCurrentWeek(weeks, now);
  const empty: ObligationsResult = { items: [], outstanding: 0, counts: { returned: 0, overdue: 0, due: 0, upcoming: 0, done: 0 }, otherCohort: false, currentWeek: cur };
  if (rows.user.role !== "PARTICIPANT") return empty;
  if (rows.user.cohortId && program.cohortId && rows.user.cohortId !== program.cohortId) return { ...empty, otherCohort: true };

  const byNumber = new Map(weeks.map((w) => [w.number, w]));
  const w0 = byNumber.get(0);
  const curWeek = byNumber.get(cur);
  // نهاية الأسبوع الجاري: ما موعده قبلها «مطلوب هذا الأسبوع»، وما بعدها «قادم»
  const horizon = curWeek ? weekEnd(curWeek).getTime() : cur < 0 && w0 ? weekEnd(w0).getTime() : now.getTime();
  // المنضمّ بعد بدء البرنامج لا يُطالَب بما فات قبل انضمامه
  const joinWeek = weekResolver(weeks)(rows.user.createdAt) ?? -1;
  const joinedAt = rows.user.createdAt.getTime();

  const returns = rows.returns;
  const retOf = (kind: ReturnKind, id: string): OpenReturn | undefined => returns.find((r) => r.kind === kind && r.recordId === id);
  const items: Obligation[] = [];

  /** حالة بندٍ له موعد: منجز، أو متأخر، أو مطلوب هذا الأسبوع، أو قادم */
  const stateOf = (done: boolean, due: Date | null, week?: number): ObligationState => {
    if (done) return "done";
    // أسبوعٌ لم يبدأ — أو برنامجٌ لم يبدأ — لا يُطالَب بشيء منه بعد
    if (week != null && (cur < 0 || week > cur) && cur < 15) return "upcoming";
    if (!due) return "due";
    if (due.getTime() < now.getTime()) return "overdue";
    return due.getTime() <= horizon ? "due" : "upcoming";
  };
  const withReturn = (o: Obligation, kind: ReturnKind, id: string): Obligation => {
    const r = retOf(kind, id);
    if (!r) return o;
    return { ...o, state: "returned", action: "عدّل وأعد التقديم", returned: { kind, recordId: id, note: r.note, returnedAt: r.returnedAt, by: r.returnedBy } };
  };

  // ——— المهام المقيَّمة ———
  const subOf = new Map(rows.submissions.map((s) => [s.assignmentId, s]));
  const folded = new Set<string>();
  for (const a of program.assignments) {
    const due = dueFor(a, rows.extensions);
    if (due.getTime() < joinedAt) continue;
    const s = subOf.get(a.id);
    const parts = nativeParts(a.title);
    // «خطة التعلم + خطة المحفوظ» جزءان في صفحة واحدة: رابطٌ واحد لكل وحدة
    const natives = [...new Map(parts.filter((p) => p.native).map((p) => [p.native!.kind, p.native!])).values()];
    const related = natives.map((n) => {
      folded.add(n.kind);
      return { label: n.label, href: n.href, done: nativeDone(n.kind, rows) };
    });
    const total = s?.gradedAt ? (s.completeness ?? 0) + (s.referencing ?? 0) + (s.application ?? 0) + (s.punctuality ?? 0) : null;
    let o: Obligation = {
      key: `assignment:${a.id}`,
      kind: "ASSIGNMENT",
      group: "tasks",
      title: a.title,
      week: a.week,
      dueAt: due,
      state: stateOf(!!s, due, a.week),
      href: `/app/tasks/${a.id}`,
      action: s ? "افتح" : "سلّم الآن",
      related: related.length ? related : undefined,
      doneLabel: total != null ? `مقيَّمة ${total}/16` : s ? "مسلَّمة — بانتظار التقييم" : undefined,
      detail: due.getTime() !== a.dueAt.getTime() ? "مُدَّد لك" : undefined,
    };
    if (s) o = withReturn(o, "SUBMISSION", s.id);
    items.push(o);
  }

  // ——— التقارير الأسبوعية: الافتتاحي حتى الثاني عشر ———
  const reportOf = new Map(rows.reports.map((r) => [r.week, r]));
  const tasksOf = (n: number) => program.weekTasks.filter((t) => t.week === n).map((t) => t.title);
  for (const w of weeks) {
    if (w.number < 0 || w.number > 12 || w.number < joinWeek) continue;
    const due = reportDueFrom(w.gregorian);
    const r = reportOf.get(w.number);
    const tasks = tasksOf(w.number);
    let o: Obligation = {
      key: `report:${w.number}`,
      kind: "REPORT",
      group: "reports",
      title: `التقرير الأسبوعي — ${w.number === 0 ? "الأسبوع الافتتاحي" : `الأسبوع ${w.number}`}`,
      week: w.number,
      dueAt: due,
      state: stateOf(!!r, due, w.number),
      href: `/app/reports/${w.number}`,
      action: r ? "افتح" : "اكتب التقرير",
      detail: tasks.length ? `يُرصد فيه: ${tasks.join("، ")}` : undefined,
      doneLabel: r ? (r.reviewedAt ? "مسلَّم — تمت المراجعة" : "مسلَّم") : undefined,
    };
    if (r) o = withReturn(o, "WEEKLY_REPORT", r.id);
    items.push(o);
  }

  // ——— الورد القرائي: بندٌ تراكمي واحد يُستدرك بالقراءة لا بتأريخ بطاقةٍ قديمة ———
  const returnedCards = returnedIds(returns, "READING_CARD");
  const byWeek = readingByWeek(rows.cards, weeks, returnedCards).filter((r) => r.week >= joinWeek);
  if (byWeek.length) {
    const read = rows.cards.filter((c) => !returnedCards.has(c.id)).reduce((s, c) => s + Math.max(0, c.toPage - c.fromPage + 1), 0);
    let cumulative = 0;
    let missedSince: Date | null = null;
    let soFar = 0;
    let total = 0;
    let current: (typeof byWeek)[number] | undefined;
    for (const r of byWeek) {
      const wk = byNumber.get(r.week)!;
      total += r.quota.pages;
      if (readingDeadline(wk).getTime() <= now.getTime()) {
        soFar += r.quota.pages;
        cumulative += r.quota.pages;
        if (!missedSince && read < cumulative) missedSince = readingDeadline(wk);
      } else if (!current) {
        current = r;
      }
    }
    const behind = Math.max(0, soFar - read);
    const curDue = current ? readingDeadline(byNumber.get(current.week)!) : null;
    const needed = soFar + (current?.quota.pages ?? 0);
    const inProgress = cur >= 0 && !!current && current.week <= cur;
    const state: ObligationState = read >= total ? "done" : behind > 0 ? "overdue" : inProgress ? (read >= needed ? "done" : "due") : "upcoming";
    items.push({
      key: "reading",
      kind: "READING",
      group: "reading",
      title: "الورد القرائي",
      week: current?.week,
      dueAt: behind > 0 ? missedSince : curDue,
      state,
      href: "/app/reading",
      action: "سجّل بطاقة",
      progress: { done: read, total: state === "overdue" ? soFar : needed || total, unit: "صفحة" },
      detail:
        behind > 0
          ? `ينقصك ${behind} صفحة من ورد ما مضى من الأسابيع`
          : inProgress
            ? read >= needed
              ? "أتممت ورد هذا الأسبوع"
              : `بقي ${needed - read} صفحة من ورد هذا الأسبوع (${current?.quota.pages ?? 0} صفحة في الجدول)`
            : undefined,
      doneLabel: read >= total ? "أتممت ورد البرنامج كله" : "أتممت ورد ما مضى",
    });
  }
  // البطاقات المُرجَعة: كلٌّ بندٌ بموعد أسبوعها
  const weekOf = weekResolver(weeks);
  for (const c of rows.cards) {
    const r = retOf("READING_CARD", c.id);
    if (!r) continue;
    const wk = byNumber.get(weekOf(c.date) ?? -99);
    items.push({
      key: `card:${c.id}`,
      kind: "READING",
      group: "reading",
      title: `بطاقة قراءة — ${c.book} (ص ${c.fromPage}–${c.toPage})`,
      week: wk?.number,
      dueAt: wk ? readingDeadline(wk) : null,
      state: "returned",
      href: `/app/reading?edit=${c.id}#card-${c.id}`,
      action: "عدّل وأعد التقديم",
      returned: { kind: "READING_CARD", recordId: c.id, note: r.note, returnedAt: r.returnedAt, by: r.returnedBy },
    });
  }

  // ——— الاختبارات التكوينية: المنشور ذو الأسئلة وحده ———
  const attempted = new Set(rows.attempts.map((a) => a.quizId));
  for (const q of program.quizzes) {
    if (!q.published || q.questions === 0) continue;
    if (q.week != null && q.week < joinWeek) continue;
    const wk = q.week != null ? byNumber.get(q.week) : undefined;
    // اختبارٌ بلا أسبوع لا موعد له ولا يتأخر
    const due = wk ? weekEnd(wk) : null;
    const done = attempted.has(q.id);
    items.push({
      key: `quiz:${q.id}`,
      kind: "QUIZ",
      group: "quizzes",
      title: q.title,
      week: q.week ?? undefined,
      dueAt: due,
      state: stateOf(done, due, q.week ?? undefined),
      href: `/app/quizzes/${q.id}`,
      action: done ? "النتيجة" : "ابدأ الاختبار",
      doneLabel: done ? "أُدّي" : undefined,
    });
  }

  // ——— المعايشة الميدانية: ساعةٌ في كل أسبوعٍ فيه معايشة، تراكمياً ———
  const fieldWeeks = weeks.filter((w) => w.field && w.number >= Math.max(0, joinWeek) && w.number <= 12).sort((a, b) => a.number - b.number);
  if (fieldWeeks.length) {
    const returnedLogs = returnedIds(returns, "FIELD_LOG");
    const logged = rows.fieldLogs.filter((f) => !returnedLogs.has(f.id)).reduce((s, f) => s + f.hours, 0);
    const pending = rows.fieldLogs.filter((f) => !returnedLogs.has(f.id) && !f.approvedAt).reduce((s, f) => s + f.hours, 0);
    let soFar = 0;
    let missedSince: Date | null = null;
    let current: LiveWeek | undefined;
    for (const w of fieldWeeks) {
      if (weekEnd(w).getTime() <= now.getTime()) {
        soFar += 1;
        if (!missedSince && logged < soFar) missedSince = weekEnd(w);
      } else if (!current) current = w;
    }
    const total = fieldWeeks.length;
    const behind = Math.max(0, soFar - logged);
    const inProgress = cur >= 0 && !!current && current.number <= cur;
    const needed = soFar + (inProgress ? 1 : 0);
    const state: ObligationState = logged >= total ? "done" : behind > 0 ? "overdue" : inProgress ? (logged >= needed ? "done" : "due") : "upcoming";
    items.push({
      key: "field",
      kind: "FIELD",
      group: "field",
      title: "المعايشة الميدانية",
      week: current?.number,
      dueAt: behind > 0 ? missedSince : current ? weekEnd(current) : null,
      state,
      href: "/app/field",
      action: "سجّل ساعة",
      progress: { done: Math.round(logged * 10) / 10, total: state === "overdue" ? soFar : needed || total, unit: "ساعة" },
      detail: behind > 0 ? `ينقصك ${hoursText(behind)} من معايشة ما مضى` : pending ? `${hoursText(pending)} بانتظار اعتماد المشرف` : undefined,
      doneLabel: "مسجّلة",
    });
  }
  for (const f of rows.fieldLogs) {
    const r = retOf("FIELD_LOG", f.id);
    if (!r) continue;
    const wk = byNumber.get(weekOf(f.date) ?? -99);
    items.push({
      key: `fieldlog:${f.id}`,
      kind: "FIELD",
      group: "field",
      title: `سجل معايشة — ${hoursText(f.hours)}`,
      week: wk?.number,
      dueAt: wk ? weekEnd(wk) : null,
      state: "returned",
      href: `/app/field?edit=${f.id}#log-${f.id}`,
      action: "عدّل وأعد التقديم",
      returned: { kind: "FIELD_LOG", recordId: f.id, note: r.note, returnedAt: r.returnedAt, by: r.returnedBy },
    });
  }

  // ——— ما يُنجز مرة واحدة ———
  // ومن انضمّ بعد الافتتاح فمهلته ثلاثة أيام من انضمامه، لا موعدٌ فات قبل أن يأتي
  const openDue = w0 ? new Date(Math.max(openingDeadline(w0).getTime(), joinedAt + 3 * DAY)) : null;
  if (!rows.user.charterAcceptedAt) {
    items.push({ key: "charter", kind: "CHARTER", group: "other", title: "توقيع ميثاق المشاركة", dueAt: openDue, state: stateOf(false, openDue), href: "/app/charter", action: "وقّع الميثاق", detail: "شرطٌ لبدء البرنامج ومنح وثيقة الإتمام" });
  }
  if (!folded.has("PLAN")) {
    let o: Obligation = {
      key: "plan", kind: "PLAN", group: "other", title: "خطة التعلم الشخصية وخطة مراجعة المحفوظ", week: 0,
      dueAt: openDue, state: stateOf(!!rows.plan, openDue), href: "/app/plan", action: rows.plan ? "افتح" : "اكتب الخطة",
      doneLabel: rows.plan?.reviewedAt ? "مسلَّمة — تمت المراجعة" : "مسلَّمة",
    };
    if (rows.plan) o = withReturn(o, "LEARNING_PLAN", rows.plan.id);
    items.push(o);
  } else if (rows.plan) {
    // الخطة مطويّة في مهمة الأسبوع الافتتاحي؛ وإن أُرجعت فلها بندها حتى يعيدها صاحبها
    const r = retOf("LEARNING_PLAN", rows.plan.id);
    if (r) items.push(withReturn({ key: "plan", kind: "PLAN", group: "other", title: "خطة التعلم الشخصية", week: 0, dueAt: openDue, state: "done", href: "/app/plan", action: "افتح" }, "LEARNING_PLAN", rows.plan.id));
  }
  if (!rows.diagnostics.includes("PRE")) {
    items.push({ key: "diagnostic:pre", kind: "DIAGNOSTIC", group: "other", title: "التقييم التشخيصي القبلي", dueAt: openDue, state: stateOf(false, openDue), href: "/app/diagnostic", action: "عبّئ التقييم", detail: "يقيس مستواك قبل البرنامج ولا يدخل في درجاتك" });
  }
  const w12 = byNumber.get(12);
  const w13 = byNumber.get(13);
  if (rows.diagnostics.includes("PRE") && !rows.diagnostics.includes("POST") && w13) {
    const due = weekEnd(w13);
    items.push({ key: "diagnostic:post", kind: "DIAGNOSTIC", group: "other", title: "التقييم التشخيصي البعدي", week: 12, dueAt: due, state: stateOf(false, due, 12), href: "/app/diagnostic", action: "عبّئ التقييم" });
  }
  if (w12) {
    const due = weekEnd(w12);
    const returnedActs = returnedIds(returns, "LEADERSHIP");
    const counted = rows.activities.filter((a) => !returnedActs.has(a.id));
    items.push({ key: "leadership", kind: "LEADERSHIP", group: "other", title: "الدور القيادي: نشاطٌ تقوده وتكتب تقريره", week: 5, dueAt: due, state: stateOf(counted.length > 0, due, 5), href: "/app/leadership", action: counted.length ? "افتح" : "سجّل نشاطاً", doneLabel: `${counted.length} نشاط` });
    for (const a of rows.activities) {
      const r = retOf("LEADERSHIP", a.id);
      if (r) items.push(withReturn({ key: `leadership:${a.id}`, kind: "LEADERSHIP", group: "other", title: `نشاط قيادي — ${a.title}`, dueAt: due, state: "done", href: `/app/leadership#a-${a.id}`, action: "افتح" }, "LEADERSHIP", a.id));
    }
    items.push({
      key: "tadabbur", kind: "TADABBUR", group: "other", title: "الوقفات التدبرية", dueAt: due, state: stateOf(rows.tadabbur >= 3, due),
      href: "/app/plan", action: "سجّل وقفة", progress: { done: Math.min(rows.tadabbur, 3), total: 3, unit: "وقفات" }, doneLabel: `${rows.tadabbur} وقفات`,
    });
  }
  const mine = new Set(rows.activities.map((a) => a.id));
  const toEvaluate = program.activities.filter((a) => a.userId !== rows.user.id && !mine.has(a.id) && !rows.evaluated.has(a.id));
  if (toEvaluate.length) {
    items.push({ key: "peer-eval", kind: "PEER_EVAL", group: "other", title: `تقييم أنشطة زملائك القيادية (${toEvaluate.length})`, dueAt: null, state: "due", href: "/app/leadership", action: "قيّم", detail: toEvaluate.slice(0, 3).map((a) => a.title).join("، ") });
  }

  // ——— مشروع التخرج: الموضوع في العاشر، والمسودة في الثاني عشر، والنهائي في الختامي ———
  const w10 = byNumber.get(10);
  const p = rows.project;
  const projectReturn = p ? retOf("PROJECT", p.id) : undefined;
  if (w10 && !folded.has("PROJECT_TOPIC")) {
    const due = weekEnd(w10);
    items.push({
      key: "project:topic", kind: "PROJECT", group: "other", title: "تحديد موضوع مشروع التخرج", week: 10, dueAt: due,
      state: stateOf(!!p, due, 10), href: "/app/project", action: p ? "افتح" : "اقترح الموضوع",
      doneLabel: p?.status === "PROPOSED" ? "سُلِّم — بانتظار اعتماد الموضوع" : "اعتُمد الموضوع",
    });
  }
  if (w12 && !folded.has("PROJECT_DRAFT")) {
    const due = weekEnd(w12);
    const approved = !!p && p.status !== "PROPOSED";
    const done = !!p && (p.status === "DRAFT" || p.status === "FINAL" || p.status === "JUDGED" || !!p.draftLink);
    items.push({
      key: "project:draft", kind: "PROJECT", group: "other", title: "مسودة مشروع التخرج", week: 12, dueAt: due,
      // المسودة لا تُرفع قبل اعتماد الموضوع، فلا تُحسب متأخرةً على من ينتظر الاعتماد
      state: approved ? stateOf(done, due, 12) : "upcoming",
      href: "/app/project", action: "ارفع المسودة",
      detail: approved ? undefined : "تُرفع بعد اعتماد الموضوع",
    });
  }
  if (w13) {
    const due = keyToDate(w13.gregorian);
    const done = !!p && (p.status === "FINAL" || p.status === "JUDGED" || !!p.finalLink);
    items.push({ key: "project:final", kind: "PROJECT", group: "other", title: "النسخة النهائية لمشروع التخرج", week: 13, dueAt: due, state: stateOf(done, due, 13), href: "/app/project", action: "ارفع النسخة النهائية", doneLabel: p?.status === "JUDGED" ? "حُكِّم" : "سُلِّمت" });
    items.push({ key: "portfolio", kind: "PORTFOLIO", group: "other", title: "التسليم النهائي لملف الإنجاز", week: 13, dueAt: due, state: stateOf(!!rows.user.portfolioSubmittedAt, due, 13), href: "/app/portfolio", action: "راجع وسلّم" });
    if (cur >= 13) {
      const sdue = weekEnd(w13);
      items.push({ key: "survey", kind: "SURVEY", group: "other", title: "استبانة رضا المشاركين", week: 13, dueAt: sdue, state: stateOf(!!rows.user.surveyDoneAt, sdue, 13), href: "/app/survey", action: "أجب عن الاستبانة" });
    }
  }
  if (p && projectReturn) {
    items.push(withReturn({ key: `project:${p.id}`, kind: "PROJECT", group: "other", title: `مشروع التخرج — ${p.topic}`, dueAt: w12 ? weekEnd(w12) : null, state: "done", href: "/app/project", action: "افتح" }, "PROJECT", p.id));
  }

  const counts = { returned: 0, overdue: 0, due: 0, upcoming: 0, done: 0 } as Record<ObligationState, number>;
  for (const i of items) counts[i.state]++;
  // بعد انتهاء البرنامج لا عدّاد يلاحق صاحبه — والمتأخر باقٍ في «مهامي» يُرى
  const outstanding = cur >= 15 ? counts.returned : counts.returned + counts.overdue;
  return { items: sortObligations(items), outstanding, counts, otherCohort: false, currentWeek: cur };
}

/** أُنجز ما تُذكر به الوحدة داخل مهمةٍ مطويّةٍ فيها؟ */
function nativeDone(kind: (typeof NATIVE)[number]["kind"], rows: ParticipantRows): boolean {
  switch (kind) {
    case "PLAN":
      return !!rows.plan;
    case "PROJECT_TOPIC":
      return !!rows.project;
    case "PROJECT_DRAFT":
      return !!rows.project && (rows.project.status === "DRAFT" || rows.project.status === "FINAL" || rows.project.status === "JUDGED");
    case "FIELD_START":
      return rows.fieldLogs.length > 0;
    case "PORTFOLIO":
      return !!rows.user.portfolioSubmittedAt;
    default:
      return false;
  }
}

const ORDER: Record<ObligationState, number> = { returned: 0, overdue: 1, due: 2, upcoming: 3, done: 4 };

/** المُرجَع ثم المتأخر (أقدمه أولاً) ثم المطلوب (أقربه أولاً) ثم القادم ثم المنجز */
export function sortObligations(items: Obligation[]): Obligation[] {
  return [...items].sort((a, b) => {
    const s = ORDER[a.state] - ORDER[b.state];
    if (s) return s;
    const ad = a.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const bd = b.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
    if (ad !== bd) return a.state === "done" ? bd - ad : ad - bd;
    return (a.week ?? 99) - (b.week ?? 99);
  });
}

export const STATE_LABELS: Record<ObligationState, string> = {
  returned: "أُرجع إليك للتعديل",
  overdue: "متأخر",
  due: "مطلوب هذا الأسبوع",
  upcoming: "قادم",
  done: "منجز",
};

export const GROUP_LABELS: Record<ObligationGroup, string> = {
  tasks: "المهام",
  reports: "التقارير",
  reading: "القراءة",
  quizzes: "الاختبارات",
  field: "المعايشة",
  other: "أخرى",
};

/** اسم نوع السجل المُرجَع للعرض */
export function returnKindLabel(kind: ReturnKind): string {
  return RETURN_KINDS[kind];
}

/** الأسبوع بتسميته: «الافتتاحي» أو «الأسبوع 5» */
export function weekName(n: number | undefined): string {
  if (n == null) return "";
  if (n === 0) return "الأسبوع الافتتاحي";
  if (n === 13) return "الأسبوع الختامي";
  return `الأسبوع ${n}`;
}

/**
 * الموعد الأصلي لسجلٍّ يُرجَع — يُذكر في إشعار الإرجاع، ويُعدّ منه العدّاد.
 * للمهمة الأبعد من موعدها وتمديده؛ للتقرير خميس أسبوعه؛ للبطاقة نهاية أسبوع ورده؛
 * للمعايشة نهاية أسبوعها؛ للخطة ثلاثة أيام بعد الافتتاحي؛ للقيادة والمشروع نهاية
 * الأسبوع الثاني عشر.
 */
export function originalDue(
  kind: ReturnKind,
  rec: { assignment?: { id: string; dueAt: Date }; week?: number; date?: Date },
  rows: Pick<ParticipantRows, "extensions">,
  weeks: LiveWeek[],
): Date | null {
  const byNumber = new Map(weeks.map((w) => [w.number, w]));
  const weekOfDate = (d?: Date) => (d ? byNumber.get(weekResolver(weeks)(d) ?? -99) : undefined);
  switch (kind) {
    case "SUBMISSION":
      return rec.assignment ? dueFor(rec.assignment, rows.extensions) : null;
    case "WEEKLY_REPORT": {
      const w = rec.week != null ? byNumber.get(rec.week) : undefined;
      return w ? reportDueFrom(w.gregorian) : null;
    }
    case "READING_CARD": {
      const w = weekOfDate(rec.date);
      return w && weekQuota(w) ? readingDeadline(w) : w ? weekEnd(w) : null;
    }
    case "FIELD_LOG": {
      const w = weekOfDate(rec.date);
      return w ? weekEnd(w) : null;
    }
    case "LEARNING_PLAN": {
      const w = byNumber.get(0);
      return w ? openingDeadline(w) : null;
    }
    case "LEADERSHIP":
    case "PROJECT": {
      const w = byNumber.get(12);
      return w ? weekEnd(w) : null;
    }
  }
}

/** «مهامي» لمشاركٍ واحد، مرة واحدة في الطلب: يقرؤها العدّاد في الهيكل والصفحة معاً */
export const getObligations = cache(async (userId: string): Promise<ObligationsResult | null> => {
  const [rows, program] = await Promise.all([loadParticipant(userId), loadProgram()]);
  return rows ? obligationsFrom(rows, program) : null;
});

/** لمجموعة مشاركين باستعلام واحد لكل جدول — لقائمة المشاركين عند المدير */
export async function obligationsForMany(userIds: string[]): Promise<Map<string, ObligationsResult>> {
  const [rows, program] = await Promise.all([loadParticipantsOnce(userIds), loadProgram()]);
  const now = new Date();
  return new Map([...rows].map(([id, r]) => [id, obligationsFrom(r, program, now)]));
}

/**
 * «مهامي» لمن يتصفّح واجهة المشارك: المشارك ببنوده، ومدير المشروع في المعاينة
 * ببنود حسابه هو كأنه مشاركٌ لم يسلّم شيئاً — فيرى الواجهة كما تبدو لا فارغةً.
 */
export async function obligationsForView(user: { id: string; role: string }, now: Date = new Date()): Promise<ObligationsResult | null> {
  if (user.role === "PARTICIPANT") return getObligations(user.id);
  const [rows, program] = await Promise.all([loadParticipant(user.id), loadProgram()]);
  return rows ? obligationsFrom({ ...rows, user: { ...rows.user, role: "PARTICIPANT", cohortId: null } }, program, now) : null;
}
