import { cache } from "react";
import { db } from "./db";
import { cohortWhere } from "./cohort";
import { BOOKS, CHARTER, CONTINUOUS_ASSESSMENT, PROJECT_RUBRIC, COMPLETION_LEVELS, COMPETENCIES, type Competency } from "./program";

/**
 * محتوى الوثيقة القابل للتحرير من اللوحة: الكتب، وبنود الميثاق، وأوزان التقويم،
 * ومستويات الإتمام، ومصفوفة الكفاءات. يُقرأ من قاعدة البيانات لكل دفعة،
 * فإن لم تُبذر بعد فمن نص الخطة الأصلي كما هو.
 */

export type Book = { order: number; title: string; author: string; pages: number; weeks: string; circle: string; availability: string };
export type AssessmentRow = { key: string; label: string; points: number; tool: string | null; minimum: string | null; description: string | null };
export type Level = { min: number; level: string; certificate: string };

export const getBooks = cache(async (): Promise<Book[]> => {
  try {
    const rows = await db.programBook.findMany({ where: await cohortWhere(), orderBy: { order: "asc" } });
    if (rows.length) return rows.map((r) => ({ order: r.order, title: r.title, author: r.author, pages: r.pages, weeks: r.weeks, circle: r.circle, availability: r.availability }));
  } catch {
    // القاعدة غير مهيأة بعد
  }
  return BOOKS.map((b) => ({ ...b }));
});

export async function getBookTitles(): Promise<string[]> {
  return (await getBooks()).filter((b) => b.pages > 0).map((b) => b.title);
}

export const getCharter = cache(async (): Promise<string[]> => {
  try {
    const rows = await db.charterItem.findMany({ where: await cohortWhere(), orderBy: { order: "asc" } });
    if (rows.length) return rows.map((r) => r.text);
  } catch {
    // القاعدة غير مهيأة بعد
  }
  return [...CHARTER];
});

const assessment = cache(async (kind: "CONTINUOUS" | "PROJECT"): Promise<AssessmentRow[]> => {
  try {
    const rows = await db.assessmentItem.findMany({ where: { kind, ...(await cohortWhere()) }, orderBy: { order: "asc" } });
    if (rows.length) return rows.map((r) => ({ key: r.key, label: r.label, points: r.points, tool: r.tool, minimum: r.minimum, description: r.description }));
  } catch {
    // القاعدة غير مهيأة بعد
  }
  return kind === "CONTINUOUS"
    ? CONTINUOUS_ASSESSMENT.map((c) => ({ key: c.key, label: c.component, points: c.points, tool: c.tool, minimum: c.minimum, description: null }))
    : PROJECT_RUBRIC.map((r) => ({ key: r.key, label: r.criterion, points: r.points, tool: null, minimum: null, description: r.description }));
});

export async function getContinuous(): Promise<AssessmentRow[]> {
  return assessment("CONTINUOUS");
}

export async function getProjectRubric(): Promise<AssessmentRow[]> {
  return assessment("PROJECT");
}

export const getCompletionLevels = cache(async (): Promise<Level[]> => {
  try {
    const rows = await db.completionLevel.findMany({ where: await cohortWhere(), orderBy: { min: "desc" } });
    if (rows.length) return rows.map((r) => ({ min: r.min, level: r.level, certificate: r.certificate }));
  } catch {
    // القاعدة غير مهيأة بعد
  }
  return COMPLETION_LEVELS.map((l) => ({ ...l }));
});

export const getCompetencies = cache(async (): Promise<Competency[]> => {
  try {
    const rows = await db.competencyDef.findMany({ where: await cohortWhere(), orderBy: { order: "asc" }, include: { items: { orderBy: { order: "asc" } } } });
    if (rows.length) {
      return rows.map((c) => ({
        slug: c.slug,
        order: c.order,
        name: c.name,
        weight: c.weight,
        intro: c.intro,
        items: c.items.map((i) => ({
          title: i.title, program: i.program, indicator: i.indicator, tasks: i.tasks,
          schedule: i.schedule, cost: i.cost, evidence: i.evidence,
          references: i.refs.split("\n").map((r) => r.trim()).filter(Boolean),
        })),
      }));
    }
  } catch {
    // القاعدة غير مهيأة بعد
  }
  return COMPETENCIES;
});

export async function levelForTotal(total: number): Promise<Level> {
  const levels = await getCompletionLevels();
  return levels.find((l) => total >= l.min) ?? levels[levels.length - 1];
}

export type BookProgress = Book & { furthestPage: number; cards: number; percent: number; lastDate: Date | null };

/** تقدّم القراءة في كل كتاب: أبعد صفحة بلغها المشارك، وعدد بطاقاته فيه */
export async function bookProgress(userId: string): Promise<BookProgress[]> {
  const books = await getBooks();
  const cards = await db.readingCard.findMany({
    where: { userId },
    select: { book: true, toPage: true, date: true },
  });
  return books.map((b) => {
    const mine = cards.filter((c) => c.book === b.title);
    const furthestPage = mine.reduce((m, c) => Math.max(m, c.toPage), 0);
    const lastDate = mine.reduce<Date | null>((m, c) => (!m || c.date > m ? c.date : m), null);
    return {
      ...b,
      furthestPage,
      cards: mine.length,
      percent: b.pages > 0 ? Math.min(100, Math.round((furthestPage / b.pages) * 100)) : 0,
      lastDate,
    };
  });
}

/**
 * ما يُتوقع من المشارك عبر البرنامج، مشتقاً من عدد الأسابيع التطويرية في جدول
 * الدفعة لا من رقم ثابت، فيتبع أي تقصير أو تمديد يجريه مدير المشروع.
 */
export const programExpectations = cache(async () => {
  const { getWeeks } = await import("./weeks");
  const weeks = await getWeeks();
  const developmental = weeks.filter((w) => w.number >= 1 && w.number <= 12).length || 12;
  return {
    weeks: developmental,
    cards: developmental * 5, // خمس بطاقات أسبوعياً
    reports: developmental,
    fieldHours: developmental, // ساعة معايشة أسبوعياً
  };
});
