import { db } from "./db";
import type { Role } from "./roles";

/**
 * مركز المساعدة: أسئلة وأجوبة يحرّرها مدير المشروع، ويرى كلٌّ ما يعنيه وحده.
 *
 * كان نصّاً ثابتاً في الشيفرة يُعرض كاملاً لكل زائر — ومنه قسم مدير المشروع
 * بروابطه إلى لوحته — فصار صفوفاً في القاعدة تُحرَّر من اللوحة، وتُصفّى بالدور.
 * وموضوعه الاستعمال والتثبيت، لا شرحُ الوثيقة، فأبوابها في مكانها.
 */

export const HELP_AUDIENCES = {
  ALL: "لكل من دخل",
  PARTICIPANT: "المشارك",
  MENTOR: "المشرف المرافق",
  ADMIN: "مدير المشروع",
} as const;

export type HelpAudience = keyof typeof HELP_AUDIENCES;

export function isHelpAudience(v: string): v is HelpAudience {
  return Object.prototype.hasOwnProperty.call(HELP_AUDIENCES, v);
}

export type HelpItemView = { id: string; audience: string; question: string; answer: string; href: string | null; hrefLabel: string | null; order: number };

/** بنود الدور: ما يخصّه وما يخصّ الجميع، مرتبةً كما رتّبها المدير */
export async function helpFor(role: Role): Promise<HelpItemView[]> {
  return db.helpItem.findMany({
    where: { audience: { in: ["ALL", role] } },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });
}

export async function allHelp(): Promise<HelpItemView[]> {
  return db.helpItem.findMany({ orderBy: [{ audience: "asc" }, { order: "asc" }, { createdAt: "asc" }] });
}

/**
 * البذرة الأولى: ما كان مكتوباً في الصفحة، منقّىً مما يشرح الوثيقة أو يكشف
 * لوحة الإدارة لغير أهلها. تُكتب مرة واحدة إن كان الجدول فارغاً، ثم هي للمدير
 * يزيد فيها وينقص — فلا تُعاد كتابتها فوق تحريره.
 */
