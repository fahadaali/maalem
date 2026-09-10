import { PageHeader, Card } from "@/components/ui";
import { PARTICIPANT_ROUTINE, PORTFOLIO_NOTE, READING_NOTE } from "@/lib/program";
import { getBooks, getCharter } from "@/lib/content";

export const metadata = { title: "خطة المشارك" };

export default async function ParticipantPlanPage() {
  const [books, charter] = await Promise.all([getBooks(), getCharter()]);
  return (
    <>
      <PageHeader eyebrow="خامساً" title="خطة المشارك" />
      <Card title="التزامات المشارك (ميثاق المشاركة)">
        <ol className="list-decimal ps-5 space-y-2 text-sm">
          {charter.map((c) => <li key={c}>{c}</li>)}
        </ol>
      </Card>
      <Card title="الروتين الأسبوعي للمشارك" className="mt-6">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>اليوم</th><th>النشاط</th><th>الزمن</th><th>المخرج</th></tr></thead>
            <tbody>
              {PARTICIPANT_ROUTINE.map((r) => (
                <tr key={r.day}><td className="font-medium">{r.day}</td><td>{r.activity}</td><td>{r.time}</td><td>{r.output}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title="خطة الورد القرائي (تفصيل الكتب)" className="mt-6">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>#</th><th>الكتاب</th><th>المؤلف</th><th>الصفحات</th><th>الأسابيع</th><th>حلقة النقاش</th><th>التوفر</th></tr></thead>
            <tbody>
              {books.map((b) => (
                <tr key={b.order}><td>{b.order}</td><td className="font-medium">{b.title}</td><td>{b.author}</td><td>{b.pages || "بحسب المشروع"}</td><td>{b.weeks}</td><td>{b.circle}</td><td>{b.availability}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-muted mt-3">{READING_NOTE}</p>
      </Card>
      <Card title="ملف الإنجاز" className="mt-6">
        <p className="text-sm">{PORTFOLIO_NOTE}</p>
      </Card>
    </>
  );
}
