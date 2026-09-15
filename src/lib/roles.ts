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

/** وصفٌ موجز لما في منطقة كل دور — تعرضه صفحة الصلاحيات في اللوحة */
export const ROLE_AREA_LABELS: Record<Role, string> = {
  ADMIN: "إدارة البرنامج كاملةً: المشاركون والتقييم والمحتوى والمتابعة",
  PARTICIPANT: "سجلّات المشارك نفسه ومحتوى البرنامج المتاح له",
  MENTOR: "من رُبطوا به من المشاركين: معايشتهم وتقاريرهم ومهامهم",
};

/** لوحة الدور: الوجهة بعد تسجيل الدخول وعند فتح التطبيق */
export function homeFor(role: string): string {
  return AREA[role as Role] ?? "/login";
}

/**
 * مسارات خارج مناطق الأدوار لا يدخلها إلا مدير المشروع: خطة المشروع بمراحلها
 * ومخاطرها وميزانيتها ومصفوفة مهامه — شأن إدارةٍ لا محتوى برنامجٍ يُقرأ.
 * تُعرَّف هنا وحدها فيقرأها الوسيط والصفحات وصفحة مراجعة الصلاحيات معاً.
 */
export const ADMIN_ONLY = ["/program/manager", "/admin"];

/**
 * مسارات تُفتح بلا جلسة: واجهة التعريف، والدخول، ودليل التثبيت وما يخدمه.
 * وما عداها خلف الجلسة — ومنه وثيقة البرنامج ومركز المساعدة.
 */
export const PUBLIC_PATHS = ["/", "/login", "/install", "/setup", "/boot"];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.includes(pathname);
}

/** الدور الذي يملك هذا المسار، أو null إن كان مفتوحاً لكل من دخل */
export function areaOwner(pathname: string): Role | null {
  for (const p of ADMIN_ONLY) {
    if (pathname === p || pathname.startsWith(p + "/")) return "ADMIN";
  }
  for (const role of ROLES) {
    const base = AREA[role];
    if (pathname === base || pathname.startsWith(base + "/")) return role;
  }
  return null;
}

/** كعكة وضع المعاينة: تسمح لمدير المشروع بتصفّح منطقة المشارك للقراءة فقط */
export const PREVIEW_COOKIE = "maalem_preview";

/**
 * هل يملك هذا الدور حق الوصول إلى المسار؟
 * الاستثناء الوحيد: مدير المشروع في وضع المعاينة يدخل منطقة المشارك للقراءة فقط،
 * وبحسابه هو، فلا يرى سجلات أي مشارك آخر.
 */
export function canAccess(role: string, pathname: string, preview = false): boolean {
  const owner = areaOwner(pathname);
  if (owner === null || owner === role) return true;
  return preview && role === "ADMIN" && owner === "PARTICIPANT";
}

/** وجهة آمنة بعد الدخول: تُحترم فقط إن كانت داخل منطقة الدور نفسه */
export function safeDestination(role: string, next?: string | null): string {
  if (next && next.startsWith("/") && !next.startsWith("//") && canAccess(role, next)) return next;
  return homeFor(role);
}
