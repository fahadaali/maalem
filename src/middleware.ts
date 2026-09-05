import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE = "maalem_session";

async function readSession(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.AUTH_SECRET ?? ""));
    return payload.u as { id: string; role: string } | undefined;
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = await readSession(req);

  if (pathname === "/login") {
    if (session) {
      const home = session.role === "ADMIN" ? "/admin" : session.role === "MENTOR" ? "/mentor" : "/app";
      return NextResponse.redirect(new URL(home, req.url));
    }
    return NextResponse.next();
  }

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
  matcher: ["/app/:path*", "/admin/:path*", "/mentor/:path*", "/login"],
};
