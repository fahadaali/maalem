import { weekResolver, type LiveWeek } from "./weeks";

/**
 * نصاب الورد القرائي من جدول الأسبوع نفسه.
 *
 * كانت البطاقة تُحسب «يوماً» واحداً من خمسة مهما بلغت صفحاتها: من قرأ مئة صفحة
 * في جلسة وكتبها في بطاقة واحدة حُسبت له بطاقة، ومن كتب خمس بطاقات بعشر صفحات
 * حُسب له الأسبوع كاملاً. والمطلوب في الجدول يختلف من أسبوع إلى أسبوع — اثنتان
 * وستون صفحة في أسبوع، وتسع وثلاثون في آخر — فصار المقدار صفحاتٍ تُقاس بنصاب
 * أسبوعها كما كتبه مدير المشروع في «الورد القرائي»، لا عدداً من البطاقات.
 *
 * (ليس من هذا `ReadingProgress`: ذاك موضع القارئ في ملفٍّ مفتوح.)
 */

/** أيام الورد في الأسبوع: الأحد إلى الخميس */
export const READING_DAYS = 5;

/** نصاب الأسبوع حين يخلو نصّه من أرقام صفحات — «قراءة حرة»: عشر صفحات يومياً كما في الخطة */
export const DEFAULT_WEEKLY_PAGES = 10 * READING_DAYS;

export type Quota = {
  /** صفحات الأسبوع المطلوبة */
  pages: number;
  /** نصيب اليوم الواحد منها */
  daily: number;
  /** أُخذ من أرقام النص، لا تقديراً افتراضياً */
  parsed: boolean;
};

/** «—» في جدول البرنامج تعني «لا شيء هنا» */
const empty = (t: string) => !t.trim() || /^[\s—–-]+$/.test(t);

/** الأرقام الهندية والفارسية إلى لاتينية، وكل الشُّرَط إلى شرطة واحدة */
function normalize(text: string): string {
  return text
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[–—−‒―]/g, "-")
    .replace(/\s+إلى\s+/g, "-");
}

/**
 * صفحات النص: كلُّ «ص 71–132» أو «صفحة 50» فيه. المدى المعكوس يُقلب، والصفحة
 * المفردة صفحة واحدة. ولا يُقرأ رقمٌ لا تسبقه «ص» — «الأسبوع 3» ليس صفحة.
 */
export function pagesInText(text: string): number | null {
  const t = normalize(text);
  const re = /(?:ص\.?|صفحة|صفحات)\s*(\d+)(?:\s*-\s*(\d+))?/g;
  let total = 0;
  let found = false;
  for (const m of t.matchAll(re)) {
    const a = Number(m[1]);
    const b = m[2] != null ? Number(m[2]) : a;
    const [lo, hi] = a <= b ? [a, b] : [b, a];
    if (lo < 1) continue;
    total += hi - lo + 1;
    found = true;
  }
  return found ? total : null;
}

/**
 * نصاب أسبوعٍ بعينه، أو لا نصاب. الورد مطلوب من الافتتاحي حتى الثاني عشر وحدها،
 * ويُفحص ذلك قبل التقدير الافتراضي: نصُّ الأسبوع الاحتياطي «استدراك» بلا أرقام،
 * ولو قُدِّر له خمسون لصار الاستدراكُ نفسه ديناً جديداً.
 */
export function weekQuota(week: Pick<LiveWeek, "number" | "reading">): Quota | null {
  if (week.number < 0 || week.number > 12) return null;
  if (empty(week.reading ?? "")) return null;
  const parsed = pagesInText(week.reading);
  const pages = parsed ?? DEFAULT_WEEKLY_PAGES;
  return { pages, daily: pages / READING_DAYS, parsed: parsed != null };
}

/** صفحات البطاقة: من صفحة إلى صفحة، شاملةً الطرفين */
export function cardPages(c: { fromPage: number; toPage: number }): number {
  return Math.max(0, c.toPage - c.fromPage + 1);
}

/** كم يوماً من ورد الأسبوع تعادل هذه الصفحات — للعرض وحده، مقرَّباً إلى نصف يوم */
export function equivalentDays(pages: number, quota: Quota | null): number {
  const daily = quota?.daily ?? DEFAULT_WEEKLY_PAGES / READING_DAYS;
  return Math.round((pages / daily) * 2) / 2;
}

