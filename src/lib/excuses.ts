export const EXCUSE_KINDS = {
  ABSENCE_INPERSON: "استئذان عن اللقاء الحضوري",
  ABSENCE_REMOTE: "استئذان عن حلقة النقاش",
  EXTENSION: "تأجيل تسليم مهمة",
} as const;

export type ExcuseKind = keyof typeof EXCUSE_KINDS;

export const EXCUSE_STATUS: Record<string, string> = {
  PENDING: "قيد النظر",
  APPROVED: "مقبول",
  REJECTED: "غير مقبول",
};

export function isExcuseKind(v: string): v is ExcuseKind {
  return v in EXCUSE_KINDS;
}
