import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Card, Alert } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import { saveBook, deleteBook, saveCharter, saveAssessment, saveLevels } from "../actions";
import { cohortWhere } from "@/lib/cohort";
import Link from "@/components/Link";

export const metadata = { title: "محتوى الوثيقة" };

export default async function ContentPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireRole("ADMIN");
  const { ok, err } = await searchParams;
  const where = await cohortWhere();
  const [books, charter, continuous, project, levels] = await Promise.all([
    db.programBook.findMany({ where, orderBy: { order: "asc" } }),
    db.charterItem.findMany({ where, orderBy: { order: "asc" } }),
    db.assessmentItem.findMany({ where: { kind: "CONTINUOUS", ...where }, orderBy: { order: "asc" } }),
    db.assessmentItem.findMany({ where: { kind: "PROJECT", ...where }, orderBy: { order: "asc" } }),
    db.completionLevel.findMany({ where, orderBy: { min: "desc" } }),
  ]);
  const contTotal = continuous.reduce((s, c) => s + c.points, 0);
  const projTotal = project.reduce((s, r) => s + r.points, 0);

  return (
    <>
      <PageHeader
        title="محتوى الوثيقة"
        subtitle="ما كان في خطة البرنامج نصاً ثابتاً صار هنا قابلاً للتحرير لكل دفعة: الكتب، وبنود الميثاق، وأوزان التقويم، ومستويات الإتمام."
        actions={<Link href="/admin/competencies" className="btn btn-secondary">مصفوفة الكفاءات</Link>}
      />
      <FormMessage ok={ok} err={err} />

      <Card title="أوزان التقويم" className="mb-4">
        <p className="text-sm text-muted mb-3">
          المكوّنات نفسها ثابتة لأن المنصة تقيسها آلياً من الحضور والبطاقات والاختبارات والمهام والمعايشة والدور القيادي؛
          والقابل للتحرير هو الدرجة والوصف وأداة القياس والحد الأدنى. أي تعديل هنا يُعاد به احتساب كشف الدرجات فوراً.
        </p>
        {contTotal + projTotal !== 100 && (
          <Alert tone="error">مجموع الدرجات {contTotal + projTotal} لا 100. راجع الأوزان، فمستويات الإتمام مبنية على مجموع 100.</Alert>
        )}
        <form action={saveAssessment}>
          <div className="table-wrap mb-3">
            <table className="table">
              <thead><tr><th>المكوّن</th><th>الدرجة</th><th>أداة القياس</th><th>الحد الأدنى</th></tr></thead>
              <tbody>
                {continuous.map((c) => (
                  <tr key={c.id}>
                    <td><input name={`label_${c.id}`} className="input" defaultValue={c.label} /></td>
                    <td className="w-24"><input name={`points_${c.id}`} type="number" min={0} max={100} className="input" dir="ltr" defaultValue={c.points} /></td>
                    <td><input name={`tool_${c.id}`} className="input" defaultValue={c.tool ?? ""} /></td>
                    <td><input name={`minimum_${c.id}`} className="input" defaultValue={c.minimum ?? ""} /></td>
                  </tr>
                ))}
                <tr><td className="font-bold">مجموع التقييم المستمر</td><td className="font-bold tabular-nums">{contTotal}</td><td colSpan={2} /></tr>
              </tbody>
            </table>
          </div>
          <div className="table-wrap mb-3">
            <table className="table">
              <thead><tr><th>معيار مشروع التخرج</th><th>الدرجة</th><th>الوصف</th></tr></thead>
              <tbody>
                {project.map((r) => (
                  <tr key={r.id}>
                    <td><input name={`label_${r.id}`} className="input" defaultValue={r.label} /></td>
                    <td className="w-24"><input name={`points_${r.id}`} type="number" min={0} max={100} className="input" dir="ltr" defaultValue={r.points} /></td>
                    <td><input name={`description_${r.id}`} className="input" defaultValue={r.description ?? ""} /></td>
                  </tr>
                ))}
                <tr><td className="font-bold">مجموع المشروع</td><td className="font-bold tabular-nums">{projTotal}</td><td /></tr>
              </tbody>
            </table>
          </div>
          <SubmitButton>حفظ الأوزان</SubmitButton>
        </form>
      </Card>

      <Card title="مستويات الإتمام" className="mb-4">
        <form action={saveLevels}>
          <div className="table-wrap mb-3">
            <table className="table">
              <thead><tr><th>الحد الأدنى</th><th>المستوى</th><th>الوثيقة الممنوحة</th></tr></thead>
              <tbody>
                {levels.map((l) => (
                  <tr key={l.id}>
                    <td className="w-28"><input name={`min_${l.id}`} type="number" min={0} max={100} className="input" dir="ltr" defaultValue={l.min} /></td>
                    <td className="w-40"><input name={`level_${l.id}`} className="input" defaultValue={l.level} /></td>
                    <td><input name={`certificate_${l.id}`} className="input" defaultValue={l.certificate} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <SubmitButton>حفظ المستويات</SubmitButton>
          <p className="text-xs text-muted mt-2">من نال أقل من أدنى مستوى حدّه فوق الصفر يُمنح إفادة حضور لا وثيقة إتمام.</p>
        </form>
      </Card>

      <Card title="بنود ميثاق المشاركة" className="mb-4">
        <p className="text-sm text-muted mb-3">يوقّع المشارك على هذه البنود عند دخوله. حذف بند يكون بإفراغ حقله ثم الحفظ.</p>
        <form action={saveCharter}>
          <div className="space-y-2 mb-3">
            {charter.map((c, i) => (
              <div key={c.id} className="flex gap-2 items-start">
                <span className="text-xs text-muted pt-3 w-5 shrink-0 tabular-nums">{i + 1}</span>
                <textarea name={`item_${c.id}`} className="textarea !min-h-[3.2rem]" rows={2} defaultValue={c.text} />
              </div>
            ))}
          </div>
          <div className="field">
            <label className="label">بند جديد</label>
            <textarea name="newItem" className="textarea !min-h-[3.2rem]" rows={2} placeholder="اترك الحقل فارغاً إن لم ترد إضافة بند" />
          </div>
          <SubmitButton>حفظ الميثاق</SubmitButton>
        </form>
      </Card>

      <Card title="كتب الورد القرائي">
        <p className="text-sm text-muted mb-3">الكتب التي تظهر للمشارك في بطاقة القراءة اليومية. الكتاب بلا صفحات لا يظهر في قائمة الاختيار.</p>
        <div className="space-y-3 mb-4">
          {books.map((b) => (
            <details key={b.id} className="card card-muted">
              <summary className="cursor-pointer text-sm font-medium">{b.order}. {b.title} — {b.author}</summary>
              <form action={saveBook} className="mt-3">
                <input type="hidden" name="id" value={b.id} />
                <BookFields book={b} />
              </form>
              <form action={deleteBook} className="mt-2">
                <input type="hidden" name="id" value={b.id} />
                <SubmitButton ghost className="btn-sm !px-0" pendingText="…">حذف الكتاب</SubmitButton>
              </form>
            </details>
          ))}
          {books.length === 0 && <p className="text-sm text-muted">لا كتب بعد.</p>}
        </div>
        <details className="card">
          <summary className="cursor-pointer text-sm font-medium">إضافة كتاب</summary>
          <form action={saveBook} className="mt-3">
            <BookFields />
          </form>
        </details>
      </Card>
    </>
  );
}

type B = { order: number; title: string; author: string; pages: number; weeks: string; circle: string; availability: string };

function BookFields({ book }: { book?: B }) {
  return (
    <>
      <div className="grid md:grid-cols-3 gap-x-3">
        <div className="field"><label className="label">العنوان</label><input name="title" className="input" required defaultValue={book?.title ?? ""} /></div>
        <div className="field"><label className="label">المؤلف</label><input name="author" className="input" defaultValue={book?.author ?? ""} /></div>
        <div className="field"><label className="label">الترتيب</label><input name="order" type="number" className="input" dir="ltr" defaultValue={book?.order ?? 0} /></div>
      </div>
      <div className="grid md:grid-cols-4 gap-x-3">
        <div className="field"><label className="label">الصفحات</label><input name="pages" type="number" min={0} className="input" dir="ltr" defaultValue={book?.pages ?? 0} /></div>
        <div className="field"><label className="label">أسابيع القراءة</label><input name="weeks" className="input" defaultValue={book?.weeks ?? ""} placeholder="1 – 4" /></div>
        <div className="field"><label className="label">حلقة النقاش</label><input name="circle" className="input" defaultValue={book?.circle ?? ""} placeholder="الأسبوع 4" /></div>
        <div className="field"><label className="label">الإتاحة</label><input name="availability" className="input" defaultValue={book?.availability ?? ""} placeholder="نسخة إلكترونية" /></div>
      </div>
      <SubmitButton secondary>{book ? "حفظ" : "إضافة"}</SubmitButton>
    </>
  );
}
