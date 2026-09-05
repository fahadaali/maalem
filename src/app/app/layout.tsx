import AppShell from "@/components/shell/AppShell";
import { requireRole } from "@/lib/auth";
import { PARTICIPANT_NAV } from "./nav";

export default async function ParticipantLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("PARTICIPANT");
  return (
    <AppShell user={user} items={PARTICIPANT_NAV.filter((i) => !(i.href === "/app/more"))} base="/app">
      {children}
    </AppShell>
  );
}
