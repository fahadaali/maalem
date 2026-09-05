import { NextResponse, type NextRequest } from "next/server";
import { canAccess, homeFor } from "@/lib/roles";

const SESSION_COOKIE = "maalem_session";

type Claims = { u?: { id: string; role: string }; exp?: number };

/**
 * قراءة حمولة الرمز دون تحقق من التوقيع — للتوجيه فقط.
 * التحقق الفعلي من التوقيع والدور يجري في كل صفحة وإجراء عبر requireRole،
 * فالوسيط طبقة تنقّل لا طبقة صلاحيات.
 */
function decodeClaims(token: string): NonNullable<Claims["u"]> | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
    const claims = JSON.parse(decodeURIComponent(escape(json))) as Claims;
    if (claims.exp && claims.exp * 1000 < Date.now()) return null;
    return claims.u ?? null;
  } catch {
    return null;
  }
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? decodeClaims(token) : null;

  if (!session) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  // كل دور في منطقته: أي محاولة خروج تُعاد إلى لوحته
  if (!canAccess(session.role, pathname)) {
    return NextResponse.redirect(new URL(homeFor(session.role), req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/admin/:path*", "/mentor/:path*"],
};
