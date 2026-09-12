import type { PrismaClient } from "@prisma/client";
import { COMPETENCIES, PROGRAM, WEEKS } from "./program";

const DAY = 24 * 60 * 60 * 1000;

/**
 * اسم الكفاءة المطابق لتصنيف الأسبوع في الخطة («التربوية / الشرعية» مثلاً)،
 * فتُنسب المهمة المبذورة إلى كفاءة بعينها كما تُنسب المهام المنشأة من اللوحة.
 */
function competencyNameFor(label: string): string | null {
  const first = label.split("/")[0].trim();
  if (!first || first === "تهيئة" || first === "التقويم") return null;
  return COMPETENCIES.find((c) => c.name.includes(first))?.name ?? null;
}

/**
 * يبذر بيانات البرنامج الأساسية (المهام الأسبوعية والاختبارات) إن لم تكن موجودة،
 * منسوبةً إلى الدفعة النشطة — فبلا دفعة كانت تبقى خارج كل الاستعلامات المصفّاة
 * بالدفعة فلا تظهر لأحد — وبمواعيد تُحسب من تاريخ انطلاق الدفعة لا من تاريخ ثابت.
 */
export async function seedProgramData(db: PrismaClient) {
  let cohort = await db.cohort.findFirst({ where: { active: true } });
  if (!cohort) cohort = await db.cohort.create({ data: { name: PROGRAM.cohort, startDate: PROGRAM.startDate, active: true } });
  const cohortId = cohort.id;
  const start = new Date(`${cohort.startDate}T00:00:00+03:00`);
  if ((await db.assignment.count({ where: { cohortId } })) === 0) {
    await db.assignment.createMany({
      data: WEEKS.filter((x) => x.number >= 0 && x.number <= 12).map((w) => ({
        cohortId,
        week: w.number,
        title: w.task,
        competency: competencyNameFor(w.competency),
        description: `المهمة الأسبوعية للأسبوع ${w.label}.\nاللقاء الحضوري: ${w.session}\nحلقة النقاش: ${w.circle}\nالورد القرائي: ${w.reading}`,
        dueAt: new Date(start.getTime() + w.number * 7 * DAY + (w.number === 0 ? 3 * DAY + 22 * 3600 * 1000 : 5 * DAY + 22 * 3600 * 1000)),
      })),
    });
  }
  if ((await db.quiz.count({ where: { cohortId } })) === 0) {
    await db.quiz.createMany({
      data: [
        ...Array.from({ length: 6 }, (_, i) => ({ cohortId, title: `اختبار فقهي ${i + 1}`, kind: "FIQH", week: i + 1, passMark: 70 })),
        ...[2, 4, 6, 8].map((i) => ({ cohortId, title: `اختبار المحفوظ ${i / 2}`, kind: "QURAN", week: i, passMark: 70 })),
      ],
    });
  }
}