const SEED: { audience: HelpAudience; question: string; answer: string; href?: string; hrefLabel?: string }[] = [
  { audience: "ALL", question: "كيف أدخل المنصة؟", answer: "من صفحة الدخول باسم المستخدم وكلمة المرور اللذين سلّمهما إليك مدير المشروع. الواجهة واحدة للجميع، وتفتح لك لوحتك أنت بحسب حسابك." },
  { audience: "ALL", question: "نسيت كلمة المرور، ماذا أفعل؟", answer: "راجع مدير المشروع ليعيد ضبطها لك. ثم غيّرها من صفحة الإعدادات بعد أول دخول." },
  { audience: "ALL", question: "كيف أثبّت المنصة تطبيقاً على جوالي؟", answer: "المنصة تطبيق ويب تقدمي يُثبَّت على الشاشة الرئيسية في الآيفون والأندرويد، ويعمل بلا متصفح ظاهر.", href: "/install", hrefLabel: "دليل التثبيت" },
  { audience: "ALL", question: "التطبيق مثبَّت وصدر تحديث، هل أفعل شيئاً؟", answer: "لا. يظهر لك شريط «يتوفر تحديث» فتضغطه فيُحدَّث التطبيق كاملاً — لا جزءاً منه — ثم تُفتح الصفحة من جديد." },
  { audience: "ALL", question: "أين أجد الإشعارات والبحث؟", answer: "في أعلى الشاشة: جرس الإشعارات إلى جانبه خانة البحث. وهما بابا الوصول الوحيدان إليهما، فلا تبحث عنهما في القائمة." },
  { audience: "ALL", question: "لم تصلني إشعارات على الجهاز.", answer: "فعّل إشعارات الجهاز من الإعدادات ووافق على الإذن حين يطلبه المتصفح. وإن تعذّر، اكتب بريدك ليصلك التنبيه عليه بديلاً." },
  { audience: "PARTICIPANT", question: "أين أرى ما يُطلب مني هذا الأسبوع؟", answer: "في بطاقة الأسبوع: يومه، ومدّته، وورده، ومهمته، وما تُسلّمه في نهايته — وحالتك على كل صفّ منها.", href: "/app/week", hrefLabel: "بطاقات الأسابيع" },
  { audience: "PARTICIPANT", question: "تعذّر عليّ حضور لقاء أو تسليم مهمة في وقتها.", answer: "ارفع طلب استئذان أو تأجيل بسببه قبل الموعد. الاستئذان المقبول يُرصد «معذوراً» فلا يُحتسب عليك في نسبة الحضور.", href: "/app/excuses", hrefLabel: "الاستئذان والتأجيل" },
  { audience: "PARTICIPANT", question: "كيف أعرف تقدّمي في الكتب؟", answer: "من صفحة القراءة: لكل كتاب شريط تقدّم يُحسب من أبعد صفحة سجّلتها في بطاقاتك.", href: "/app/reading", hrefLabel: "القراءة" },
  { audience: "PARTICIPANT", question: "أين أجد كل ما سجّلته؟", answer: "في سجل نشاطك: كل بطاقة وتقرير ومهمة واختبار ومعايشة مرتبةً بالزمن. وملف الإنجاز يجمع الشواهد للتسليم النهائي.", href: "/app/timeline", hrefLabel: "سجل نشاطي" },
  { audience: "PARTICIPANT", question: "كيف تظهر مواعيد البرنامج في تقويم جوالي؟", answer: "أنشئ رابط التقويم من الإعدادات واشترك به مرة واحدة، فتظهر اللقاءات والحلقات ومواعيد التسليم وتتحدّث تلقائياً.", href: "/app/settings", hrefLabel: "الإعدادات" },
  { audience: "MENTOR", question: "ما دوري في المنصة؟", answer: "تعتمد سجلات المعايشة الميدانية لمن رُبطوا بك، وتقيّم انتظامهم وتفاعلهم وتطبيقهم، وتراجع تقاريرهم الأسبوعية، وتقيّم مهامهم بسلّم التقدير.", href: "/mentor", hrefLabel: "مجموعتي" },
  { audience: "MENTOR", question: "هل أرى جميع المشاركين؟", answer: "لا. ترى من ربطهم بك مدير المشروع وحدهم، ولا تصل إلى سجلات غيرهم ولا إلى إدارة البرنامج." },
  { audience: "MENTOR", question: "هل تقييمي يدخل في الدرجة؟", answer: "نعم. تقييمك للمعايشة يدخل في درجة المعايشة الميدانية، وتقييمك للمهام يدخل في درجة المهام. والاعتماد النهائي لمدير المشروع." },
  { audience: "ADMIN", question: "من أين أبدأ في إعداد دفعة جديدة؟", answer: "أنشئ الدفعة وفعّلها، ثم أضف المشاركين — واحداً واحداً أو استيراداً من جدول — واضبط جدول البرنامج ومواعيد اللقاءات.", href: "/admin/cohorts", hrefLabel: "الدفعات" },
  { audience: "ADMIN", question: "هل أستطيع تعديل نص الخطة؟", answer: "نعم. الكتب، وبنود الميثاق، وأوزان التقويم، ومستويات الإتمام، ومصفوفة الكفاءات كلها تُحرَّر لكل دفعة، ويسري أثرها في الدرجات والوثائق فوراً.", href: "/admin/content", hrefLabel: "محتوى الوثيقة" },
  { audience: "ADMIN", question: "كيف أتابع التزام الدفعة؟", answer: "صفحة الاتجاهات تعرض الحضور والتقارير والورد والاختبارات أسبوعاً بأسبوع، وقائمة التزام لكل مشارك.", href: "/admin/trends", hrefLabel: "الاتجاهات" },
  { audience: "ADMIN", question: "أخطأ مشارك في إدخال، أو أخطأتُ أنا في رصد.", answer: "من مركز الأنشطة: كل إدخال في المنصة مرتَّبٌ من الأحدث، بجانبه «تراجع». وما تتراجع عنه يبقى في سجل التراجع فتعيده بضغطة.", href: "/admin/activity", hrefLabel: "مركز الأنشطة" },
  { audience: "ADMIN", question: "كيف أرى المنصة بعين المشارك؟", answer: "من الإعدادات: «معاينة تجربة المشارك» تفتح واجهته بحسابك أنت وللقراءة فقط، فلا تظهر لك سجلات أي مشارك آخر ولا يُحفظ أي تغيير.", href: "/admin/settings", hrefLabel: "الإعدادات" },
  { audience: "ADMIN", question: "من يصل إلى ماذا في المنصة؟", answer: "صفحة الصلاحيات تعرض مناطق الأدوار والمسارات المحجوبة، مقروءةً من قواعد المنصة نفسها لا من جدول يُكتب بيد.", href: "/admin/access", hrefLabel: "الصلاحيات" },
];

/** تُبذر مرة واحدة: وجود صفٍّ واحد يعني أن المدير تسلّمها، فلا يُكتب فوقها */
export async function ensureHelpSeed(): Promise<void> {
  if ((await db.helpItem.count()) > 0) return;
  await db.helpItem.createMany({
    data: SEED.map((x, i) => ({ audience: x.audience, question: x.question, answer: x.answer, href: x.href ?? null, hrefLabel: x.hrefLabel ?? null, order: i + 1 })),
  });
}
