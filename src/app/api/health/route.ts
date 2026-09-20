import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { MIGRATIONS } from "@/lib/schema-sql";
import { bootState } from "@/lib/setup";
import { isolateId, reason } from "@/lib/log";
import { peekCronSecret, secretMatches } from "@/lib/secrets";
import { db, isWorkers } from "@/lib/db";

/**
 * فحصُ صحةٍ لا يُطلق شيئاً: لا `ensureSchema()` ولا `getSession()`، فليس باباً
 * لعاصفة إقلاع ولا ثغرةَ إغراق.
 *
 *   GET /api/health              — سطحيٌّ: **صفر استعلامات**، يقرأ ذاكرة النسخة وحدها
 *   GET /api/health?key=<الكرون> — عميقٌ: **استعلامٌ خام واحد** يقارن المطبَّق بالمتوقَّع
 *
 * والعميقُ لا يمرّ بـPrisma على Workers عمداً: تحميلُ حزمة WASM لفحص صحةٍ
 * يجعل الفحص نفسه أثقل ما في النسخة.
 */
export const dynamic = "force-dynamic";

/** ما المرتبط بهذه النسخة؟ غيابُ ارتباطٍ عطلُ نشرٍ صامت، فيُقال صراحةً */
function bindings(): Record<string, boolean> | { error: string } {
  if (!isWorkers) return { local: true };
  try {
    const env = getCloudflareContext().env as unknown as Record<string, unknown>;
    return { DB: !!env.DB, FILES: !!env.FILES, ASSETS: !!env.ASSETS, APP_URL: !!env.APP_URL };
  } catch (e) {
    return { error: reason(e) };
  }
}

/** أسماء الترحيلات المسجَّلة، من الارتباط مباشرة حيث أمكن */
async function appliedNames(): Promise<string[]> {
  if (isWorkers) {
    const res = await getCloudflareContext().env.DB.prepare("SELECT name FROM d1_migrations ORDER BY name").all<{ name: string }>();
    return res.results.map((r) => r.name);
  }
  const rows = await db.$queryRawUnsafe<{ name: string }[]>("SELECT name FROM d1_migrations ORDER BY name");
  return rows.map((r) => r.name);
}

export async function GET(req: Request) {
  const shallow = { ...bootState(), isolate: isolateId(), bindings: bindings() };
  const key = new URL(req.url).searchParams.get("key") ?? req.headers.get("authorization")?.replace("Bearer ", "");
  if (!key) return NextResponse.json(shallow);

  // القراءةُ بالمفتاح وحدها تلمس القاعدة، والمفتاح يُقرأ بلا توليد
  if (!(await secretMatches(key, await peekCronSecret()))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const applied = new Set(await appliedNames());
    const expected = MIGRATIONS.map((m) => m.name);
    return NextResponse.json({
      ...shallow,
      db: "ok",
      applied: applied.size,
      expected: expected.length,
      missing: expected.filter((n) => !applied.has(n)),
    });
  } catch (e) {
    return NextResponse.json({ ...shallow, db: "unreachable", reason: reason(e) }, { status: 503 });
  }
}
