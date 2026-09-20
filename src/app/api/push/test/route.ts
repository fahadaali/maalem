import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { deliverNow, notifyUsers } from "@/lib/notify";

export async function POST() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await notifyUsers([user.id], { title: "معالم التربية", body: "الإشعارات تعمل على هذا الجهاز بنجاح.", url: "/app/notifications" }, { email: "never" });
  /**
   * وحدَه يُسلَّم في الطلب لا في الطابور: تجربةٌ تقول «سيصلك خلال دقائق» لا
   * تُجرِّب شيئاً. وكلفتُه محدودة بأجهزة صاحبه وحده.
   */
  const r = await deliverNow(user.id);
  return NextResponse.json({ pushed: r.pushed });
}
