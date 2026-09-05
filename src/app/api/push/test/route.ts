import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { notifyUsers } from "@/lib/notify";

export async function POST() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const r = await notifyUsers([user.id], { title: "معالم التربية", body: "الإشعارات تعمل على هذا الجهاز بنجاح.", url: "/app/notifications" });
  return NextResponse.json(r);
}
