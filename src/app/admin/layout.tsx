import AppShell from "@/components/shell/AppShell";
import { requireRole } from "@/lib/auth";
import { ADMIN_NAV } from "./nav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("ADMIN");
  return (
    <AppShell user={user} items={ADMIN_NAV} base="/admin">
      {children}
    </AppShell>
  );
}
