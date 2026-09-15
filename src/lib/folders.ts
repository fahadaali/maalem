/**
 * ألوان مجلدات المكتبة: لمسةُ تمييزٍ لا هويةٌ ثانية.
 *
 * المنصة أحادية اللون بتصميمها، فاللون هنا لا يُصبغ به سطحٌ ولا نص، إنما نقطةٌ
 * وحافةٌ في مبدأ المجلد — يهتدي بها المدير والمشارك بين عشرات المواد. والقيم
 * متوسطة الإشباع فتُقرأ على الورق الأبيض وعلى الليل معاً بلا لونين لكل حالة.
 */
export const FOLDER_COLORS = {
  gray: { label: "رمادي", hex: "#7b7b7b" },
  sand: { label: "رملي", hex: "#a9855f" },
  olive: { label: "زيتي", hex: "#6f8b4a" },
  teal: { label: "فيروزي", hex: "#3f8b86" },
  blue: { label: "أزرق", hex: "#4a7aa6" },
  violet: { label: "بنفسجي", hex: "#6f6ab0" },
  plum: { label: "عنّابي", hex: "#8f5773" },
  copper: { label: "نحاسي", hex: "#bc6f37" },
} as const;

export type FolderColor = keyof typeof FOLDER_COLORS;

export function isFolderColor(v: string): v is FolderColor {
  return Object.prototype.hasOwnProperty.call(FOLDER_COLORS, v);
}

/** لونٌ من مفتاحه، ويردّ الرمادي لمفتاحٍ لا يُعرف فلا تسقط الصفحة بقيمة قديمة */
export function folderHex(color: string): string {
  return (FOLDER_COLORS[color as FolderColor] ?? FOLDER_COLORS.gray).hex;
}

/** المجلد كما تحتاجه الواجهتان: لوحة المدير وصفحة المشارك */
export type FolderView = { id: string; name: string; color: string; note?: string | null };

/**
 * يوزّع المواد على مجلداتها ويُلحق بها ما لا مجلد له.
 * المجلد الفارغ يظهر للمدير — فيه يضع — ويُخفى عن المشارك فلا يفتح فراغاً.
 */
export function groupByFolder<T extends { folderId: string | null }>(
  folders: FolderView[],
  items: T[],
  opts: { keepEmpty?: boolean } = {},
): { folder: FolderView | null; items: T[] }[] {
  const groups = folders
    .map((f) => ({ folder: f as FolderView | null, items: items.filter((m) => m.folderId === f.id) }))
    .filter((g) => opts.keepEmpty || g.items.length > 0);
  const loose = items.filter((m) => !m.folderId || !folders.some((f) => f.id === m.folderId));
  return loose.length ? [...groups, { folder: null, items: loose }] : groups;
}
