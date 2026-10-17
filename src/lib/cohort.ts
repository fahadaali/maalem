import { cache } from "react";
import { db } from "./db";
import { schedulePause, type SchedulePause } from "./pause";

export type CohortState = { id: string; name: string; pause?: SchedulePause };

/**
 * الدفعة النشطة بحالة إيقافها — تُقرأ مرة واحدة في كل طلب.
 *
 * محروسةٌ كأختها `activeCohort` أدناه، وللسبب نفسه: تُقرأ في مواضع كثيرة جداً
 * عبر `cohortWhere`، فرميُها كان يُسقط الصفحة كلَّها على قاعدةٍ لم تُهيّأ بعد.
 * ولا يُحرس `ensureCohort()` في `requireCohortId`: عدمُ حراسته هو ما يمنع إنشاء
 * دفعةٍ مكرّرة عند عثرةٍ عابرة.
 *
 * وحالة الإيقاف تُقرأ في الاستعلام نفسه فلا يكلّف الجدولُ استعلاماً زائداً. وإن
 * لم يُطبَّق ترحيلها بعد أُعيدت القراءة بالمعرّف وحده: لو ضاعت الدفعة النشطة
 * لصار `cohortWhere` بلا شرط، فاختلطت الدفعات في كل صفحة.
 */
export const activeCohortState = cache(async (): Promise<CohortState | null> => {
  try {
    const c = await db.cohort.findFirst({ where: { active: true }, select: { id: true, name: true, pausedAt: true, pauseReason: true, pauseUntil: true, pauses: true } });
    return c ? { id: c.id, name: c.name, pause: schedulePause(c) } : null;
  } catch {
    try {
      const c = await db.cohort.findFirst({ where: { active: true }, select: { id: true, name: true } });
      return c ? { id: c.id, name: c.name } : null;
    } catch {
      return null;
    }
  }
});

/** معرّف الدفعة النشطة */
export const activeCohortId = cache(async (): Promise<string | null> => (await activeCohortState())?.id ?? null);

/** حالة إيقاف الدفعة النشطة — لمن يكتب عدّاد التأخير ولا جدول في يده */
export async function cohortPause(): Promise<SchedulePause | undefined> {
  return (await activeCohortState())?.pause;
}

/** الإيقاف المفتوح للدفعة النشطة، إن كانت موقوفة */
export async function activePause(): Promise<(SchedulePause & { since: number }) | null> {
  const p = (await activeCohortState())?.pause;
  return p?.since != null ? (p as SchedulePause & { since: number }) : null;
}

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
