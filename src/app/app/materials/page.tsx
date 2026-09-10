import { requireParticipantView } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Card, Badge, Empty } from "@/components/ui";
import Attachments from "@/components/Attachments";
import { READING_NOTE } from "@/lib/program";
import { MATERIAL_KIND_LABELS } from "@/app/admin/materials/page";

export const metadata = { title: "مكتبة المواد" };

export default async function MaterialsPage() {
  await requireParticipantView();
  const [materials, files] = await Promise.all([
    db.material.findMany({ orderBy: [{ order: "asc" }, { createdAt: "asc" }] }),
    db.attachment.findMany({ where: { kind: "MATERIAL" }, orderBy: { createdAt: "asc" } }),
  ]);
  const groups = ["BOOK", "TEMPLATE", "GUIDE", "LINK"].filter((k) => materials.some((m) => m.kind === k));

  return (
    <>
      <PageHeader title="مكتبة المواد" subtitle="كتب البرنامج وقوالبه وأدلته. حمّلها أو افتح رابطها." />
      {materials.length === 0 ? (
        <Empty>لم تُضف مواد بعد. سيضعها مدير المشروع هنا.</Empty>
      ) : (
        <div className="space-y-6">
          {groups.map((kind) => (
            <section key={kind}>
              <h2 className="text-lg mb-2">{MATERIAL_KIND_LABELS[kind]}</h2>
              <div className="space-y-2">
                {materials.filter((m) => m.kind === kind).map((m) => {
                  const f = files.filter((x) => x.refId === m.id).map((x) => ({ id: x.id, name: x.name, size: x.size, url: `/api/files/${x.key}` }));
                  return (
                    <Card key={m.id}>
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <div className="font-medium">{m.title}</div>
                        <div className="flex gap-1">
                          {m.competency && <Badge tone="soft">{m.competency}</Badge>}
                          {m.week != null && <Badge>الأسبوع {m.week}</Badge>}
                        </div>
                      </div>
                      {m.author && <div className="text-xs text-muted">{m.author}</div>}
                      {m.description && <p className="text-sm text-muted mt-1">{m.description}</p>}
                      {m.url && (
                        <a href={m.url} target="_blank" rel="noopener" className="text-sm underline break-all inline-block mt-1" dir="ltr">
                          {m.url}
                        </a>
                      )}
                      {f.length > 0 && (
                        <div className="mt-2">
                          <Attachments kind="MATERIAL" refId={m.id} initial={f} readOnly />
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
      <p className="text-sm text-muted mt-6">{READING_NOTE}</p>
    </>
  );
}
