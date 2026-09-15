import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { homeFor } from "@/lib/roles";

export const metadata = { title: "المساعدة", robots: { index: false, follow: false } };

/**
 * بابٌ واحد للمساعدة: كانت صفحةً عامة تعرض أسئلة الأدوار الأربعة لكل زائر —
 * ومنها قسم مدير المشروع بروابطه إلى لوحته. فصارت مساعدةُ كل دورٍ في منطقته،
 * وهذا المسار يوجّه إليها فلا تنكسر روابط قديمة ولا إشارة في إشعار.
 */
export default async function HelpRedirect() {
  const user = await requireUser();
  redirect(`${homeFor(user.role)}/help`);
}
