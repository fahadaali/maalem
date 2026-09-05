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

export function str(v: FormDataEntryValue | null | undefined): string {
  return typeof v === "string" ? v.trim() : "";
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
