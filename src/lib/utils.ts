export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: "مدير المشروع",
  PARTICIPANT: "مشارك",
  MENTOR: "مشرف مرافق",
};

export const ATTENDANCE_LABELS: Record<string, string> = {
  PRESENT: "حاضر",
  LATE: "متأخر",
  EXCUSED: "معذور",
  ABSENT: "غائب",
};

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  PROPOSED: "مقترح — بانتظار الاعتماد",
  APPROVED: "معتمد",
  DRAFT: "مسودة مسلّمة",
  FINAL: "نسخة نهائية مسلّمة",
  JUDGED: "محكّم",
};

const DATE_LIKE = /^(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d(:[0-5]\d(\.\d+)?)?([+-][0-2]\d:[0-5]\d|Z))$|^\d{4}-[0-1]\d-[0-3]\d [0-2]\d:[0-5]\d:[0-5]\d$/;

/** نص من نموذج، مع منع النصوص المطابقة تماماً لصيغة تاريخ كامل (يخلط محوّل D1 بينها وبين حقول التاريخ) */
export function str(v: FormDataEntryValue | null | undefined): string {
  const t = typeof v === "string" ? v.trim() : "";
  return DATE_LIKE.test(t) ? `\u200f${t}` : t;
}

export function num(v: FormDataEntryValue | null | undefined, fallback = 0): number {
  const n = Number(str(v));
  return Number.isFinite(n) ? n : fallback;
}

export function parseJSON<T>(s: string, fallback: T): T {
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}
