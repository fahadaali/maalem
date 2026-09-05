import AppShell from "@/components/shell/AppShell";
import { requireRole } from "@/lib/auth";
import { PARTICIPANT_NAV } from "./nav";

export default async function ParticipantLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("PARTICIPANT", "ADMIN");
  const items = user.role === "ADMIN" ? [{ ...PARTICIPANT_NAV[0] }, ...PARTICIPANT_NAV.slice(1)] : PARTICIPANT_NAV;
  return (
    <AppShell user={user} items={items.filter((i) => !(i.href === "/app/more"))} base="/app">
      {children}
    </AppShell>
  );
}
