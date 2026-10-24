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
        subtitle="قراءة أسبوعية لالتزام الدفعة: الحضور، والتقارير، والورد القرائي، والاختبارات — لما بدأ من الأسابيع وحده، والنسب من المستحق حتى الآن. الأسبوع الجاري مُميَّز على المحور."
        actions={<PrintButton />}
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <Stat label="الإنجاز من المستحق" value={t.totals.completion != null ? `${t.totals.completion}%` : "—"} hint={`متوسط ${t.participants} مشاركاً`} />
        <Stat label="نسبة الحضور العامة" value={`${t.totals.attendance}%`} hint="من الجلسات المرصودة" />
        <Stat label="تسليم التقارير" value={`${t.totals.reports}%`} hint="من التقارير المستحقة حتى الآن" />
        <Stat label="الورد القرائي" value={`${t.totals.cards}%`} hint="من الصفحات المستحقة حتى الآن" />
        <Stat label="ساعات المعايشة المعتمدة" value={t.totals.field} hint={`من ${t.totals.fieldDue} ساعة مستحقة`} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="نسبة الحضور أسبوعياً">
          <ColumnChart data={t.attendance} max={100} target={80} targetLabel="المستهدف ٨٠٪" caption="مرِّر على العمود لتفصيل الأسبوع." />
        </Card>
        <Card title="تسليم التقرير الأسبوعي">
          <ColumnChart data={t.reports} max={100} caption="نسبة من سلّم تقريره ممن يُطالَب به، والمستهدف تسليم الجميع. التقرير المُرجَع لا يُعدّ حتى يُعاد." />
        </Card>
        <Card title="التزام الورد القرائي">
          <ColumnChart data={t.cards} max={100} caption="صفحات بطاقات الأسبوع نسبةً إلى نصابه في الجدول لكل مُطالَبٍ به." />
        </Card>
        <Card title="متوسط نتائج الاختبارات">
          <ColumnChart data={t.quizzes} max={100} target={70} targetLabel="حدّ النجاح ٧٠٪" caption="متوسط محاولات الأسبوع المصحَّحة." />
        </Card>
        <Card title="متوسط رصد المشاركة الفاعلة" className="lg:col-span-2">
          <ColumnChart data={t.participation} max={5} unit="" target={3} targetLabel="الحدّ المقبول ٣" caption="مقياس من ١ إلى ٥ من بطاقة رصد المشاركة." />
        </Card>
      </div>

      <Card title="التزام كل مشارك" className="mt-4">
        <p className="text-xs text-muted mb-3">الشريط يمثّل نسبة الحضور، وإلى جانبه التقارير والورد من المستحق ونسبة الإنجاز. والترتيب بنسبة الإنجاز.</p>
        <BarList data={t.perParticipant} max={100} limit={10} />
      </Card>
    </>
  );
}
