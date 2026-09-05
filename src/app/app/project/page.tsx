import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, Card, Badge, Alert } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import { saveProject } from "../actions";
import { PROJECT_DESCRIPTION, PROJECT_RUBRIC } from "@/lib/program";
import { PROJECT_STATUS_LABELS } from "@/lib/utils";

export const metadata = { title: "مشروع التخرج" };

export default async function ProjectPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const user = await requireRole("PARTICIPANT", "ADMIN");
  const { ok, err } = await searchParams;
  const p = await db.graduationProject.findUnique({ where: { userId: user.id } });
  const judged = p?.status === "JUDGED";
  const total = p ? (p.clarity ?? 0) + (p.grounding ?? 0) + (p.design ?? 0) + (p.integration ?? 0) + (p.presentation ?? 0) : 0;
  const scores: Record<string, number | null | undefined> = p ? { clarity: p.clarity, grounding: p.grounding, design: p.design, integration: p.integration, presentation: p.presentation } : {};

  return (
    <>
      <PageHeader title="مشروع التخرج التطبيقي" subtitle="30 درجة · تحديد الموضوع في الأسبوع 10، والمسودة في الأسبوع 12، والعرض أمام لجنة التحكيم في الأسبوع 13." actions={p && <Badge tone="ink">{PROJECT_STATUS_LABELS[p.status]}</Badge>} />
      <FormMessage ok={ok} err={err} />
      <div className="card card-muted text-sm mb-4">{PROJECT_DESCRIPTION}</div>
      {p?.adminNote && (
        <Alert>
          <div className="font-medium mb-1">ملاحظة مدير المشروع</div>
          <div className="whitespace-pre-wrap">{p.adminNote}</div>
        </Alert>
      )}
      {judged && (
        <Alert tone="success">
          <div className="font-medium mb-2">نتيجة التحكيم: {total} من 30</div>
          <ul className="text-sm space-y-0.5">
            {PROJECT_RUBRIC.map((r) => <li key={r.key}>{r.criterion}: {scores[r.key] ?? 0} / {r.points}</li>)}
          </ul>
          {p.judgeNote && <div className="mt-2 whitespace-pre-wrap">{p.judgeNote}</div>}
        </Alert>
      )}
      <Card>
        <form action={saveProject}>
          <div className="field">
            <label className="label">موضوع المشروع</label>
            <input name="topic" className="input" required defaultValue={p?.topic ?? ""} disabled={judged} />
          </div>
          <div className="field">
            <label className="label">المشكلة أو الفرصة التربوية من ميدانك</label>
            <textarea name="problem" className="textarea" rows={4} defaultValue={p?.problem ?? ""} disabled={judged} placeholder="تشخيص مبني على المعايشة أو دراسة حالة أو رصد ميداني" />
          </div>
          {p && p.status !== "PROPOSED" && (
            <>
              <div className="field">
                <label className="label">رابط المسودة (الأسبوع 12)</label>
                <input name="draftLink" className="input" dir="ltr" placeholder="https://" defaultValue={p.draftLink ?? ""} disabled={judged} />
              </div>
              <div className="field">
                <label className="label">رابط النسخة النهائية والعرض (الأسبوع 13)</label>
                <input name="finalLink" className="input" dir="ltr" placeholder="https://" defaultValue={p.finalLink ?? ""} disabled={judged} />
              </div>
            </>
          )}
          {p && p.status === "PROPOSED" && <p className="text-xs text-muted mb-3">بعد اعتماد الموضوع من مدير المشروع تظهر حقول رفع المسودة والنسخة النهائية.</p>}
          {p?.mentorName && <p className="text-sm mb-3">المرشد: <span className="font-medium">{p.mentorName}</span></p>}
          {!judged && <SubmitButton>{p ? "حفظ التحديثات" : "اقتراح الموضوع"}</SubmitButton>}
        </form>
      </Card>
      <Card title="معايير التحكيم" className="mt-4">
        <ul className="text-sm space-y-1">
          {PROJECT_RUBRIC.map((r) => <li key={r.key}><span className="font-medium">{r.criterion}</span> ({r.points}) — {r.description}</li>)}
        </ul>
      </Card>
    </>
  );
}
