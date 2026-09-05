import type { PrismaClient } from "@prisma/client";
import { WEEKS } from "./program";

const DAY = 24 * 60 * 60 * 1000;
const start = new Date("2026-09-12T00:00:00+03:00");

/** يبذر بيانات البرنامج الأساسية (المهام الأسبوعية والاختبارات) إن لم تكن موجودة */
export async function seedProgramData(db: PrismaClient) {
  if ((await db.assignment.count()) === 0) {
    for (const w of WEEKS.filter((x) => x.number >= 0 && x.number <= 12)) {
      const due = new Date(start.getTime() + w.number * 7 * DAY + (w.number === 0 ? 3 * DAY + 22 * 3600 * 1000 : 5 * DAY + 22 * 3600 * 1000));
      await db.assignment.create({
        data: {
          week: w.number,
          title: w.task,
          competency: w.competency,
          description: `المهمة الأسبوعية للأسبوع ${w.label}.\nاللقاء الحضوري: ${w.session}\nحلقة النقاش: ${w.circle}\nالورد القرائي: ${w.reading}`,
          dueAt: due,
        },
      });
    }
  }
  if ((await db.quiz.count()) === 0) {
    for (let i = 1; i <= 6; i++) await db.quiz.create({ data: { title: `اختبار فقهي ${i}`, kind: "FIQH", week: i, passMark: 70 } });
    for (const i of [2, 4, 6, 8]) await db.quiz.create({ data: { title: `اختبار المحفوظ ${i / 2}`, kind: "QURAN", week: i, passMark: 70 } });
  }
}
