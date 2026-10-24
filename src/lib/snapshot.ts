import { db } from "./db";
import { computeGradesFor } from "./grades";
import { currentWeekNumber } from "./weeks";
import { participantsWhere } from "./cohort";
import { sumProgress } from "./progress";

/**
 * أرقام المنصة لحظة إعداد تقرير الجهة. والتقرير مرحليٌّ في الشهر الأول والثاني،
 * فالإنجاز فيه من المستحق حتى تاريخه لا من البرنامج كله (`progress.ts`): الدفعة
 * التي سلّمت كل ما حان موعده تُقرأ ملتزمةً لا مقصّرة.
 *
 * واللقطة تُحفظ مع التقرير نصّاً، فما حُفظ قبل هذا التعديل يخلو من الحقول الجديدة
 * ويحمل `gradeAvg` التراكمي؛ والعرض (`snapshotRows`) يقرأ كلا الشكلين.
 */
export type Snapshot = {
  week: number;
  participants: number;
  attendanceAvg: number;
  /** متوسط نسبة الإنجاز من المستحق */
  completionPct?: number | null;
  /** متوسط الدرجة المرحلية من المستحق، مردودةً إلى 100 */
  interimAvg?: number | null;
  readingCards: number;
  readingPages?: number;
  readingDue?: number;
  reportsSubmitted: number;
  /** في اللقطات الجديدة: التقارير المستحقة حتى تاريخه */
  reportsExpected: number;
  tasksSubmitted: number;
  tasksDue?: number;
  tasksGraded: number;
  fieldHours: number;
  fieldDue?: number;
  quizzesDone?: number;
  quizzesDue?: number;
  quizAvg: number;
  leadership: number;
  projectsApproved: number;
  charterSigned: number;
  /** متوسط الدرجات التراكمية — في اللقطات القديمة وحدها */
  gradeAvg?: number;
};

export async function buildSnapshot(): Promise<Snapshot> {
  const week = await currentWeekNumber();
  const participants = await db.user.findMany({ where: await participantsWhere(), select: { id: true, charterAcceptedAt: true } });
  const ids = participants.map((p) => p.id);
  const grades = await computeGradesFor(ids);
  const [cards, attempts, leadership, projects] = await Promise.all([
    db.readingCard.count({ where: { userId: { in: ids } } }),
    db.quizAttempt.findMany({ where: { userId: { in: ids } }, select: { score: true, total: true } }),
    db.leadershipActivity.count({ where: { userId: { in: ids } } }),
    db.graduationProject.count({ where: { userId: { in: ids }, status: { in: ["APPROVED", "DRAFT", "FINAL", "JUDGED"] } } }),
  ]);
  const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);
  const sum = sumProgress(grades.map((g) => g.due));
  return {
    week: Math.max(0, Math.min(14, week)),
    participants: participants.length,
    attendanceAvg: avg(grades.map((g) => g.stats.attendancePct)) ?? 0,
    completionPct: sum.percent,
    interimAvg: avg(grades.map((g) => g.interim.total).filter((v): v is number => v != null)),
    readingCards: cards,
    readingPages: sum.reading.done,
    readingDue: sum.reading.due,
    reportsSubmitted: sum.reports.done,
    reportsExpected: sum.reports.due,
    tasksSubmitted: sum.tasks.done,
    tasksDue: sum.tasks.due,
    tasksGraded: sum.tasks.graded,
    fieldHours: sum.field.done,
    fieldDue: sum.field.due,
    quizzesDone: sum.quizzes.done,
    quizzesDue: sum.quizzes.due,
    quizAvg: attempts.length ? Math.round((attempts.reduce((s, a) => s + (a.total ? a.score / a.total : 0), 0) / attempts.length) * 100) : 0,
    leadership,
    projectsApproved: projects,
    charterSigned: participants.filter((p) => p.charterAcceptedAt).length,
  };
}

/** «20 من 24 (83%)» — والمستحق مجهولٌ في لقطةٍ قديمة فالعدد وحده */
function ofDue(done: number | undefined, due: number | undefined, unit = ""): string {
  if (done == null) return "—";
  const u = unit ? ` ${unit}` : "";
  if (due == null) return `${done}${u}`;
  if (due <= 0) return `${done}${u} — لم يُستحقّ شيء بعد`;
  return `${done} من ${due}${u} (${Math.min(100, Math.round((done / due) * 100))}%)`;
}

/**
 * صفوف المؤشرات كما تُعرض في التقرير وطباعته: المنجز مع مستحقه في سطرٍ واحد.
 * وحقلٌ لم تحمله اللقطة لا يُعرض سطراً فارغاً.
 */
export function snapshotRows(s: Snapshot): { label: string; value: string }[] {
  const rows: { label: string; value: string | null }[] = [
    { label: "الأسبوع", value: String(s.week) },
    { label: "عدد المشاركين", value: String(s.participants) },
    { label: "نسبة الإنجاز من المستحق", value: s.completionPct != null ? `${s.completionPct}%` : null },
    { label: "متوسط الدرجة المرحلية (من المستحق)", value: s.interimAvg != null ? `${s.interimAvg} من 100` : null },
    { label: "متوسط الحضور", value: `${s.attendanceAvg}%` },
    { label: s.tasksDue != null ? "المهام المسلّمة من المستحقة" : "المهام المسلّمة", value: ofDue(s.tasksSubmitted, s.tasksDue) },
    { label: "المهام المقيّمة", value: String(s.tasksGraded) },
    // اللقطة القديمة كانت تقيس التقارير المتوقعة بأسابيع مضت — وهي مستحقٌّ تقريبي
    { label: "التقارير المسلّمة من المستحقة", value: ofDue(s.reportsSubmitted, s.reportsExpected) },
    { label: s.readingDue != null ? "صفحات الورد من المستحقة" : "صفحات الورد المقروءة", value: s.readingPages != null ? ofDue(s.readingPages, s.readingDue, "صفحة") : null },
    { label: "بطاقات القراءة", value: String(s.readingCards) },
    { label: s.fieldDue != null ? "ساعات المعايشة المعتمدة من المستحقة" : "ساعات المعايشة المعتمدة", value: ofDue(s.fieldHours, s.fieldDue, "ساعة") },
    { label: "الاختبارات المؤدّاة من المستحقة", value: s.quizzesDone != null ? ofDue(s.quizzesDone, s.quizzesDue) : null },
    { label: "متوسط الاختبارات", value: `${s.quizAvg}%` },
    { label: "الأنشطة القيادية", value: String(s.leadership) },
    { label: "مشاريع معتمدة", value: String(s.projectsApproved) },
    { label: "موقّعو الميثاق", value: String(s.charterSigned) },
    { label: "متوسط الدرجات (تراكمي من 100)", value: s.gradeAvg != null ? String(s.gradeAvg) : null },
  ];
  return rows.filter((r): r is { label: string; value: string } => r.value != null);
}
