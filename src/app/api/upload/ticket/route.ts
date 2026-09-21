import { NextResponse } from "next/server";
import { getAuthSecret } from "@/lib/secrets";
import { authorizeUpload } from "@/lib/upload-server";
import { signTicket } from "@/lib/upload-ticket";

/**
 * الخطوة الأولى من الرفع: وصفُ الملف — لا بايتاته — يُستوثق ويُتحقّق منه هنا،
 * فتعود تذكرةٌ موقّعة يحملها العميل إلى ‎/api/upload/stream.
 *
 * وجسمُ هذا الطلب سطورٌ من JSON، فتجميعُه في الذاكرة لا يكلّف شيئاً — والملفُ
 * وحده هو الذي لا يمرّ من هنا.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Partial<Record<"name" | "size" | "contentType" | "kind" | "refId", unknown>> | null;
  if (!body) return NextResponse.json({ error: "طلب غير صحيح" }, { status: 400 });

  const name = String(body.name ?? "").slice(0, 200);
  const size = Number(body.size);
  const contentType = String(body.contentType || "application/octet-stream");
  const kind = String(body.kind ?? "OTHER");
  const refId = body.refId ? String(body.refId) : null;

  const verdict = await authorizeUpload({ name, size, contentType, kind, refId });
  if (!verdict.ok) return NextResponse.json({ error: verdict.error }, { status: verdict.status });

  const ticket = await signTicket(await getAuthSecret(), {
    key: verdict.key,
    userId: verdict.user.id,
    kind,
    refId,
    name,
    size,
    contentType,
  });
  return NextResponse.json({ ticket });
}
