import Link from "@/components/Link";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Card, Badge } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import { saveProgramReport } from "../actions";
import { buildSnapshot, SNAPSHOT_LABELS, type Snapshot } from "@/lib/snapshot";
import { cohortWhere } from "@/lib/cohort";
import { formatShort } from "@/lib/dates";
import { parseJSON } from "@/lib/utils";
import { cn } from "@/lib/utils";

export const metadata = { title: "تقارير الجهة" };

const MONTHS = ["الشهر الأول", "الشهر الثاني", "الشهر الثالث"];

export default async function ProgramReportsPage({ searchParams }: { searchParams: Promise<{ kind?: string; period?: string; ok?: string; err?: string }> }) {
  await requireRole("ADMIN");
  const sp = await searchParams;
  const kind = sp.kind === "FINAL" ? "FINAL" : "MONTHLY";
  const period = sp.period ?? (kind === "FINAL" ? "ختامي" : MONTHS[0]);
  const [existing, all, snapshot] = await Promise.all([
    db.programReport.findFirst({ where: { kind, period, ...(await cohortWhere()) } }),
    db.programReport.findMany({ where: await cohortWhere(), orderBy: { updatedAt: "desc" } }),
    buildSnapshot(),
  ]);
  const saved = existing?.snapshot ? parseJSON<Snapshot>(existing.snapshot, snapshot) : null;
  const shown = saved ?? snapshot;
  const periods = kind === "FINAL" ? ["ختامي"] : MONTHS;

  return (
    <>
      <PageHeader
        title="تقارير الجهة"
        subtitle="التقرير الشهري بند ثابت في مصفوفة متابعة مدير المشروع، والتقرير الختامي يُسلَّم خلال 14 يوماً من الحفل. الأرقام تُلتقط من المنصة."
        actions={<Link href="/admin/program-reports/print" className="btn btn-secondary btn-sm">عرض للطباعة</Link>}
      />
      <FormMessage ok={sp.ok} err={sp.err} />
      <div className="flex flex-wrap gap-1 mb-4">
        {(["MONTHLY", "FINAL"] as const).map((k) => (
          <Link key={k} href={`/admin/program-reports?kind=${k}`} className={cn("badge", k === kind && "badge-ink")}>
            {k === "MONTHLY" ? "التقرير الشهري" : "التقرير الختامي"}
          </Link>
        ))}
        <span className="mx-2 text-line-2">|</span>
        {periods.map((p) => (
          <Link key={p} href={`/admin/program-reports?kind=${kind}&period=${encodeURIComponent(p)}`} className={cn("badge", p === period && "badge-ink")}>
            {p}
          </Link>
        ))}
      </div>

      <Card title="أرقام المنصة الآن" className="mb-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2 text-sm">
          {(Object.keys(SNAPSHOT_LABELS) as (keyof Snapshot)[]).map((k) => (
            <div key={k} className="flex justify-between border-b border-line py-1">
              <span className="text-muted">{SNAPSHOT_LABELS[k]}</span>
              <span className="font-medium">{shown[k]}</span>
            </div>
          ))}
        </div>
        {saved && <p className="text-xs text-muted mt-2">هذه أرقام محفوظة مع التقرير. الأرقام الحية الآن: متوسط الدرجات {snapshot.gradeAvg}، الحضور {snapshot.attendanceAvg}%.</p>}
      </Card>

      <Card title={`${kind === "FINAL" ? "التقرير الختامي" : "التقرير الشهري"} — ${period}`}>
        <form action={saveProgramReport}>
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="period" value={period} />
          <input type="hidden" name="snapshot" value={JSON.stringify(snapshot)} />
          <div className="field">
            <label className="label">الملخص التنفيذي</label>
            <textarea name="summary" className="textarea" rows={4} required defaultValue={existing?.summary ?? ""} />
          </div>
          <div className="field">
            <label className="label">أبرز الإنجازات</label>
            <textarea name="highlights" className="textarea" rows={3} defaultValue={existing?.highlights ?? ""} />
          </div>
          <div className="field">
            <label className="label">التحديات وما اتُّخذ حيالها</label>
            <textarea name="challenges" className="textarea" rows={3} defaultValue={existing?.challenges ?? ""} />
          </div>
          {kind === "FINAL" && (
            <>
              <div className="field">
                <label className="label">الدروس المستفادة</label>
                <textarea name="lessons" className="textarea" rows={4} defaultValue={existing?.lessons ?? ""} />
              </div>
              <div className="field">
                <label className="label">التوصيات للدفعة القادمة</label>
                <textarea name="recommendations" className="textarea" rows={4} defaultValue={existing?.recommendations ?? ""} />
              </div>
            </>
          )}
          <SubmitButton>{existing ? "تحديث التقرير" : "حفظ التقرير"}</SubmitButton>
          {existing && <span className="text-xs text-muted ms-3">آخر تحديث {formatShort(existing.updatedAt)}</span>}
        </form>
      </Card>

      {all.length > 0 && (
        <Card title="التقارير المحفوظة" className="mt-4">
          <ul className="divide-y divide-line text-sm">
            {all.map((r) => (
              <li key={r.id} className="py-2 flex justify-between gap-2">
                <Link href={`/admin/program-reports?kind=${r.kind}&period=${encodeURIComponent(r.period)}`} className="hover:underline">
                  {r.kind === "FINAL" ? "ختامي" : "شهري"} — {r.period}
                </Link>
                <Badge tone="soft">{formatShort(r.updatedAt)}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
