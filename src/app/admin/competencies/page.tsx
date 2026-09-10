import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Card, Badge, Alert } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import { saveCompetency, deleteCompetency, saveCompetencyItem, deleteCompetencyItem } from "../actions";
import { cohortWhere } from "@/lib/cohort";
import { cn } from "@/lib/utils";

export const metadata = { title: "مصفوفة الكفاءات" };

export default async function AdminCompetenciesPage({ searchParams }: { searchParams: Promise<{ c?: string; ok?: string; err?: string }> }) {
  await requireRole("ADMIN");
  const sp = await searchParams;
  const defs = await db.competencyDef.findMany({
    where: await cohortWhere(),
    orderBy: { order: "asc" },
    include: { items: { orderBy: { order: "asc" } } },
  });
  const selected = defs.find((d) => d.id === sp.c) ?? defs[0];
  const totalWeight = defs.reduce((s, d) => s + d.weight, 0);

  return (
    <>
      <PageHeader
        title="مصفوفة الكفاءات"
        subtitle="الكفاءات وأوزانها ومفرداتها كما في الوثيقة، قابلة للتحرير لكل دفعة. الوزن يُستعمل في بطاقة الكفاءات لدى كل مشارك."
        actions={<Link href="/admin/content" className="btn btn-secondary">بقية محتوى الوثيقة</Link>}
      />
      <FormMessage ok={sp.ok} err={sp.err} />
      {Math.round(totalWeight) !== 100 && (
        <Alert tone="error">مجموع الأوزان {Math.round(totalWeight * 10) / 10}% لا 100%. بطاقة الكفاءات تُحسب على هذا المجموع كما هو.</Alert>
      )}

      <div className="flex gap-1 overflow-x-auto pb-3 mb-4 -mx-4 px-4">
        {defs.map((d) => (
          <Link key={d.id} href={`/admin/competencies?c=${d.id}`} className={cn("badge shrink-0", d.id === selected?.id && "badge-ink")}>
            {d.order}. {d.name} · {d.weight}%
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-[340px_1fr] gap-4 items-start">
        <div className="space-y-4">
          {selected && (
            <Card title="بيانات الكفاءة">
              <form action={saveCompetency}>
                <input type="hidden" name="id" value={selected.id} />
                <CompetencyFields def={selected} />
              </form>
              <form action={deleteCompetency} className="mt-2 border-t border-line pt-2">
                <input type="hidden" name="id" value={selected.id} />
                <SubmitButton ghost className="btn-sm !px-0" pendingText="…">حذف الكفاءة ومفرداتها</SubmitButton>
              </form>
            </Card>
          )}
          <Card title="كفاءة جديدة">
            <form action={saveCompetency}>
              <CompetencyFields />
            </form>
          </Card>
        </div>

        <div>
          {!selected ? (
            <Card>لا كفاءات بعد. أضف الأولى من النموذج المجاور.</Card>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-lg">مفردات {selected.name}</h2>
                <Badge tone="soft">{selected.items.length}</Badge>
              </div>
              <div className="space-y-3">
                {selected.items.map((it) => (
                  <details key={it.id} className="card">
                    <summary className="cursor-pointer text-sm font-medium">{it.order + 1}. {it.title}</summary>
                    <form action={saveCompetencyItem} className="mt-3">
                      <input type="hidden" name="id" value={it.id} />
                      <input type="hidden" name="competencyId" value={selected.id} />
                      <ItemFields item={it} />
                    </form>
                    <form action={deleteCompetencyItem} className="mt-2">
                      <input type="hidden" name="id" value={it.id} />
                      <input type="hidden" name="competencyId" value={selected.id} />
                      <SubmitButton ghost className="btn-sm !px-0" pendingText="…">حذف المفردة</SubmitButton>
                    </form>
                  </details>
                ))}
                {selected.items.length === 0 && <p className="text-sm text-muted">لا مفردات في هذه الكفاءة.</p>}
                <details className="card card-muted">
                  <summary className="cursor-pointer text-sm font-medium">إضافة مفردة</summary>
                  <form action={saveCompetencyItem} className="mt-3">
                    <input type="hidden" name="competencyId" value={selected.id} />
                    <ItemFields order={selected.items.length} />
                  </form>
                </details>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function CompetencyFields({ def }: { def?: { slug: string; order: number; name: string; weight: number; intro: string } }) {
  return (
    <>
      <div className="field"><label className="label">الاسم</label><input name="name" className="input" required defaultValue={def?.name ?? ""} /></div>
      <div className="grid grid-cols-3 gap-2">
        <div className="field"><label className="label">المعرّف</label><input name="slug" className="input" dir="ltr" required pattern="[a-z][a-z0-9_\-]{1,30}" defaultValue={def?.slug ?? ""} /></div>
        <div className="field"><label className="label">الوزن %</label><input name="weight" type="number" step="0.5" min={0} max={100} className="input" dir="ltr" defaultValue={def?.weight ?? 0} /></div>
        <div className="field"><label className="label">الترتيب</label><input name="order" type="number" className="input" dir="ltr" defaultValue={def?.order ?? 0} /></div>
      </div>
      <div className="field"><label className="label">التمهيد</label><textarea name="intro" className="textarea" rows={3} defaultValue={def?.intro ?? ""} /></div>
      <SubmitButton secondary>{def ? "حفظ" : "إضافة"}</SubmitButton>
      <p className="text-xs text-muted mt-2">المعرّف يربط الكفاءة بشواهد المنصة في بطاقة الكفاءات، فتغييره يُفقدها شواهدها المرتبطة به.</p>
    </>
  );
}

type Item = { order: number; title: string; program: string; indicator: string; tasks: string; schedule: string; cost: string; evidence: string; refs: string };

function ItemFields({ item, order = 0 }: { item?: Item; order?: number }) {
  return (
    <>
      <div className="field"><label className="label">العنوان</label><input name="title" className="input" required defaultValue={item?.title ?? ""} /></div>
      <div className="grid md:grid-cols-2 gap-x-3">
        <div className="field"><label className="label">البرنامج المنفذ</label><textarea name="program" className="textarea !min-h-[3.2rem]" rows={2} defaultValue={item?.program ?? ""} /></div>
        <div className="field"><label className="label">مؤشر التحقق</label><textarea name="indicator" className="textarea !min-h-[3.2rem]" rows={2} defaultValue={item?.indicator ?? ""} /></div>
        <div className="field"><label className="label">المهام الرئيسية</label><textarea name="tasks" className="textarea !min-h-[3.2rem]" rows={2} defaultValue={item?.tasks ?? ""} /></div>
        <div className="field"><label className="label">الشواهد</label><textarea name="evidence" className="textarea !min-h-[3.2rem]" rows={2} defaultValue={item?.evidence ?? ""} /></div>
      </div>
      <div className="grid md:grid-cols-3 gap-x-3">
        <div className="field"><label className="label">الموعد</label><input name="schedule" className="input" defaultValue={item?.schedule ?? ""} /></div>
        <div className="field"><label className="label">التكلفة</label><input name="cost" className="input" defaultValue={item?.cost ?? ""} /></div>
        <div className="field"><label className="label">الترتيب</label><input name="order" type="number" className="input" dir="ltr" defaultValue={item?.order ?? order} /></div>
      </div>
      <div className="field">
        <label className="label">المراجع — مرجع في كل سطر</label>
        <textarea name="refs" className="textarea" rows={3} defaultValue={item?.refs ?? ""} />
      </div>
      <SubmitButton secondary>{item ? "حفظ" : "إضافة"}</SubmitButton>
    </>
  );
}
