import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Card, Empty } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import { addReflection, deleteReflection } from "../actions";
import { formatShort, dayName } from "@/lib/dates";
import { Trash2 } from "lucide-react";

export const metadata = { title: "دفتر التأمل" };

export default async function ReflectionPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const user = await requireRole("PARTICIPANT", "ADMIN");
  const { ok, err } = await searchParams;
  const items = await db.reflection.findMany({ where: { userId: user.id }, orderBy: { date: "desc" } });
  return (
    <>
      <PageHeader title="دفتر التأمل" subtitle="كل جمعة: 20 دقيقة تأمل ذاتي وسطر في الدفتر، وتحديث خطة التعلم. يُجمع منها تقرير التأمل الذاتي الختامي." />
      <FormMessage ok={ok} err={err} />
      <Card>
        <form action={addReflection}>
          <div className="field">
            <label className="label">تأمل هذا الأسبوع</label>
            <textarea name="text" className="textarea" required placeholder="ما الذي تغيّر فيّ هذا الأسبوع؟ ما الذي سأفعله بشكل مختلف؟" />
          </div>
          <SubmitButton>حفظ</SubmitButton>
        </form>
      </Card>
      <div className="mt-6 space-y-2">
        {items.length === 0 ? <Empty>الدفتر فارغ بعد.</Empty> : items.map((r) => (
          <div key={r.id} className="card flex gap-3 items-start">
            <div className="flex-1">
              <div className="text-xs text-muted">{dayName(r.date)} · {formatShort(r.date)}</div>
              <div className="text-sm mt-1 whitespace-pre-wrap">{r.text}</div>
            </div>
            <form action={deleteReflection}>
              <input type="hidden" name="id" value={r.id} />
              <button className="btn btn-ghost btn-sm" aria-label="حذف"><Trash2 size={14} /></button>
            </form>
          </div>
        ))}
      </div>
    </>
  );
}
