import { requireParticipantView } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Card, Empty, Progress } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import { addReadingCard, deleteReadingCard } from "../actions";
import { READING_NOTE } from "@/lib/program";
import { getBookTitles, bookProgress } from "@/lib/content";
import { dayName, formatShort, todayKey } from "@/lib/dates";
import { currentWeek } from "@/lib/weeks";
import { Trash2 } from "lucide-react";

export const metadata = { title: "بطاقة القراءة اليومية" };

export default async function ReadingPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const bookTitles = await getBookTitles();
  const user = await requireParticipantView();
  const { ok, err } = await searchParams;
  const cards = await db.readingCard.findMany({ where: { userId: user.id }, orderBy: { date: "desc" }, take: 60 });
  const total = await db.readingCard.count({ where: { userId: user.id } });
  const week = await currentWeek();
  const progress = await bookProgress(user.id);
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
      <Card title="تقدّمي في الكتب" className="mb-4">
        <p className="text-xs text-muted mb-3">النسبة من أبعد صفحة سجّلتها في بطاقاتك، لا من عدد البطاقات.</p>
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
          {progress.filter((b) => b.pages > 0).map((b) => (
            <div key={b.title}>
              <div className="flex justify-between text-xs mb-1 gap-2">
                <span className="truncate">{b.title}</span>
                <span className="text-muted tabular-nums shrink-0">{b.furthestPage} / {b.pages} صفحة</span>
              </div>
              <div className="progress"><span style={{ width: `${b.percent}%` }} /></div>
              <div className="text-xs text-muted mt-1">
                {b.cards ? `${b.cards} بطاقة · آخرها ${formatShort(b.lastDate!)}` : "لم تبدأ بعد"}
                {b.circle !== "—" ? ` · حلقته ${b.circle}` : ""}
              </div>
            </div>
          ))}
          {progress.filter((b) => b.pages > 0).length === 0 && <p className="text-sm text-muted">لا كتب مسجّلة بصفحاتها.</p>}
        </div>
      </Card>
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
                <select name="book" className="select" defaultValue={last?.book && bookTitles.includes(last.book) ? last.book : bookTitles[0]}>
                  {bookTitles.map((b) => <option key={b} value={b}>{b}</option>)}
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
