import MoreGrid from "@/components/shell/MoreGrid";
import { PARTICIPANT_NAV } from "../nav";

export const metadata = { title: "المزيد" };

export default function MorePage() {
  return <MoreGrid items={PARTICIPANT_NAV} base="/app" />;
}
