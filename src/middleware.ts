import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "maalem_session";

type Claims = { u?: { id: string; role: string }; exp?: number };

/**
 * قراءة حمولة الرمز دون تحقق من التوقيع — للتوجيه فقط.
 * التحقق الفعلي يجري في كل صفحة وإجراء عبر requireUser/requireRole،
 * فالوسيط طبقة تنقّل لا طبقة صلاحيات.
 */
function decodeClaims(token: string): Claims["u"] | null {
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
  if (pathname.startsWith("/admin") && session.role !== "ADMIN") {
    return NextResponse.redirect(new URL(session.role === "MENTOR" ? "/mentor" : "/app", req.url));
  }
  if (pathname.startsWith("/mentor") && session.role !== "MENTOR" && session.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/app", req.url));
  }
  if (pathname.startsWith("/app") && session.role !== "PARTICIPANT" && session.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/mentor", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/admin/:path*", "/mentor/:path*"],
};
