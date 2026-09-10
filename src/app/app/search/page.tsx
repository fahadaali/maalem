import { requireParticipantView } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import SearchResults from "@/components/SearchResults";
import { searchParticipant } from "@/lib/search";

export const metadata = { title: "البحث" };

export default async function ParticipantSearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireParticipantView();
  const { q = "" } = await searchParams;
  const hits = await searchParticipant(user.id, q);
  return (
    <>
      <PageHeader title="البحث" subtitle="محتوى البرنامج المتاح لك، وسجلاتك أنت: بطاقاتك، وتقاريرك، وتأملاتك، ومعايشتك. لا تظهر لك سجلات غيرك." />
      <form className="flex gap-2 mb-4" action="/app/search">
        <input name="q" className="input" defaultValue={q} placeholder="اكتب ما تبحث عنه…" autoFocus aria-label="نص البحث" />
        <button className="btn" type="submit">بحث</button>
      </form>
      <SearchResults hits={hits} term={q} />
    </>
  );
}
