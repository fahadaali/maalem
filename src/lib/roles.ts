/**
 * قواعد الأدوار ومناطق المنصة — بلا اعتماد على قاعدة البيانات
 * ليستعملها الوسيط والخادم معاً. لكل دور منطقة واحدة لا يتجاوزها.
 */
export type Role = "ADMIN" | "PARTICIPANT" | "MENTOR";

export const ROLES: Role[] = ["ADMIN", "PARTICIPANT", "MENTOR"];

/** المنطقة الخاصة بكل دور */
export const AREA: Record<Role, string> = {
  ADMIN: "/admin",
  PARTICIPANT: "/app",
  MENTOR: "/mentor",
};

/** لوحة الدور: الوجهة بعد تسجيل الدخول وعند فتح التطبيق */
export function homeFor(role: string): string {
  return AREA[role as Role] ?? "/login";
}

/** الدور الذي يملك هذا المسار، أو null إن كان مساراً عاماً */
export function areaOwner(pathname: string): Role | null {
  for (const role of ROLES) {
    const base = AREA[role];
    if (pathname === base || pathname.startsWith(base + "/")) return role;
  }
  return null;
}

/** هل يملك هذا الدور حق الوصول إلى المسار؟ */
export function canAccess(role: string, pathname: string): boolean {
  const owner = areaOwner(pathname);
  return owner === null || owner === role;
}

/** وجهة آمنة بعد الدخول: تُحترم فقط إن كانت داخل منطقة الدور نفسه */
export function safeDestination(role: string, next?: string | null): string {
  if (next && next.startsWith("/") && !next.startsWith("//") && canAccess(role, next)) return next;
  return homeFor(role);
}
