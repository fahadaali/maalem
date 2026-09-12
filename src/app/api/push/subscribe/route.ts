import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

function b64urlLength(s: string): number {
  try {
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
    return atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4)).length;
  } catch {
    return -1;
  }
}

/** اشتراك صالح: عنوان https ومفتاحان بالطولين اللذين يوجبهما بروتوكول الدفع، وإلا فُشل كل إرسال إليه بلا نهاية */
function validSubscription(body: { endpoint?: string; keys?: { p256dh?: string; auth?: string } }): boolean {
  if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) return false;
  try {
    if (new URL(body.endpoint).protocol !== "https:") return false;
  } catch {
    return false;
  }
  return body.endpoint.length <= 2000 && b64urlLength(body.keys.p256dh) === 65 && b64urlLength(body.keys.auth) === 16;
}

export async function POST(req: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!validSubscription(body)) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const endpoint = body.endpoint!;
  const p256dh = body.keys!.p256dh!;
  const auth = body.keys!.auth!;
  await db.pushSubscription.upsert({
    where: { endpoint },
    create: { userId: user.id, endpoint, p256dh, auth, userAgent: req.headers.get("user-agent") },
    update: { userId: user.id, p256dh, auth, userAgent: req.headers.get("user-agent") },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { endpoint?: string };
  if (body.endpoint) await db.pushSubscription.deleteMany({ where: { endpoint: body.endpoint, userId: user.id } });
  return NextResponse.json({ ok: true });
}
