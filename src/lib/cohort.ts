import { cache } from "react";
import { db } from "./db";

/**
 * معرّف الدفعة النشطة — يُقرأ مرة واحدة في كل طلب.
 *
 * محروسٌ كأخته `activeCohort` أدناه، وللسبب نفسه: يُقرأ في مواضع كثيرة جداً
 * عبر `cohortWhere`، فرميُه كان يُسقط الصفحة كلَّها على قاعدةٍ لم تُهيّأ بعد.
 * ولا يُحرس `ensureCohort()` في `requireCohortId`: عدمُ حراسته هو ما يمنع إنشاء
 * دفعةٍ مكرّرة عند عثرةٍ عابرة.
 */
export const activeCohortId = cache(async (): Promise<string | null> => {
  try {
    const c = await db.cohort.findFirst({ where: { active: true }, select: { id: true } });
    return c?.id ?? null;
  } catch {
    return null;
  }
});

/**
 * الدفعة النشطة كاملةً — لعرض اسمها. تُردّ بلا شيء إن تعذّرت القراءة، كما تفعل
 * `getWeeks` و`getBooks` وأخواتها: صفحات وثيقة البرنامج تُبنى ساكنةً وقت البناء
 * حيث لا قاعدة بيانات أصلاً، فرميُها هنا كان يُسقط البناء كله.
 */
export const activeCohort = cache(async () => {
  try {
    return await db.cohort.findFirst({ where: { active: true } });
  } catch {
    // القاعدة غير مهيأة بعد، أو لا وصول إليها وقت البناء
    return null;
  }
});

/** شرط التصفية بالدفعة النشطة، يُدمج في استعلامات prisma */
export async function cohortWhere(): Promise<{ cohortId: string } | Record<string, never>> {
  const id = await activeCohortId();
  return id ? { cohortId: id } : {};
}

/** شرط المشاركين النشطين في الدفعة الحالية */
export async function participantsWhere(extra: Record<string, unknown> = {}) {
  return { role: "PARTICIPANT", active: true, ...(await cohortWhere()), ...extra };
}

/** معرّف الدفعة النشطة مضموناً — ينشئ الدفعة الأولى إن لم تكن موجودة */
export async function requireCohortId(): Promise<string> {
  const id = await activeCohortId();
  if (id) return id;
  const { ensureCohort } = await import("./setup");
  return ensureCohort();
}
