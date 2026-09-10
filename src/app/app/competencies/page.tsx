import { requireParticipantView } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import CompetencyCard from "@/components/CompetencyCard";
import { computeCompetencies, overallAttainment } from "@/lib/competencies";

export const metadata = { title: "بطاقة الكفاءات" };

export default async function CompetenciesPage() {
  const user = await requireParticipantView();
  const rows = await computeCompetencies(user.id);
  return (
    <>
      <PageHeader title="بطاقة الكفاءات" subtitle="أين تقف من الكفاءات الثماني التي بُني عليها البرنامج، وبأي شاهد." />
      <CompetencyCard rows={rows} overall={overallAttainment(rows)} />
    </>
  );
}
