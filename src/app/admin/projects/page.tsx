import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Card, Badge, Empty } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import { judgeProject, updateProjectAdmin } from "../actions";
import { PROJECT_RUBRIC } from "@/lib/program";
import { PROJECT_STATUS_LABELS } from "@/lib/utils";
import Attachments from "@/components/Attachments";
import { db as _db } from "@/lib/db";

export const metadata = { title: "مشاريع التخرج" };

export default async function AdminProjectsPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireRole("ADMIN");
  const { ok, err } = await searchParams;
  const [projects, participants] = await Promise.all([
    db.graduationProject.findMany({ include: { user: true }, orderBy: { createdAt: "asc" } }),
    db.user.findMany({ where: { role: "PARTICIPANT", active: true }, select: { id: true, name: true } }),
  ]);
  const attRows = await _db.attachment.findMany({ where: { kind: "PROJECT" }, orderBy: { createdAt: "asc" } });
  const withProject = new Set(projects.map((p) => p.userId));
  const missing = participants.filter((p) => !withProject.has(p.id));

  return (
    <>
      <PageHeader title="مشاريع التخرج" subtitle="اعتماد الموضوعات (الأسبوع 10)، وتعيين المرشدين، ومراجعة المسودات (الأسبوع 12)، والتحكيم (الأسبوع 13)." />
      <FormMessage ok={ok} err={err} />
      {missing.length > 0 && <div className="card card-muted text-sm mb-4">لم يحددوا موضوعاً بعد: {missing.map((m) => m.name).join("، ")}</div>}
      {projects.length === 0 ? <Empty>لا مشاريع بعد.</Empty> : (
        <div className="space-y-4">
          {projects.map((p) => {
            const scores: Record<string, number | null> = { clarity: p.clarity, grounding: p.grounding, design: p.design, integration: p.integration, presentation: p.presentation };
            const total = Object.values(scores).reduce((a, b) => (a ?? 0) + (b ?? 0), 0);
            return (
              <Card key={p.id} title={p.user.name} action={<Badge tone={p.status === "JUDGED" ? "ink" : "default"}>{PROJECT_STATUS_LABELS[p.status]}{p.status === "JUDGED" ? ` · ${total}/30` : ""}</Badge>}>
                <div className="font-medium">{p.topic}</div>
                {p.problem && <div className="text-sm text-muted whitespace-pre-wrap mt-1">{p.problem}</div>}
                <div className="flex flex-wrap gap-3 text-sm mt-2">
                  {p.draftLink && <a href={p.draftLink} target="_blank" rel="noopener" className="underline">المسودة</a>}
                  {p.finalLink && <a href={p.finalLink} target="_blank" rel="noopener" className="underline">النسخة النهائية</a>}
                </div>
                <div className="mt-2"><Attachments kind="PROJECT" initial={attRows.filter((r) => r.userId === p.userId).map((r) => ({ id: r.id, name: r.name, size: r.size, url: `/api/files/${r.key}` }))} readOnly /></div>
                <div className="grid md:grid-cols-2 gap-4 mt-4 border-t border-line pt-4">
                  <form action={updateProjectAdmin}>
                    <input type="hidden" name="id" value={p.id} />
                    <div className="grid grid-cols-2 gap-3">
                      <div className="field">
                        <label className="label">الحالة</label>
                        <select name="status" className="select" defaultValue={p.status}>
                          {Object.entries(PROJECT_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                      </div>
                      <div className="field"><label className="label">المرشد</label><input name="mentorName" className="input" defaultValue={p.mentorName ?? ""} /></div>
                    </div>
                    <div className="field"><label className="label">ملاحظة للمشارك</label><textarea name="adminNote" className="textarea" rows={2} defaultValue={p.adminNote ?? ""} /></div>
                    <SubmitButton secondary className="btn-sm">حفظ</SubmitButton>
                  </form>
                  <form action={judgeProject}>
                    <input type="hidden" name="id" value={p.id} />
                    <div className="text-sm font-medium mb-2">التحكيم (30)</div>
                    {PROJECT_RUBRIC.map((r) => (
                      <div key={r.key} className="flex items-center gap-2 mb-2 text-sm">
                        <label className="flex-1">{r.criterion} <span className="text-muted">/{r.points}</span></label>
                        <input type="number" name={r.key} min={0} max={r.points} step={0.5} className="input w-20" defaultValue={scores[r.key] ?? ""} required inputMode="decimal" />
                      </div>
                    ))}
                    <div className="field"><textarea name="judgeNote" className="textarea" rows={2} placeholder="ملاحظات لجنة التحكيم" defaultValue={p.judgeNote ?? ""} /></div>
                    <SubmitButton className="btn-sm">اعتماد التحكيم</SubmitButton>
                  </form>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
