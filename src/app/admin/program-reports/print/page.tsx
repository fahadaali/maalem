import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { PROGRAM } from "@/lib/program";
import { SNAPSHOT_LABELS, type Snapshot, buildSnapshot } from "@/lib/snapshot";
import { formatGregorian, formatHijri } from "@/lib/dates";
import { parseJSON } from "@/lib/utils";
import PrintButton from "@/components/PrintButton";

export const metadata = { title: "تقارير الجهة — طباعة" };

export default async function PrintReportsPage({ searchParams }: { searchParams: Promise<{ kind?: string; period?: string }> }) {
  await requireRole("ADMIN");
  const sp = await searchParams;
  const where = sp.kind ? { kind: sp.kind === "FINAL" ? "FINAL" : "MONTHLY", ...(sp.period ? { period: sp.period } : {}) } : {};
  const [reports, live] = await Promise.all([
    db.programReport.findMany({ where, orderBy: [{ kind: "asc" }, { period: "asc" }] }),
    buildSnapshot(),
  ]);
  const now = new Date();

  return (
    <div className="max-w-3xl mx-auto">
      <div className="no-print mb-4 flex gap-2">
        <PrintButton />
        <Link href="/admin/program-reports" className="btn btn-ghost btn-sm">رجوع</Link>
      </div>
      <header className="text-center mb-6 border-b border-line pb-4">
        <h1 className="text-2xl">{PROGRAM.name}</h1>
        <p className="text-sm text-muted">{PROGRAM.subtitle} — {PROGRAM.cohort}</p>
        <p className="text-xs text-muted mt-1">حُرِّر في {formatHijri(now)} الموافق {formatGregorian(now)}</p>
      </header>
      {reports.length === 0 ? (
        <p className="text-sm text-muted">لا تقارير محفوظة.</p>
      ) : (
        reports.map((r) => {
          const snap = r.snapshot ? parseJSON<Snapshot>(r.snapshot, live) : live;
          return (
            <section key={r.id} className="mb-8">
              <h2 className="text-xl mb-2">{r.kind === "FINAL" ? "التقرير الختامي" : `التقرير الشهري — ${r.period}`}</h2>
              <Block title="الملخص التنفيذي" body={r.summary} />
              <Block title="أبرز الإنجازات" body={r.highlights} />
              <Block title="التحديات وما اتُّخذ حيالها" body={r.challenges} />
              <Block title="الدروس المستفادة" body={r.lessons} />
              <Block title="التوصيات للدفعة القادمة" body={r.recommendations} />
              <h3 className="text-base mt-4 mb-1">مؤشرات البرنامج</h3>
              <div className="table-wrap">
                <table className="table">
                  <tbody>
                    {(Object.keys(SNAPSHOT_LABELS) as (keyof Snapshot)[]).map((k) => (
                      <tr key={k}><td className="text-muted">{SNAPSHOT_LABELS[k]}</td><td className="font-medium">{snap[k]}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}

function Block({ title, body }: { title: string; body?: string | null }) {
  if (!body) return null;
  return (
    <div className="mb-3">
      <h3 className="text-base mb-1">{title}</h3>
      <p className="text-sm whitespace-pre-wrap">{body}</p>
    </div>
  );
}
