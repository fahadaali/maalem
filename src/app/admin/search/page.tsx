import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import SearchResults from "@/components/SearchResults";
import { searchAdmin } from "@/lib/search";

export const metadata = { title: "البحث" };

export default async function AdminSearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireRole("ADMIN");
  const { q = "" } = await searchParams;
  const hits = await searchAdmin(q);
  return (
    <>
      <PageHeader title="البحث في المنصة" subtitle="الأشخاص، والمواد، والمحاضر، والتقارير، والبطاقات، والمهام، والاختبارات، وبنك الأسئلة، والكفاءات، والمعايشة، والمشاريع، والجدول." />
      <form className="flex gap-2 mb-4" action="/admin/search">
        <input name="q" className="input" defaultValue={q} placeholder="اكتب ما تبحث عنه…" autoFocus aria-label="نص البحث" />
        <button className="btn" type="submit">بحث</button>
      </form>
      <SearchResults hits={hits} term={q} />
    </>
  );
}
