import { requireRole } from "@/lib/auth";
import { PageHeader, Card, Stat, Empty } from "@/components/ui";
import { ColumnChart, BarList } from "@/components/Chart";
import { buildTrends } from "@/lib/trends";
import PrintButton from "@/components/PrintButton";

export const metadata = { title: "اتجاهات البرنامج" };

export default async function TrendsPage() {
  await requireRole("ADMIN");
  const t = await buildTrends();

  if (!t.participants) {
    return (
      <>
        <PageHeader title="اتجاهات البرنامج" />
        <Empty>لا مشاركين في الدفعة النشطة بعد.</Empty>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="اتجاهات البرنامج"
        subtitle="قراءة أسبوعية لالتزام الدفعة: الحضور، والتقارير، والورد القرائي، والاختبارات. الأسبوع الجاري مُميَّز على المحور."
        actions={<PrintButton />}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Stat label="نسبة الحضور العامة" value={`${t.totals.attendance}%`} hint={`${t.participants} مشاركاً`} />
        <Stat label="تسليم التقارير" value={`${t.totals.reports}%`} hint="من المتوقع تسليمه" />
        <Stat label="الورد القرائي" value={`${t.totals.cards}%`} hint="من البطاقات المتوقعة" />
        <Stat label="ساعات المعايشة المعتمدة" value={t.totals.field} hint="ساعة" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="نسبة الحضور أسبوعياً">
          <ColumnChart data={t.attendance} max={100} target={80} targetLabel="المستهدف ٨٠٪" caption="مرِّر على العمود لتفصيل الأسبوع." />
        </Card>
        <Card title="تسليم التقرير الأسبوعي">
          <ColumnChart data={t.reports} max={100} caption="نسبة من سلّم تقريره من مجموع المشاركين، والمستهدف تسليم الجميع." />
        </Card>
        <Card title="التزام الورد القرائي">
          <ColumnChart data={t.cards} max={100} caption="البطاقات المسجَّلة نسبةً إلى خمس بطاقات لكل مشارك أسبوعياً." />
        </Card>
        <Card title="متوسط نتائج الاختبارات">
          <ColumnChart data={t.quizzes} max={100} target={70} targetLabel="حدّ النجاح ٧٠٪" caption="متوسط محاولات الأسبوع المصحَّحة." />
        </Card>
        <Card title="متوسط رصد المشاركة الفاعلة" className="lg:col-span-2">
          <ColumnChart data={t.participation} max={5} unit="" target={3} targetLabel="الحدّ المقبول ٣" caption="مقياس من ١ إلى ٥ من بطاقة رصد المشاركة." />
        </Card>
      </div>

      <Card title="التزام كل مشارك" className="mt-4">
        <p className="text-xs text-muted mb-3">الشريط يمثّل نسبة الحضور، وإلى جانبه عدد التقارير وبطاقات القراءة.</p>
        <BarList data={t.perParticipant} max={100} limit={10} />
      </Card>
    </>
  );
}
