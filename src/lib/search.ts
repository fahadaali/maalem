import { db } from "./db";
import { cohortWhere, participantsWhere } from "./cohort";
import { getWeeks } from "./weeks";
import { ROLE_LABELS } from "./utils";

export type Hit = { group: string; title: string; snippet?: string; href: string; meta?: string };

const cut = (s: string | null | undefined, n = 140) => (s ? (s.length > n ? `${s.slice(0, n)}…` : s) : undefined);
const like = (q: string) => ({ contains: q });

/** بحث مدير المشروع: يشمل الأشخاص وكل ما سجّلوه في الدفعة النشطة */
export async function searchAdmin(q: string): Promise<Hit[]> {
  const term = q.trim();
  if (term.length < 2) return [];
  const scope = await cohortWhere();
  const ids = (await db.user.findMany({ where: await participantsWhere(), select: { id: true } })).map((u) => u.id);
  const names = new Map(
    (await db.user.findMany({ where: { OR: [scope, { role: "ADMIN" }] }, select: { id: true, name: true } })).map((u) => [u.id, u.name]),
  );

  const [users, materials, minutes, guests, reports, cards, assignments, quizzes, bank, comps, fieldLogs, excuses, projects] = await Promise.all([
    db.user.findMany({ where: { OR: [{ name: like(term) }, { username: like(term) }, { phone: like(term) }, { email: like(term) }] }, take: 10 }),
    db.material.findMany({ where: { OR: [{ title: like(term) }, { author: like(term) }, { description: like(term) }] }, take: 10 }),
    db.sessionMinutes.findMany({ where: { ...scope, OR: [{ title: like(term) }, { minutes: like(term) }, { decisions: like(term) }, { guestName: like(term) }] }, take: 10 }),
    db.guest.findMany({ where: { ...scope, OR: [{ name: like(term) }, { topic: like(term) }, { notes: like(term) }] }, take: 10 }),
    db.weeklyReport.findMany({ where: { userId: { in: ids }, OR: [{ benefits: like(term) }, { reading: like(term) }, { taskProgress: like(term) }, { difficulty: like(term) }, { application: like(term) }] }, take: 10 }),
    db.readingCard.findMany({ where: { userId: { in: ids }, OR: [{ book: like(term) }, { benefit: like(term) }, { question: like(term) }] }, take: 10 }),
    db.assignment.findMany({ where: { ...scope, OR: [{ title: like(term) }, { description: like(term) }] }, take: 10 }),
    db.quiz.findMany({ where: { ...scope, title: like(term) }, take: 10 }),
    db.bankQuestion.findMany({ where: { ...scope, OR: [{ text: like(term) }, { explanation: like(term) }] }, take: 10 }),
    db.competencyItemRow.findMany({ where: { competency: { ...scope }, OR: [{ title: like(term) }, { indicator: like(term) }, { evidence: like(term) }] }, include: { competency: { select: { id: true, name: true } } }, take: 10 }),
    db.fieldLog.findMany({ where: { userId: { in: ids }, OR: [{ note: like(term) }, { mentorName: like(term) }] }, take: 10 }),
    db.excuseRequest.findMany({ where: { userId: { in: ids }, reason: like(term) }, take: 10 }),
    db.graduationProject.findMany({ where: { userId: { in: ids }, OR: [{ topic: like(term) }, { problem: like(term) }, { mentorName: like(term) }] }, take: 10 }),
  ]);

  const weeks = (await getWeeks()).filter((w) =>
    [w.label, w.session, w.circle, w.reading, w.task, w.competency].some((v) => typeof v === "string" && v.includes(term)),
  );

  const hits: Hit[] = [];
  for (const u of users) hits.push({ group: "الأشخاص", title: u.name, meta: `${ROLE_LABELS[u.role] ?? u.role} · ${u.username}`, href: `/admin/participants/${u.id}` });
  for (const m of materials) hits.push({ group: "مكتبة المواد", title: m.title, snippet: cut(m.description), meta: m.author ?? undefined, href: "/admin/materials" });
  for (const m of minutes) hits.push({ group: "محاضر اللقاءات", title: m.title ?? `محضر الأسبوع ${m.week}`, snippet: cut(m.minutes), href: "/admin/minutes" });
  for (const g of guests) hits.push({ group: "الخبراء والضيوف", title: g.name, snippet: cut(g.topic), href: "/admin/guests" });
  for (const r of reports) hits.push({ group: "التقارير الأسبوعية", title: `${names.get(r.userId) ?? ""} — الأسبوع ${r.week}`, snippet: cut(r.benefits), href: `/admin/reports?week=${r.week}#r-${r.id}` });
  for (const c of cards) hits.push({ group: "بطاقات القراءة", title: `${names.get(c.userId) ?? ""} — ${c.book}`, snippet: cut(c.benefit), href: `/admin/participants/${c.userId}` });
  for (const a of assignments) hits.push({ group: "المهام", title: a.title, snippet: cut(a.description), meta: `الأسبوع ${a.week}`, href: `/admin/tasks/${a.id}` });
  for (const z of quizzes) hits.push({ group: "الاختبارات", title: z.title, meta: z.week != null ? `الأسبوع ${z.week}` : undefined, href: `/admin/quizzes/${z.id}` });
  for (const b of bank) hits.push({ group: "بنك الأسئلة", title: b.text, snippet: cut(b.explanation), href: "/admin/bank" });
  for (const c of comps) hits.push({ group: "مصفوفة الكفاءات", title: c.title, snippet: cut(c.indicator), meta: c.competency.name, href: `/admin/competencies?c=${c.competency.id}` });
  for (const f of fieldLogs) hits.push({ group: "المعايشة الميدانية", title: `${names.get(f.userId) ?? ""} — ${f.mentorName}`, snippet: cut(f.note), href: "/admin/field" });
  for (const e of excuses) hits.push({ group: "طلبات الاستئذان", title: names.get(e.userId) ?? "", snippet: cut(e.reason), href: "/admin/excuses" });
  for (const g of projects) hits.push({ group: "مشاريع التخرج", title: `${names.get(g.userId) ?? ""} — ${g.topic}`, snippet: cut(g.problem), href: "/admin/projects" });
  for (const w of weeks) hits.push({ group: "جدول البرنامج", title: `الأسبوع ${w.label}`, snippet: cut(w.session), href: `/admin/schedule?week=${w.number}` });
  return hits;
}

