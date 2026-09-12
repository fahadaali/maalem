import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Card, Badge, Empty } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import Attachments from "@/components/Attachments";
import { deleteMaterial, saveMaterial } from "../actions";
import { getBooks, getCompetencies } from "@/lib/content";
import { getActiveWeeks } from "@/lib/weeks";
import { MATERIAL_KIND_LABELS } from "@/lib/utils";

export const metadata = { title: "مكتبة المواد" };

export default async function AdminMaterialsPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireRole("ADMIN");
  const [books, competencies] = await Promise.all([getBooks(), getCompetencies()]);
  const { ok, err } = await searchParams;
  const [materials, files, weeks] = await Promise.all([
    db.material.findMany({ orderBy: [{ order: "asc" }, { createdAt: "asc" }] }),
    db.attachment.findMany({ where: { kind: "MATERIAL" }, orderBy: { createdAt: "asc" } }),
    getActiveWeeks(),
  ]);
  const filesOf = (id: string) =>
    files.filter((f) => f.refId === id).map((f) => ({ id: f.id, name: f.name, size: f.size, url: `/api/files/${f.key}` }));

  return (
    <>
      <PageHeader
        title="مكتبة المواد"
        subtitle="الكتب الأربعة والقوالب والأدلة في مكان واحد يصل إليه المشاركون. ارفع الملف أو ضع رابطه."
      />
      <FormMessage ok={ok} err={err} />
      <div className="grid md:grid-cols-[1fr_360px] gap-4 items-start">
        <div className="space-y-3">
          {materials.length === 0 ? (
            <Empty>لا مواد بعد. ابدأ بكتب «نقرأ لنربي» الأربعة وقوالب التقرير وبطاقة القراءة.</Empty>
          ) : (
            materials.map((m) => (
              <Card key={m.id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium">{m.title}</div>
                    <div className="text-xs text-muted">
                      {MATERIAL_KIND_LABELS[m.kind]}
                      {m.author ? ` · ${m.author}` : ""}
                      {m.competency ? ` · ${m.competency}` : ""}
                      {m.week != null ? ` · الأسبوع ${m.week}` : ""}
                    </div>
                  </div>
                  <Badge tone="soft">{MATERIAL_KIND_LABELS[m.kind]}</Badge>
                </div>
                {m.description && <p className="text-sm text-muted mt-1">{m.description}</p>}
                {m.url && (
                  <a href={m.url} target="_blank" rel="noopener" className="text-sm underline break-all mt-1 inline-block" dir="ltr">
                    {m.url}
                  </a>
                )}
                <div className="mt-2">
                  <Attachments kind="MATERIAL" refId={m.id} initial={filesOf(m.id)} />
                </div>
                <details className="mt-3 text-sm">
                  <summary className="cursor-pointer text-muted">تعديل</summary>
                  <form action={saveMaterial} className="mt-2">
                    <input type="hidden" name="id" value={m.id} />
                    <MaterialFields competencies={competencies} material={m} weeks={weeks} />
                    <SubmitButton secondary className="btn-sm">حفظ</SubmitButton>
                  </form>
                  <form action={deleteMaterial} className="mt-2">
                    <input type="hidden" name="id" value={m.id} />
                    <button className="btn btn-ghost btn-sm text-muted">حذف المادة وملفاتها</button>
                  </form>
                </details>
              </Card>
            ))
          )}
        </div>
        <Card title="إضافة مادة">
          <form action={saveMaterial}>
            <MaterialFields competencies={competencies} weeks={weeks} />
            <SubmitButton>إضافة وإشعار المشاركين</SubmitButton>
          </form>
          <div className="border-t border-line mt-4 pt-3 text-xs text-muted">
            <div className="font-medium text-ink-2 mb-1">كتب البرنامج المقررة</div>
            <ul className="list-disc ps-4 space-y-0.5">
              {books.filter((b) => b.pages > 0).map((b) => (
                <li key={b.order}>{b.title} — {b.author} ({b.availability})</li>
              ))}
            </ul>
          </div>
        </Card>
      </div>
    </>
  );
}

type M = { title: string; kind: string; author: string | null; description: string | null; url: string | null; competency: string | null; week: number | null; order: number };

function MaterialFields({ material, weeks, competencies }: { material?: M; weeks: { number: number; label: string }[]; competencies: { slug: string; name: string }[] }) {
  return (
    <>
      <div className="field">
        <label className="label">العنوان</label>
        <input name="title" className="input" required defaultValue={material?.title ?? ""} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="field">
          <label className="label">النوع</label>
          <select name="kind" className="select" defaultValue={material?.kind ?? "BOOK"}>
            {Object.entries(MATERIAL_KIND_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="label">المؤلف</label>
          <input name="author" className="input" defaultValue={material?.author ?? ""} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="field">
          <label className="label">الكفاءة</label>
          <select name="competency" className="select" defaultValue={material?.competency ?? ""}>
            <option value="">—</option>
            {competencies.map((c) => (
              <option key={c.slug} value={c.name}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="label">الأسبوع</label>
          <select name="week" className="select" defaultValue={material?.week ?? ""}>
            <option value="">—</option>
            {weeks.map((w) => (
              <option key={w.number} value={w.number}>الأسبوع {w.label}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="field">
        <label className="label">الوصف</label>
        <textarea name="description" className="textarea" rows={2} defaultValue={material?.description ?? ""} />
      </div>
      <div className="grid grid-cols-[1fr_90px] gap-3">
        <div className="field">
          <label className="label">رابط خارجي (اختياري)</label>
          <input name="url" className="input" dir="ltr" placeholder="https://" defaultValue={material?.url ?? ""} />
        </div>
        <div className="field">
          <label className="label">الترتيب</label>
          <input type="number" name="order" className="input" defaultValue={material?.order ?? 0} />
        </div>
      </div>
    </>
  );
}
