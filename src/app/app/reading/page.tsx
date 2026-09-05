import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Card, Empty, Progress } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import { addReadingCard, deleteReadingCard } from "../actions";
import { BOOK_TITLES, READING_NOTE } from "@/lib/program";
import { currentWeek, dayName, formatShort, todayKey } from "@/lib/dates";
import { Trash2 } from "lucide-react";

export const metadata = { title: "بطاقة القراءة اليومية" };

export default async function ReadingPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const user = await requireRole("PARTICIPANT");
  const { ok, err } = await searchParams;
  const cards = await db.readingCard.findMany({ where: { userId: user.id }, orderBy: { date: "desc" }, take: 60 });
  const total = await db.readingCard.count({ where: { userId: user.id } });
  const week = currentWeek();
  const last = cards[0];

  return (
    <>
      <PageHeader title="بطاقة القراءة اليومية" subtitle="10 صفحات يومياً من الأحد إلى الخميس. سجّل بطاقة واحدة لكل يوم قراءة." />
      <FormMessage ok={ok} err={err} />
      {week && week.reading !== "—" && (
        <div className="card card-muted text-sm mb-4">
          <span className="text-muted">ورد هذا الأسبوع: </span>
          {week.reading}
        </div>
      )}
      <div className="grid md:grid-cols-[1fr_320px] gap-4 items-start">
        <Card title="بطاقة جديدة">
          <form action={addReadingCard}>
            <div className="grid grid-cols-2 gap-3">
              <div className="field">
                <label className="label">التاريخ</label>
                <input type="date" name="date" className="input" defaultValue={todayKey()} required />
              </div>
              <div className="field">
                <label className="label">الكتاب</label>
                <select name="book" className="select" defaultValue={last?.book && BOOK_TITLES.includes(last.book) ? last.book : BOOK_TITLES[0]}>
                  {BOOK_TITLES.map((b) => <option key={b} value={b}>{b}</option>)}
                  <option value="__other">كتاب آخر…</option>
                </select>
              </div>
            </div>
            <div className="field">
              <label className="label">اسم الكتاب (إن اخترت «كتاب آخر»)</label>
              <input name="bookOther" className="input" placeholder="مثال: مرجع مشروع التخرج" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="field">
                <label className="label">من صفحة</label>
                <input type="number" name="fromPage" className="input" min={1} defaultValue={last ? last.toPage + 1 : 1} required inputMode="numeric" />
              </div>
              <div className="field">
                <label className="label">إلى صفحة</label>
                <input type="number" name="toPage" className="input" min={1} defaultValue={last ? last.toPage + 10 : 10} required inputMode="numeric" />
              </div>
            </div>
            <div className="field">
              <label className="label">أهم فائدة</label>
              <textarea name="benefit" className="textarea" required placeholder="أبرز ما استفدته من قراءة اليوم" />
            </div>
            <div className="field">
              <label className="label">سؤال أطرحه في الحلقة (اختياري)</label>
              <input name="question" className="input" />
            </div>
            <SubmitButton>حفظ البطاقة</SubmitButton>
          </form>
        </Card>
        <div className="space-y-4">
          <Card title="تقدمك">
            <Progress label="بطاقات القراءة" value={total} max={60} />
            <div className="text-xs text-muted mt-2">{total} بطاقة من 60 (5 بطاقات × 12 أسبوعاً)</div>
          </Card>
          <div className="card card-muted text-xs text-muted">{READING_NOTE}</div>
        </div>
      </div>

      <h2 className="text-xl mt-8 mb-3">بطاقاتي</h2>
      {cards.length === 0 ? (
        <Empty>لا توجد بطاقات بعد. ابدأ بتسجيل قراءة اليوم.</Empty>
      ) : (
        <div className="space-y-2">
          {cards.map((c) => (
            <div key={c.id} className="card flex gap-3 items-start">
              <div className="flex-1 min-w-0">
                <div className="text-xs text-muted">{dayName(c.date)} · {formatShort(c.date)} · {c.book} · ص {c.fromPage}–{c.toPage}</div>
                <div className="text-sm mt-1">{c.benefit}</div>
                {c.question && <div className="text-sm text-muted mt-1">سؤال: {c.question}</div>}
              </div>
              <form action={deleteReadingCard}>
                <input type="hidden" name="id" value={c.id} />
                <button className="btn btn-ghost btn-sm" aria-label="حذف"><Trash2 size={14} /></button>
              </form>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
