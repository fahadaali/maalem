/** أنواع الأسئلة وتصحيحها */

export const QUESTION_KINDS = { MCQ: "اختيار من متعدد", TRUEFALSE: "صواب وخطأ", SHORT: "إجابة قصيرة" } as const;
export type QuestionKind = keyof typeof QUESTION_KINDS;

export const TRUE_FALSE_OPTIONS = ["صواب", "خطأ"];

export const QUIZ_TOPICS = { FIQH: "فقه", QURAN: "قرآن", OTHER: "أخرى" } as const;

/**
 * تسوية النص العربي قبل المقارنة: تُحذف التشكيل والتطويل وعلامات الترقيم،
 * وتوحَّد صور الألف والياء والتاء المربوطة، ليقبل التصحيح صور الكتابة المختلفة.
 */
export function normalizeArabic(input: string): string {
  return input
    .replace(/[ً-ْٰـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export type Gradable = { kind: string; correctIndex: number; answers?: string | null };

/** هل إجابة المشارك صحيحة؟ للاختيار رقم، وللإجابة القصيرة نص يُقارن بعد التسوية */
export function isCorrect(q: Gradable, given: number | string | null): boolean {
  if (given === null || given === undefined) return false;
  if (q.kind === "SHORT") {
    const accepted = (q.answers ?? "").split("|").map(normalizeArabic).filter(Boolean);
    if (!accepted.length) return false;
    return accepted.includes(normalizeArabic(String(given)));
  }
  return Number(given) === q.correctIndex;
}
