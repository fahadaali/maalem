import Link from "@/components/Link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader, BackLink, Badge } from "@/components/ui";
import FormMessage from "@/components/FormMessage";
import FocusItem from "@/components/FocusItem";
import { computeGrades } from "@/lib/grades";
import { finalTotalOf } from "@/lib/content";
import { ROLE_LABELS, cn } from "@/lib/utils";
import { emptyParticipant, loadParticipant, loadProgram } from "@/lib/participant-data";
import { obligationsFrom } from "@/lib/obligations";
import { returnedIds } from "@/lib/returns";
import { FILE_TABS, isFileTab, type FileTab } from "@/lib/items";
import { parsePanel } from "./parts";
import { FieldTab, JournalTab, LogTab, OverviewTab, QuizzesTab, ReadingTab, WorkTab, type Ctx } from "./tabs";

export const metadata = { title: "ملف مشارك" };

/**
 * ملف المشارك: كل ما قدّمه من حسابه في مكان واحد، بتبويبات.
 *
 * كان الملف أعداداً وروابط إلى صفحاتٍ أخرى: «بطاقات القراءة: 23»، «خطة التعلم:
 * مسلّمة»، والتقارير شاراتٌ تقود إلى صفحة التقارير — فلا يُقرأ ما كتبه المشارك
 * إلا بالتنقّل بين خمس صفحات، وبعضه (الخطة والبطاقات) لا يُقرأ أصلاً. وصار كل
 * إدخالٍ هنا بنصّه، وعليه قائمة ⋮: تعديل، ومراجعة، وإرجاعٌ لصاحبه بموعده الأصلي،
 * وحذفٌ بلقطةٍ تُعاد منها.
 */
export default async function ParticipantFile({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; edit?: string; review?: string; ret?: string; focus?: string; ok?: string; err?: string }>;
}) {
  await requireRole("ADMIN");
  const { id } = await params;
  const sp = await searchParams;
  const u = await db.user.findUnique({ where: { id }, select: { id: true, name: true, username: true, phone: true, role: true, active: true, mentor: { select: { name: true } }, finalGrade: { select: { computed: true, adjustment: true } } } });
  if (!u) notFound();
  const isParticipant = u.role === "PARTICIPANT";
  const tab: FileTab = !isParticipant ? "log" : isFileTab(sp.tab) ? sp.tab : "overview";
  const now = new Date();

  const [loaded, program, grades] = await Promise.all([loadParticipant(u.id), loadProgram(), isParticipant ? computeGrades(u.id) : null]);
  const rows = loaded ?? emptyParticipant(u.id);
  const obligations = isParticipant ? obligationsFrom(rows, program, now) : null;
  const ctx: Ctx = { userId: u.id, name: u.name, panel: parsePanel(sp), now, rows, program, obligations };

  // ما ينتظر مراجعة المدير في كل تبويب — من الصفوف المجلوبة، بلا استعلام زائد
  const returnedSubs = returnedIds(rows.returns, "SUBMISSION");
  const waiting: Partial<Record<FileTab, number>> = {
    work: rows.submissions.filter((s) => !s.gradedAt && !returnedSubs.has(s.id)).length + rows.reports.filter((r) => !r.reviewedAt).length,
    reading: rows.cards.filter((c) => !c.reviewedAt).length + (rows.plan && !rows.plan.reviewedAt ? 1 : 0),
    field: rows.fieldLogs.filter((f) => !f.approvedAt).length,
  };
  const waitingTotal = (waiting.work ?? 0) + (waiting.reading ?? 0) + (waiting.field ?? 0);
  const total = u.finalGrade ? finalTotalOf(u.finalGrade) : grades?.total;

  return (
    <>
      <BackLink href="/admin/participants">المشاركون</BackLink>
      <PageHeader
        title={u.name}
        subtitle={`${ROLE_LABELS[u.role]} · ${u.username}${u.phone ? " · " + u.phone : ""}${u.mentor ? " · المشرف المرافق: " + u.mentor.name : ""}${u.active ? "" : " · موقوف"}`}
        actions={
          isParticipant && (
            <div className="flex flex-wrap gap-1 items-center">
              {total != null && <Badge tone="ink">{total} / 100{u.finalGrade ? " · معتمدة" : ""}{grades ? ` · ${grades.level}` : ""}</Badge>}
              {obligations && <Badge tone={obligations.counts.overdue ? "ink" : "soft"}>متأخر {obligations.counts.overdue}</Badge>}
              {obligations && obligations.counts.returned > 0 && <Badge tone="ink">مُرجَع {obligations.counts.returned}</Badge>}
              <Badge tone={waitingTotal ? "default" : "soft"}>بانتظار مراجعتك {waitingTotal}</Badge>
              <Link href={`/admin/participants/${u.id}/portfolio`} prefetch={false} className="btn btn-sm btn-secondary">ملف الإنجاز للطباعة</Link>
            </div>
          )
        }
      />
      <FormMessage ok={sp.ok} err={sp.err} />
      <FocusItem id={sp.focus} />

      {isParticipant && (
        <nav className="flex gap-1 overflow-x-auto pb-3 mb-4 -mx-4 px-4 sticky z-10 bg-paper/95 backdrop-blur pt-2" style={{ top: "var(--header-h)" }} aria-label="أقسام الملف">
          {(Object.keys(FILE_TABS) as FileTab[]).map((t) => (
            <Link
              key={t}
              href={`/admin/participants/${u.id}?tab=${t}`}
              prefetch={false}
              aria-current={t === tab ? "page" : undefined}
              className={cn("badge shrink-0 !py-1 !px-3", t === tab && "badge-ink")}
            >
              {FILE_TABS[t]}
              {waiting[t] ? <span className={cn("ms-1 rounded-full px-1.5 text-[10px] font-bold", t === tab ? "bg-paper text-ink" : "bg-ink text-paper")}>{waiting[t]}</span> : null}
            </Link>
          ))}
        </nav>
      )}

      {tab === "overview" && grades && <OverviewTab ctx={ctx} grades={grades} />}
      {tab === "work" && <WorkTab ctx={ctx} />}
      {tab === "reading" && <ReadingTab ctx={ctx} />}
      {tab === "field" && <FieldTab ctx={ctx} />}
      {tab === "quizzes" && <QuizzesTab ctx={ctx} />}
      {tab === "journal" && <JournalTab ctx={ctx} />}
      {tab === "log" && <LogTab ctx={ctx} isParticipant={isParticipant} />}
    </>
  );
}
