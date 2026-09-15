import { promises as fs } from "fs";
import path from "path";
import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * تخزين المرفقات: على Cloudflare يُستخدم رابط R2 (FILES)،
 * ومحلياً بدون الرابط تُحفظ الملفات في مجلد .data/uploads.
 */
// الحدود والأنواع في وحدة مستقلة يستوردها المتصفح أيضاً، وتُعاد هنا فلا يتغيّر مستوردوها
export { MAX_FILE_BYTES, ALLOWED_TYPES } from "./files";

function r2(): R2Bucket | undefined {
  try {
    return getCloudflareContext().env.FILES;
  } catch {
    return undefined;
  }
}

const LOCAL_DIR = path.join(process.cwd(), ".data", "uploads");

export function safeKey(userId: string, name: string) {
  const ext = (name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8);
  const rand = crypto.randomUUID();
  return `${userId}/${Date.now()}-${rand}.${ext}`;
}

export async function putObject(key: string, body: ArrayBuffer, contentType: string) {
  const bucket = r2();
  if (bucket) {
    await bucket.put(key, body, { httpMetadata: { contentType } });
    return;
  }
  const file = path.join(LOCAL_DIR, key);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, Buffer.from(body));
}

export async function getObject(key: string): Promise<{ body: ReadableStream | Buffer; contentType?: string; size?: number } | null> {
  const bucket = r2();
  if (bucket) {
    const obj = await bucket.get(key);
    if (!obj) return null;
    return { body: obj.body, contentType: obj.httpMetadata?.contentType, size: obj.size };
  }
  try {
    const buf = await fs.readFile(path.join(LOCAL_DIR, key));
    return { body: buf, size: buf.length };
  } catch {
    return null;
  }
}

export async function deleteObject(key: string) {
  const bucket = r2();
  if (bucket) return bucket.delete(key);
  await fs.rm(path.join(LOCAL_DIR, key), { force: true });
}

export function storageBackend() {
  return r2() ? "R2" : "local";
}
