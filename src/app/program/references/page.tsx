import { PageHeader, Card } from "@/components/ui";
import { REFERENCES, REFERENCES_NOTE } from "@/lib/program";

export const metadata = { title: "قائمة المراجع" };

export default function ReferencesPage() {
  return (
    <>
      <PageHeader eyebrow="سادساً" title="قائمة المراجع الشاملة" />
      <div className="space-y-4">
        {REFERENCES.map((r) => (
          <Card key={r.area} title={r.area}>
            <ul className="list-disc ps-5 text-sm space-y-1">
              {r.items.map((i) => <li key={i}>{i}</li>)}
            </ul>
          </Card>
        ))}
      </div>
      <p className="text-sm text-muted mt-6">{REFERENCES_NOTE}</p>
    </>
  );
}
