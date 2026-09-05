import { PageHeader, Card, Badge } from "@/components/ui";
import { COMPETENCIES } from "@/lib/program";

export const metadata = { title: "مصفوفة الكفاءات" };

export default function CompetenciesPage() {
  return (
    <>
      <PageHeader
        eyebrow="ثانياً"
        title="مصفوفة الكفاءات والبرامج"
        subtitle="لكل كفاءة جدول مستقل يبين المفردات، والبرنامج المنفذ، ومؤشر التحقق، والمهام الرئيسية، والموعد، والتكلفة، والشواهد، والمراجع. الشاهد هو الدليل المادي الذي يُودع في ملف إنجاز المشارك ويتحقق منه مدير المشروع."
      />
      <div className="flex flex-wrap gap-2 mb-6">
        {COMPETENCIES.map((c) => (
          <a key={c.slug} href={`#${c.slug}`} className="badge hover:bg-paper-2">
            {c.order}. {c.name} <span className="text-muted">{c.weight}%</span>
          </a>
        ))}
      </div>
      <div className="space-y-8">
        {COMPETENCIES.map((c) => (
          <section key={c.slug} id={c.slug} className="scroll-mt-20">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-xl">{c.order}. {c.name}</h2>
              <Badge tone="ink">الوزن النسبي {c.weight}%</Badge>
            </div>
            {c.intro && <p className="text-sm text-muted mb-3">{c.intro}</p>}
            <div className="space-y-3">
              {c.items.map((it) => (
                <Card key={it.title}>
                  <h3 className="text-base mb-2">{it.title}</h3>
                  <dl className="grid md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    <Row label="البرنامج" value={it.program} />
                    <Row label="المؤشر" value={it.indicator} />
                    <Row label="المهام الرئيسية" value={it.tasks} />
                    <Row label="الموعد" value={it.schedule} />
                    <Row label="التكلفة" value={it.cost} />
                    <Row label="الشواهد" value={it.evidence} />
                    <div className="md:col-span-2">
                      <dt className="text-xs text-muted">المراجع</dt>
                      <dd className="flex flex-wrap gap-1 mt-1">
                        {it.references.map((r) => (
                          <span key={r} className="badge badge-soft">{r}</span>
                        ))}
                      </dd>
                    </div>
                  </dl>
                </Card>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
