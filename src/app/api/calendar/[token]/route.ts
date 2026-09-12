import { db } from "@/lib/db";
import { buildCalendar } from "@/lib/ics";

/**
 * تقويم مواعيد البرنامج بصيغة iCalendar، يُشترك به من تطبيق التقويم في الجوال.
 * الرابط يحمل مفتاحاً خاصاً بالمشارك، ولا يكشف إلا مواعيده هو.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const clean = token.replace(/\.ics$/i, "");
  if (!clean || clean.length < 16) return new Response("not found", { status: 404 });

  const user = await db.user.findFirst({ where: { calendarToken: clean, active: true }, select: { id: true, cohortId: true } });
  if (!user) return new Response("not found", { status: 404 });

  const appUrl = process.env.APP_URL || new URL(_req.url).origin;
  const body = await buildCalendar(user.id, user.cohortId, appUrl.replace(/\/$/, ""));
  return new Response(body, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'inline; filename="maalem.ics"',
      "cache-control": "private, max-age=3600",
    },
  });
}
