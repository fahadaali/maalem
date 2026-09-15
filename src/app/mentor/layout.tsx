import AppShell from "@/components/shell/AppShell";
import { requireRole } from "@/lib/auth";
import { MENTOR_NAV } from "./nav";

/** لا تُفهرس: منطقة خلف الجلسة */
export const metadata = { robots: { index: false, follow: false } };

export default async function MentorLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("MENTOR");
  return (
    <AppShell user={user} items={MENTOR_NAV} base="/mentor">
      {children}
    </AppShell>
  );
}