export { daysLabel } from "./utils";

export type WeekReading = {
  week: number;
  quota: Quota;
  /** صفحات بطاقاته المحتسبة في هذا الأسبوع */
  read: number;
  cards: number;
};

type CardRow = { id: string; date: Date; fromPage: number; toPage: number };

/**
 * القراءة أسبوعاً أسبوعاً: لكل أسبوع له نصاب، ما قُرئ فيه بتاريخ بطاقاته. للعرض
 * ولبنود «مهامي»؛ وأما الدرجة فتراكمية (`readingTotals`) فلا يضيع استدراك.
 * `exclude`: البطاقات المُرجَعة إلى أصحابها، لا تُحسب حتى تُعاد.
 */
export function readingByWeek(cards: CardRow[], weeks: LiveWeek[], exclude?: ReadonlySet<string>): WeekReading[] {
  const weekOf = weekResolver(weeks);
  const byWeek = new Map<number, { read: number; cards: number }>();
  for (const c of cards) {
    if (exclude?.has(c.id)) continue;
    const n = weekOf(c.date);
    if (n == null) continue;
    const cur = byWeek.get(n) ?? { read: 0, cards: 0 };
    cur.read += cardPages(c);
    cur.cards += 1;
    byWeek.set(n, cur);
  }
  const out: WeekReading[] = [];
  for (const w of [...weeks].sort((a, b) => a.number - b.number)) {
    const quota = weekQuota(w);
    if (!quota) continue;
    const got = byWeek.get(w.number) ?? { read: 0, cards: 0 };
    out.push({ week: w.number, quota, read: got.read, cards: got.cards });
  }
  return out;
}

export type ReadingTotals = {
  /** صفحات كل البطاقات المحتسبة، أينما وقعت تواريخها */
  read: number;
  /** نصاب البرنامج كله: مجموع أنصبة الأسابيع 0–12 */
  required: number;
  /** نصاب ما مضى من الأسابيع حتى `now` — للتأخر لا للدرجة */
  requiredSoFar: number;
  /** النسبة التراكمية المحصورة في 0..1 — وهي ما يدخل الدرجة */
  ratio: number;
};

/**
 * القراءة تراكمياً. الدرجة من هنا لا من الأسابيع منفردةً: من فاته أسبوعٌ فقرأ
 * ضعفه في الذي يليه — أو في الأسبوع الاحتياطي المخصّص للاستدراك — استدرك، ولو
 * حُصر كل أسبوع في نصابه لما نفعه ذلك شيئاً.
 *
 * «ما مضى» يُعدّ بأسبوعٍ انتهى خميسُه: الأسبوع الجاري لا يُطالَب بنصابه كاملاً
 * إلا بعد انقضاء أيام وِرده.
 */
export function readingTotals(cards: CardRow[], weeks: LiveWeek[], now: Date, exclude?: ReadonlySet<string>): ReadingTotals {
  let read = 0;
  for (const c of cards) if (!exclude?.has(c.id)) read += cardPages(c);
  let required = 0;
  let requiredSoFar = 0;
  for (const w of weeks) {
    const q = weekQuota(w);
    if (!q) continue;
    required += q.pages;
    if (readingDeadline(w).getTime() <= now.getTime()) requiredSoFar += q.pages;
  }
  return { read, required, requiredSoFar, ratio: required > 0 ? Math.min(read / required, 1) : 0 };
}

/** نهاية ورد الأسبوع: آخر الخميس بتوقيت الرياض (السبت + 5 أيام، 23:59) */
export function readingDeadline(w: Pick<LiveWeek, "gregorian">): Date {
  return new Date(new Date(`${w.gregorian}T23:59:59+03:00`).getTime() + 5 * 86400000);
}

/** بطاقةٌ صفحاتها أكثر من ضعف نصاب أسبوعها — تُوسم لمدير المشروع فيتحقّق منها */
export function isLargeAmount(pages: number, quota: Quota | null): boolean {
  return pages > 2 * (quota?.pages ?? DEFAULT_WEEKLY_PAGES);
}
