import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "./db";

export const SESSION_COOKIE = "maalem_session";
const SESSION_DAYS = 30;

export type Role = "ADMIN" | "PARTICIPANT" | "MENTOR";

export type SessionUser = {
  id: string;
  username: string;
  name: string;
  role: Role;
};

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("AUTH_SECRET غير مضبوط أو قصير جداً");
  return new TextEncoder().encode(s);
}

export async function createSession(user: SessionUser) {
  const token = await new SignJWT({ u: user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret());
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    return (payload.u as SessionUser) ?? null;
  } catch {
    return null;
  }
}

/** المستخدم الحالي من الجلسة (بعد التحقق من وجوده وفعاليته في قاعدة البيانات). */
export const getSession = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const s = await verifyToken(token);
  if (!s) return null;
  const user = await db.user.findUnique({
    where: { id: s.id },
    select: { id: true, username: true, name: true, role: true, active: true },
  });
  if (!user || !user.active) return null;
  return { id: user.id, username: user.username, name: user.name, role: user.role as Role };
});

export async function requireUser(): Promise<SessionUser> {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}

export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const s = await requireUser();
  if (!roles.includes(s.role)) redirect(homeFor(s.role));
  return s;
}

export function homeFor(role: Role) {
  if (role === "ADMIN") return "/admin";
  if (role === "MENTOR") return "/mentor";
  return "/app";
}
