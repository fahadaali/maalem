/**
 * أنواع الإدخال التي يُرجعها مدير المشروع إلى أصحابها، ومساعداتٌ نقية عليها.
 * منطق الإرجاع نفسه — من يملك السجل، وأين يُعدَّل، وما موعده — في `items.ts`؛
 * وهذه تُقرأ من الدرجات والحالات بلا قاعدة بيانات.
 */

export const RETURN_KINDS = {
  SUBMISSION: "تسليم مهمة",
  WEEKLY_REPORT: "تقرير أسبوعي",
  READING_CARD: "بطاقة قراءة",
  LEARNING_PLAN: "خطة التعلم",
  FIELD_LOG: "سجل معايشة",
  LEADERSHIP: "نشاط قيادي",
  PROJECT: "مشروع التخرج",
} as const;

export type ReturnKind = keyof typeof RETURN_KINDS;

export function isReturnKind(v: string): v is ReturnKind {
  return Object.prototype.hasOwnProperty.call(RETURN_KINDS, v);
}

export type OpenReturn = { id: string; kind: string; recordId: string; note: string; returnedAt: Date; returnedBy: string };

/** معرّفات سجلات نوعٍ بعينه عليها إرجاعٌ مفتوح */
export function returnedIds(returns: OpenReturn[], kind: ReturnKind): Set<string> {
  return new Set(returns.filter((r) => r.kind === kind).map((r) => r.recordId));
}

/** الإرجاع المفتوح على سجلٍّ بعينه، إن وُجد */
export function openReturnFor(returns: OpenReturn[], kind: ReturnKind, recordId: string): OpenReturn | undefined {
  return returns.find((r) => r.kind === kind && r.recordId === recordId);
}
