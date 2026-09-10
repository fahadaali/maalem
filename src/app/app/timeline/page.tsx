import { requireParticipantView } from "@/lib/auth";
import { PageHeader, Card } from "@/components/ui";
import Timeline from "@/components/Timeline";
import { buildTimeline } from "@/lib/timeline";

export const metadata = { title: "سجل نشاطي" };

export default async function MyTimelinePage() {
  const user = await requireParticipantView();
  const entries = await buildTimeline(user.id, 150);
  return (
    <>
      <PageHeader title="سجل نشاطي" subtitle="أثرك في البرنامج مرتباً بالزمن: بطاقاتك، وتقاريرك، ومهامك، واختباراتك، ومعايشتك، وما اعتُمد لك." />
      <Card>
        <Timeline entries={entries} />
      </Card>
    </>
  );
}
