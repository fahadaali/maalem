import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Card, Empty, Progress, Badge } from "@/components/ui";
import { getCompetencies } from "@/lib/content";
import { parseJSON } from "@/lib/utils";
import { participantsWhere } from "@/lib/cohort";

export const metadata = { title: "التقييم التشخيصي" };

export default async function AdminDiagnosticPage() {
  const competencies = await getCompetencies();
  await requireRole("ADMIN");
  const [participants, rows] = await Promise.all([
    db.user.findMany({ where: await participantsWhere(), orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.diagnostic.findMany(),
  ]);
  const scoresOf = (userId: string, stage: string) => {
    const r = rows.find((x) => x.userId === userId && x.stage === stage);
    return r ? parseJSON<Record<string, number>>(r.scores, {}) : null;
  };
  const avg = (stage: string, slug: string) => {
    const vals = participants.map((p) => scoresOf(p.id, stage)?.[slug]).filter((v): v is number => typeof v === "number");
    return vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null;
  };
  const missingPre = participants.filter((p) => !scoresOf(p.id, "PRE"));

  return (
    <>
      <PageHeader
        title="التقييم التشخيصي"
        subtitle="قياس ذاتي للكفاءات الثماني قبل البرنامج وبعده. يُطبَّق في اللقاء الافتتاحي، ويُعاد في الأسبوع 12 ليتبيّن أثر البرنامج."
      />
      {participants.length === 0 ? (
        <Empty>لا مشاركون بعد.</Empty>
      ) : (
        <>
          {missingPre.length > 0 && (
            <div className="card card-muted text-sm mb-4">لم يعبّئوا التقييم القبلي بعد: {missingPre.map((m) => m.name).join("، ")}</div>
          )}
          <Card title="متوسط المجموعة" className="mb-4">
            <div className="space-y-3">
              {competencies.map((c) => {
                const pre = avg("PRE", c.slug);
                const post = avg("POST", c.slug);
                return (
                  <div key={c.slug}>
                    <div className="flex justify-between text-xs text-muted mb-1">
                      <span>{c.name} <span className="text-muted">({c.weight}%)</span></span>
                      <span>
                        قبل: {pre ?? "—"}{post != null ? ` · بعد: ${post}` : ""}
                        {pre != null && post != null ? ` · الأثر ${post - pre >= 0 ? "+" : ""}${Math.round((post - pre) * 10) / 10}` : ""}
                      </span>
                    </div>
                    <Progress value={post ?? pre ?? 0} max={5} />
                  </div>
                );
              })}
            </div>
          </Card>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>المشارك</th>{competencies.map((c) => <th key={c.slug} className="text-center">{c.name.replace("الكفاءة ", "").replace("كفاءة ", "")}</th>)}<th>الحالة</th></tr>
              </thead>
              <tbody>
                {participants.map((p) => {
                  const pre = scoresOf(p.id, "PRE");
                  const post = scoresOf(p.id, "POST");
                  return (
                    <tr key={p.id}>
                      <td className="font-medium whitespace-nowrap">{p.name}</td>
                      {competencies.map((c) => (
                        <td key={c.slug} className="text-center whitespace-nowrap">
                          {pre?.[c.slug] ?? "—"}{post ? ` → ${post[c.slug]}` : ""}
                        </td>
                      ))}
                      <td>{post ? <Badge tone="ink">مكتمل</Badge> : pre ? <Badge>قبلي فقط</Badge> : <Badge tone="soft">لم يبدأ</Badge>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
