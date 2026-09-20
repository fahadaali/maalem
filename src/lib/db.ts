import type { PrismaClient } from "@prisma/client";
import { PrismaD1 } from "@prisma/adapter-d1";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { log, logError, frames, reason } from "./log";

/**
 * عميل Prisma:
 * - على Cloudflare Workers: عميل WASM متصل بقاعدة D1 عبر الرابط DB.
 * - محلياً (next dev / next start): العميل الاعتيادي متصل بـ SQLite من DATABASE_URL.
 */
/** أعلى Workers أم Node؟ يُصدَّر لأن سقف الطلبات الفرعية قيدٌ هناك وحده */
export const isWorkers = typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";

const g = globalThis as unknown as { prisma?: PrismaClient; prismaD1?: WeakMap<object, PrismaClient> };

function localClient(): PrismaClient {
  if (!g.prisma) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaClient: Client } = require("@prisma/client") as typeof import("@prisma/client");
    g.prisma = new Client({ log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"] });
  }
  return g.prisma;
}

function workersClient(): PrismaClient {
  const d1 = getCloudflareContext().env.DB;
  g.prismaD1 ??= new WeakMap();
  let client = g.prismaD1.get(d1);
  if (!client) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaClient: Client } = require("@prisma/client/wasm") as typeof import("@prisma/client");
    client = new Client({ adapter: new PrismaD1(d1) });
    g.prismaD1.set(d1, client);
  }
  return client;
}

/**
 * القاعدة غير متاحة في هذا السياق. خطأٌ مسمّى كي يميّزه الحارس عن خطأ استعلام:
 * الأول يعني «ارسم الصفحة منقوصةً»، والثاني خللٌ في البيانات لا يُبتلع.
 */
export class DbUnavailableError extends Error {
  constructor(cause: string) {
    super(`db unavailable: ${cause}`);
    this.name = "DbUnavailableError";
  }
}

function getDb(): PrismaClient {
  try {
    return isWorkers ? workersClient() : localClient();
  } catch (e) {
    /**
     * `getCloudflareContext()` يرمي خارج سياق الطلب. ولا يقع ذلك إلا من استمرارٍ
     * عاش بعد طلبه — وعدٌ عبر الطلبات، أو `waitUntil` بلا انتظار — فالكومةُ هي
     * الدليل الوحيد على موضعه، ولذا تُسجَّل.
     */
    logError("db.no-context", { reason: reason(e), frames: frames(e) });
    throw new DbUnavailableError(reason(e));
  }
}

/** وكيل كسول يحل العميل المناسب عند أول استخدام في كل طلب */
export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_t, prop) {
    /**
     * `await db` يسأل عن `then`، و`String(db)` عن `Symbol.toStringTag` — ولا
     * يريد أيٌّ منهما عميلاً. فيُردّان `undefined` بلا إنشاء، وإلا رمى فحصٌ
     * عابرٌ في سياقٍ لا قاعدة فيه.
     */
    if (prop === "then" || prop === Symbol.toStringTag) return undefined;
    const client = getDb() as unknown as Record<string | symbol, unknown>;
    const v = client[prop];
    return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(client) : v;
  },
});

/**
 * قراءةٌ زينة: تُردّ قيمتها البديلة إن تعذّرت، ويُسجَّل السبب.
 *
 * لِما يَحسُن غيابُه ولا يحسُن أن يُسقط الصفحة — شارةُ إشعارات، عدّادُ جانب —
 * حين يكون جدولٌ لم يُرحَّل بعد، أو سياقٌ لا قاعدة فيه. ولا يُستعمل لقراءةٍ
 * يعتمد عليها المعروض، فإخفاءُ الخطأ هناك يُري المستخدمَ بياناتٍ ناقصةً صامتة.
 *
 * و`try/catch` لا `.catch()`: وكيلُ `db` يرمي عند الوصول إلى الخاصية نفسها
 * (`db.notification`) قبل أن يُستدعى التابع، فلا معالجَ رفضٍ يُركَّب أصلاً.
 * ولذلك يُمرَّر النداء دالّةً لا وعداً.
 */
export async function optional<T>(read: () => Promise<T>, fallback: T, evt = "db.optional"): Promise<T> {
  try {
    return await read();
  } catch (e) {
    log(evt, { reason: reason(e) });
    return fallback;
  }
}
