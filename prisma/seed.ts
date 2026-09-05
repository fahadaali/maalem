import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { WEEKS } from "../src/lib/program";

const db = new PrismaClient();
const DAY = 24 * 60 * 60 * 1000;
const start = new Date("2026-09-12T00:00:00+03:00");

async function main() {
  // مدير المشروع
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "Admin@1448";
  await db.user.upsert({
    where: { username: "admin" },
    update: {},
    create: { username: "admin", name: "مدير المشروع", role: "ADMIN", passwordHash: await bcrypt.hash(adminPassword, 10) },
  });

  // المهام الأسبوعية من الجدول الزمني (الافتتاحي → الأسبوع 12)، موعد التسليم الخميس 22:00
  const count = await db.assignment.count();
  if (count === 0) {
    for (const w of WEEKS.filter((x) => x.number >= 0 && x.number <= 12)) {
      const due = new Date(start.getTime() + w.number * 7 * DAY + (w.number === 0 ? 3 * DAY : 5 * DAY + 22 * 3600 * 1000));
      await db.assignment.create({
        data: {
          week: w.number,
          title: w.task,
          competency: w.competency,
          description: `المهمة الأسبوعية للأسبوع ${w.label}.\nاللقاء الحضوري: ${w.session}\nحلقة النقاش: ${w.circle}\nالورد القرائي: ${w.reading}`,
          dueAt: w.number === 0 ? new Date(due.setHours(22, 0, 0, 0)) : due,
        },
      });
    }
  }

  // اختبارات فقهية (مسودات) للأسابيع 1–6 يُضيف مدير المشروع أسئلتها ثم ينشرها
  const quizCount = await db.quiz.count();
  if (quizCount === 0) {
    for (let i = 1; i <= 6; i++) await db.quiz.create({ data: { title: `اختبار فقهي ${i}`, kind: "FIQH", week: i, passMark: 70 } });
    for (const i of [2, 4, 6, 8]) await db.quiz.create({ data: { title: `اختبار المحفوظ ${i / 2}`, kind: "QURAN", week: i, passMark: 70 } });
  }

  // بيانات تجريبية اختيارية
  if (process.env.SEED_DEMO === "1") {
    const mentor = await db.user.upsert({
      where: { username: "mentor" },
      update: {},
      create: { username: "mentor", name: "المشرف المرافق", role: "MENTOR", passwordHash: await bcrypt.hash("123456", 10) },
    });
    const names = ["عبدالله محمد", "سعد أحمد", "فهد خالد"];
    for (let i = 0; i < names.length; i++) {
      await db.user.upsert({
        where: { username: `p${i + 1}` },
        update: {},
        create: { username: `p${i + 1}`, name: names[i], role: "PARTICIPANT", mentorId: mentor.id, passwordHash: await bcrypt.hash("123456", 10) },
      });
    }
  }

  console.log("Seed done. admin / " + adminPassword);
}

main().finally(() => db.$disconnect());
