import type { PrismaClient } from "@prisma/client";
import { PrismaD1 } from "@prisma/adapter-d1";
import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * عميل Prisma:
 * - على Cloudflare Workers: عميل WASM متصل بقاعدة D1 عبر الرابط DB.
 * - محلياً (next dev / next start): العميل الاعتيادي متصل بـ SQLite من DATABASE_URL.
 */
const isWorkers = typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";

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

function getDb(): PrismaClient {
  return isWorkers ? workersClient() : localClient();
}

/** وكيل كسول يحل العميل المناسب عند أول استخدام في كل طلب */
export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_t, prop) {
    const client = getDb() as unknown as Record<string | symbol, unknown>;
    const v = client[prop];
    return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(client) : v;
  },
});
