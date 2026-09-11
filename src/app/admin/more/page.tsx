import { requireRole } from "@/lib/auth";
import MoreGrid from "@/components/shell/MoreGrid";
import { ADMIN_NAV } from "../nav";

export const metadata = { title: "المزيد" };

export default async function AdminMorePage() {
  await requireRole("ADMIN");
  return <MoreGrid items={ADMIN_NAV} base="/admin" />;
}
