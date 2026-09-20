import { db } from "./db";
import { cohortWhere } from "./cohort";
import type { LiveWeek } from "./weeks";

/** حالات إنجاز المهمة، كما تُعرض للمشارك وللمراجع */
export const TASK_STATUS = { DONE: "أُنجزت", PARTIAL: "أُنجزت جزئياً", NOT_DONE: "لم تُنجز" } as const;

export type TaskStatus = keyof typeof TASK_STATUS;

export function isTaskStatus(v: string): v is TaskStatus {
  return Object.prototype.hasOwnProperty.call(TASK_STATUS, v);
}

/** اسم الحالة عربياً، وقيمتها الخام إن جاءت من صفٍّ قديم لا يعرفها الجدول */
export function taskStatusLabel(v: string): string {
  return isTaskStatus(v) ? TASK_STATUS[v] : v;
}

/** «—» في جدول البرنامج تعني «لا شيء هنا» لا نصّاً يُقرأ، كما تقرؤها بطاقة الأسبوع */
const filled = (v: string | null | undefined): boolean => !!v && v.trim() !== "" && v.trim() !== "—";

/** يشقّ نصّ المهمة الواحد إلى مهامه: كان يُكتب «مهمة + مهمة» في حقل واحد */
export function splitTasks(text: string): string[] {
  return filled(text) ? text.split(/\s+\+\s+/).map((s) => s.trim()).filter(Boolean) : [];
}

/** أقسام التقرير التي يطلبها الأسبوع */
export type ReportSections = {
  tasks: boolean;
  /** الورد المنجز وأبرز الفوائد معاً: كلاهما فرعٌ عن وردٍ مقروء */
  reading: boolean;
  field: boolean;
  quiz: boolean;
  /** تطبيقٌ في الميدان وصعوبةٌ تحتاج دعماً */
  reflect: boolean;
};

/**
 * ما يطلبه الأسبوع من تقريره، في موضعٍ واحد: النموذج يرسم منه، والمراجع يعرض منه،
 * والحفظ يتحقق منه. ولولا وحدته لطالب الخادمُ بحقلٍ لم يُرسم للمشارك أصلاً.
 */
export function reportSections(
  week: Pick<LiveWeek, "number" | "reading" | "field" | "session">,
  opts: { quizWeeks: ReadonlySet<number>; taskCount: number },
): ReportSections {
  const reading = filled(week.reading);
  return {
    tasks: opts.taskCount > 0,
    reading,
    field: filled(week.field),
    quiz: opts.quizWeeks.has(week.number),
    // التأمل فرعٌ عن لقاءٍ أو وردٍ: أسبوعٌ بلا واحدٍ منهما لا يُسأل عن تطبيقٍ ولا صعوبة
    reflect: reading || filled(week.session),
  };
}

/** أسابيع الدفعة التي لها اختبار منشور — ما عداها لا يُسأل عن نتيجة اختبار */
export async function publishedQuizWeeks(): Promise<Set<number>> {
  const rows = await db.quiz.findMany({
    where: { published: true, week: { not: null }, ...(await cohortWhere()) },
    select: { week: true },
  });
  return new Set(rows.map((r) => r.week!));
}

/**
 * صفوف التقرير الحرّة كما تُعرض للمراجع. كانت مكرّرة في لوحة المدير ولوحة المرشد،
 * فتفترقان كلما زيد حقلٌ في إحداهما. المهام ليست منها: لها عرضها الخاص.
 */
export const REPORT_ROWS = [
  ["الورد القرائي المنجز", "reading"],
  ["أبرز الفوائد", "benefits"],
  ["المعايشة الميدانية", "fieldNote"],
  ["نتيجة الاختبار", "quizResult"],
  ["تطبيق في الميدان", "application"],
  ["صعوبة تحتاج دعماً", "difficulty"],
] as const;
