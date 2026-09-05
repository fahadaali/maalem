import { PageHeader, DefinitionList, Card } from "@/components/ui";
import { PROGRAM, TOOLS } from "@/lib/program";

export const metadata = { title: "بطاقة البرنامج" };

export default function ProgramPage() {
  return (
    <>
      <PageHeader eyebrow="أولاً" title="بطاقة البرنامج" subtitle={PROGRAM.version} />
      <Card>
        <DefinitionList
          rows={PROGRAM.card.map((r) => ({
            label: r.label,
            value:
              r.label === "الأدوات التقنية" ? (
                <>
                  {r.value}
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {TOOLS.map((t) => (
                      <span key={t} className="badge" dir="ltr">{t}</span>
                    ))}
                  </div>
                </>
              ) : (
                r.value
              ),
          }))}
        />
      </Card>
      <Card title="الأهداف التفصيلية" className="mt-6">
        <ol className="list-decimal ps-5 space-y-2 text-sm">
          {PROGRAM.goals.map((g) => (
            <li key={g}>{g}</li>
          ))}
        </ol>
      </Card>
    </>
  );
}
