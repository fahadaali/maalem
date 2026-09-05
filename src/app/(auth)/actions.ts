"use server";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSession, destroySession, requireUser, type Role } from "@/lib/auth";
import { safeDestination } from "@/lib/roles";
import { str } from "@/lib/utils";

export async function login(formData: FormData) {
  const username = str(formData.get("username")).toLowerCase();
  const password = str(formData.get("password"));
  const next = str(formData.get("next"));
  if (!username || !password) redirect("/login?err=" + encodeURIComponent("أدخل اسم المستخدم وكلمة المرور"));
  const user = await db.user.findUnique({ where: { username } });
  if (!user || !user.active || !(await bcrypt.compare(password, user.passwordHash))) {
    redirect("/login?err=" + encodeURIComponent("بيانات الدخول غير صحيحة"));
  }
  await createSession({ id: user.id, username: user.username, name: user.name, role: user.role as Role });
  redirect(safeDestination(user.role, next));
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

export async function changePassword(formData: FormData) {
  const user = await requireUser();
  const current = str(formData.get("current"));
  const next = str(formData.get("next"));
  const confirm = str(formData.get("confirm"));
  const back = str(formData.get("back")) || "/app/settings";
  if (next.length < 6) redirect(back + "?err=" + encodeURIComponent("كلمة المرور الجديدة يجب أن تكون 6 أحرف فأكثر"));
  if (next !== confirm) redirect(back + "?err=" + encodeURIComponent("كلمتا المرور غير متطابقتين"));
  const row = await db.user.findUnique({ where: { id: user.id } });
  if (!row || !(await bcrypt.compare(current, row.passwordHash))) redirect(back + "?err=" + encodeURIComponent("كلمة المرور الحالية غير صحيحة"));
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(next, 10) } });
  redirect(back + "?ok=" + encodeURIComponent("تم تغيير كلمة المرور"));
}
