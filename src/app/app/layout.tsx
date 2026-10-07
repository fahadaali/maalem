import AppShell from "@/components/shell/AppShell";
import { isPreview, requireParticipantView } from "@/lib/auth";
import PreviewBanner from "@/components/PreviewBanner";
import { PARTICIPANT_NAV } from "./nav";
import { optional } from "@/lib/db";
import { getObligations } from "@/lib/obligations";

/** لا تُفهرس: منطقة خلف الجلسة */
export const metadata = { robots: { index: false, follow: false } };

export default async function ParticipantLayout({ children }: { children: React.ReactNode }) {
  const user = await requireParticipantView();
  const preview = user.role === "ADMIN" && (await isPreview());
  /**
   * عدّاد «مهامي»: ما تأخّر وما أُرجع للتعديل. من صفوف المشارك المجلوبة مرة واحدة
   * في الطلب، فالصفحة التي تقرؤها أيضاً — «مهامي» والرئيسية — لا تدفع ثمنها مرتين.
   * زينةٌ لا تُسقط الصفحة، ولا تُحسب في المعاينة: حساب المدير ليس حساب مشارك.
   */
  const outstanding = preview ? 0 : ((await optional(() => getObligations(user.id), null, "shell.obligations-skipped"))?.outstanding ?? 0);
  return (
    <AppShell user={user} items={PARTICIPANT_NAV} base="/app" badges={{ "/app/tasks": outstanding }}>
      {preview && <PreviewBanner />}
      <div className={preview ? "preview-readonly" : undefined}>{children}</div>
    </AppShell>
  );
}
