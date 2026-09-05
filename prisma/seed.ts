import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { seedProgramData } from "../src/lib/seed";

const db = new PrismaClient();

async function main() {
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "Admin@1448";
  await db.user.upsert({
    where: { username: "admin" },
    update: {},
    create: { username: "admin", name: "مدير المشروع", role: "ADMIN", passwordHash: await bcrypt.hash(adminPassword, 10) },
  });
  await seedProgramData(db);

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
