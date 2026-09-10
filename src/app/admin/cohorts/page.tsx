import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Card, Badge, Empty } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import { activateCohort, closeCohort, createCohort } from "../actions";
import { formatGregorian, formatHijri, keyToDate } from "@/lib/dates";

export const metadata = { title: "الدفعات" };

export default async function CohortsPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireRole("ADMIN");
  const { ok, err } = await searchParams;
  const cohorts = await db.cohort.findMany({
    orderBy: { startDate: "desc" },
    include: { _count: { select: { users: true, assignments: true, quizzes: true, weeks: true } } },
  });

  return (
    <>
      <PageHeader
        title="الدفعات"
        subtitle="لكل دفعة مشاركوها وجدولها ومهامها واختباراتها وميزانيتها وتقاريرها، لا تختلط بغيرها. المنصة تعمل على الدفعة النشطة."
      />
      <FormMessage ok={ok} err={err} />
      <div className="grid md:grid-cols-[1fr_340px] gap-4 items-start">
        <div className="space-y-3">
          {cohorts.length === 0 ? (
            <Empty>لا دفعات بعد.</Empty>
          ) : (
            cohorts.map((c) => (
              <Card key={c.id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-muted">
                      اللقاء الافتتاحي {formatHijri(keyToDate(c.startDate))} — {formatGregorian(keyToDate(c.startDate))}
                    </div>
                    <div className="text-xs text-muted mt-1">
                      {c._count.users} مستخدماً · {c._count.weeks} أسبوعاً · {c._count.assignments} مهمة · {c._count.quizzes} اختباراً
                    </div>
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {c.active && <Badge tone="ink">نشطة</Badge>}
                    {c.closedAt && <Badge>مغلقة</Badge>}
                  </div>
                </div>
                <div className="flex gap-2 mt-3 flex-wrap">
                  {!c.active && (
                    <form action={activateCohort}>
                      <input type="hidden" name="id" value={c.id} />
                      <SubmitButton className="btn-sm">تفعيل هذه الدفعة</SubmitButton>
                    </form>
                  )}
                  <form action={closeCohort}>
                    <input type="hidden" name="id" value={c.id} />
                    <SubmitButton secondary className="btn-sm">{c.closedAt ? "إعادة فتح" : "إغلاق الدفعة"}</SubmitButton>
                  </form>
                </div>
              </Card>
            ))
          )}
        </div>
        <Card title="دفعة جديدة">
          <form action={createCohort}>
            <div className="field">
              <label className="label">اسم الدفعة</label>
              <input name="name" className="input" required placeholder="الدفعة الثالثة — الفصل الدراسي الثاني 1448هـ" />
            </div>
            <div className="field">
              <label className="label">تاريخ اللقاء الافتتاحي (السبت)</label>
              <input type="date" name="startDate" className="input" required />
            </div>
            <SubmitButton>إنشاء الدفعة</SubmitButton>
          </form>
          <p className="text-xs text-muted mt-3">
            تُنشأ أسابيع الجدول الأربعة عشر بمواعيد محسوبة من تاريخ اللقاء الافتتاحي، وبنود الميزانية من الخطة.
            المكتبة والمواد مشتركة بين الدفعات، فلا تُكرَّر.
          </p>
        </Card>
      </div>
    </>
  );
}
