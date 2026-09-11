import { requireRole } from "@/lib/auth";
import MoreGrid from "@/components/shell/MoreGrid";
import { MENTOR_NAV } from "../nav";

export const metadata = { title: "المزيد" };

export default async function MentorMorePage() {
  await requireRole("MENTOR");
  return <MoreGrid items={MENTOR_NAV} base="/mentor" />;
}
