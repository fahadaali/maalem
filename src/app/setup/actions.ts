"use server";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { seedProgramData } from "@/lib/seed";
import { applyMigrations, needsSetup, schemaReady } from "@/lib/setup";
import { ensureAllSecrets } from "@/lib/secrets";
import { str } from "@/lib/utils";

export async function runSetup(formData: FormData) {
  if (!(await needsSetup())) redirect("/login");
  const name = str(formData.get("name")) || "مدير المشروع";
  const username = str(formData.get("username")).toLowerCase();
  const password = str(formData.get("password"));
  const confirm = str(formData.get("confirm"));
  const back = (msg: string) => redirect("/setup?err=" + encodeURIComponent(msg));
  if (!/^[a-z0-9_.-]{3,30}$/.test(username)) back("اسم المستخدم: أحرف إنجليزية صغيرة وأرقام فقط (3–30)");
  if (password.length < 8) back("كلمة المرور 8 أحرف فأكثر");
  if (password !== confirm) back("كلمتا المرور غير متطابقتين");

  if (!(await schemaReady())) {
    try {
      await applyMigrations();
    } catch (e) {
      back(`تعذّر إنشاء الجداول: ${(e as Error).message.slice(0, 300)}`);
    }
  }
  if ((await db.user.count()) > 0) redirect("/login");
  const user = await db.user.create({ data: { username, name, role: "ADMIN", passwordHash: await bcrypt.hash(password, 10) } });
  await seedProgramData(db);
  await ensureAllSecrets();
  await createSession({ id: user.id, username: user.username, name: user.name, role: "ADMIN" });
  redirect("/admin?ok=" + encodeURIComponent("تم إعداد المنصة وإنشاء حساب مدير المشروع"));
}
