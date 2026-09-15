import AppShell from "@/components/shell/AppShell";
import { isPreview, requireParticipantView } from "@/lib/auth";
import PreviewBanner from "@/components/PreviewBanner";
import { PARTICIPANT_NAV } from "./nav";

/** لا تُفهرس: منطقة خلف الجلسة */
export const metadata = { robots: { index: false, follow: false } };

export default async function ParticipantLayout({ children }: { children: React.ReactNode }) {
  const user = await requireParticipantView();
  const preview = user.role === "ADMIN" && (await isPreview());
  return (
    <AppShell user={user} items={PARTICIPANT_NAV} base="/app">
      {preview && <PreviewBanner />}
      <div className={preview ? "preview-readonly" : undefined}>{children}</div>
    </AppShell>
  );
}