/** بحث المشارك: محتوى البرنامج المتاح له، وسجلاته هو دون سجلات غيره */
export async function searchParticipant(userId: string, q: string): Promise<Hit[]> {
  const term = q.trim();
  if (term.length < 2) return [];
  const scope = await cohortWhere();

  const [materials, minutes, assignments, quizzes, cards, reports, reflections, fieldLogs, project, excuses] = await Promise.all([
    db.material.findMany({ where: { OR: [{ title: like(term) }, { author: like(term) }, { description: like(term) }] }, take: 10 }),
    db.sessionMinutes.findMany({ where: { ...scope, OR: [{ title: like(term) }, { minutes: like(term) }, { decisions: like(term) }] }, take: 10 }),
    db.assignment.findMany({ where: { ...scope, OR: [{ title: like(term) }, { description: like(term) }] }, take: 10 }),
    db.quiz.findMany({ where: { ...scope, published: true, title: like(term) }, take: 10 }),
    db.readingCard.findMany({ where: { userId, OR: [{ book: like(term) }, { benefit: like(term) }, { question: like(term) }] }, take: 10 }),
    db.weeklyReport.findMany({ where: { userId, OR: [{ benefits: like(term) }, { reading: like(term) }, { taskProgress: like(term) }, { difficulty: like(term) }] }, take: 10 }),
    db.reflection.findMany({ where: { userId, text: like(term) }, take: 10 }),
    db.fieldLog.findMany({ where: { userId, OR: [{ note: like(term) }, { mentorName: like(term) }] }, take: 10 }),
    db.graduationProject.findFirst({ where: { userId, OR: [{ topic: like(term) }, { problem: like(term) }] } }),
    db.excuseRequest.findMany({ where: { userId, reason: like(term) }, take: 10 }),
  ]);

  const weeks = (await getWeeks()).filter((w) =>
    [w.label, w.session, w.circle, w.reading, w.task, w.competency].some((v) => typeof v === "string" && v.includes(term)),
  );

  const hits: Hit[] = [];
  for (const m of materials) hits.push({ group: "مكتبة المواد", title: m.title, snippet: cut(m.description), meta: m.author ?? undefined, href: "/app/materials" });
  for (const m of minutes) hits.push({ group: "محاضر اللقاءات", title: m.title ?? `محضر الأسبوع ${m.week}`, snippet: cut(m.minutes), href: "/app/minutes" });
  for (const a of assignments) hits.push({ group: "المهام", title: a.title, snippet: cut(a.description), meta: `الأسبوع ${a.week}`, href: `/app/tasks/${a.id}` });
  for (const z of quizzes) hits.push({ group: "الاختبارات", title: z.title, href: `/app/quizzes/${z.id}` });
  for (const c of cards) hits.push({ group: "بطاقاتي القرائية", title: c.book, snippet: cut(c.benefit), href: "/app/reading" });
  for (const r of reports) hits.push({ group: "تقاريري الأسبوعية", title: `الأسبوع ${r.week}`, snippet: cut(r.benefits), href: `/app/reports/${r.week}` });
  for (const r of reflections) hits.push({ group: "دفتر التأمل", title: cut(r.text, 60) ?? "تدوينة", href: "/app/reflection" });
  for (const f of fieldLogs) hits.push({ group: "معايشتي الميدانية", title: f.mentorName, snippet: cut(f.note), href: "/app/field" });
  if (project) hits.push({ group: "مشروع التخرج", title: project.topic, snippet: cut(project.problem), href: "/app/project" });
  for (const e of excuses) hits.push({ group: "طلبات الاستئذان", title: e.reason.slice(0, 60), href: "/app/excuses" });
  for (const w of weeks) hits.push({ group: "جدول البرنامج", title: `الأسبوع ${w.label}`, snippet: cut(w.session), href: "/program/schedule" });
  return hits;
}
