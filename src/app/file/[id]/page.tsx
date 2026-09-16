import { redirect } from "next/navigation";
import { Download, X } from "lucide-react";
import Link from "@/components/Link";
import PdfViewer from "@/components/PdfViewerLoader";
import { authorizeAttachment, toItem } from "@/lib/attachments";
import { homeFor } from "@/lib/auth";

export const metadata = { title: "عرض الملف", robots: { index: false, follow: false } };

/**
 * عارض المرفق بملء الشاشة — خارج مناطق الأدوار الثلاث، فيخدمها بصفحة واحدة
 * ويتحقّق بنفسه من الأذونات (المسار ليس ضمن matcher في الوسيط).
 *
 * ملء الشاشة مقصود: التطبيق مثبَّت بـ standalone، وفتح الملف بـ ‎_blank كان
 * يقذف المشارك خارج التطبيق بلا طريق رجوع.
 */
export default async function FilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  const { from } = await searchParams;
  const auth = await authorizeAttachment({ id });
  if (auth.status === 401) redirect(`/login?next=${encodeURIComponent(`/file/${id}`)}`);
  if (auth.status !== 200) {
    // لا نميّز المفقود من الممنوع: معرفة أن الملف موجود لمن لا يملكه تسريبٌ بذاته
    return (
      <main className="min-h-dvh flex flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-muted">هذا الملف غير متاح لك.</p>
        <Link href="/" className="btn btn-secondary btn-sm">العودة</Link>
      </main>
    );
  }

  const item = toItem(auth.att);
  const isPdf = item.contentType === "application/pdf";
  const isImage = item.contentType.startsWith("image/");
  // وجهة الرجوع من الرابط، ولا تُقبل إلا داخل المنصة فلا تصير قفزةً إلى موقع خارجي
  const back = from && /^\/(app|admin|mentor)(\/|\?|$)/.test(from) ? from : homeFor(auth.user.role);

  return (
    <main className="h-dvh flex flex-col bg-paper-2 relative">
      {/* شريطٌ كامل على الشاشات الواسعة: فيها فسحةٌ لاسم الملف */}
      <header
        className="hidden md:flex shrink-0 border-b border-line bg-paper items-center gap-2 px-3 py-2"
        style={{ paddingTop: "max(env(safe-area-inset-top), 0.5rem)" }}
      >
        <Link href={back} className="btn btn-ghost btn-sm shrink-0" aria-label="إغلاق">
          <X size={18} />
        </Link>
        <h1 className="text-sm font-medium truncate flex-1 min-w-0">{item.name}</h1>
        <a href={`${item.url}?download=1`} className="btn btn-secondary btn-sm shrink-0">
          <Download size={14} /> تنزيل
        </a>
      </header>

      {/*
        وعلى الجوال زرّان دائريان عائقان فوق الملف بنمط أوراق iOS: الشريط الكامل
        يقتطع من ارتفاع شاشةٍ ضيّقة أصلاً، والاسم يعرفه من فتح الملف. والإزاحة
        بالمنطقة الآمنة فلا يقعان تحت شقّ الشاشة.
      */}
      <div
        className="md:hidden absolute inset-x-0 z-20 flex items-center justify-between px-3 pointer-events-none"
        style={{ top: "max(env(safe-area-inset-top), 0.5rem)" }}
      >
        <Link
          href={back}
          aria-label="إغلاق"
          className="pointer-events-auto w-9 h-9 rounded-full bg-paper/85 backdrop-blur border border-line shadow-sm flex items-center justify-center"
        >
          <X size={18} />
        </Link>
        <a
          href={`${item.url}?download=1`}
          aria-label={`تنزيل ${item.name}`}
          className="pointer-events-auto w-9 h-9 rounded-full bg-paper/85 backdrop-blur border border-line shadow-sm flex items-center justify-center"
        >
          <Download size={16} />
        </a>
      </div>

      {isPdf ? (
        <PdfViewer url={item.url} />
      ) : isImage ? (
        <div className="flex-1 overflow-auto p-3 pt-14 md:pt-3 flex items-start justify-center">
          {/* محسِّن next/image لا يعمل على العامل بلا إعداد، والمرفق لا يُخزَّن في شبكة التوزيع أصلاً */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.url} alt={item.name} className="max-w-full rounded-xl border border-line" />
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-sm text-muted">هذا النوع لا يُعرض داخل المنصة. حمّله لتفتحه بتطبيق جهازك.</p>
          <a href={`${item.url}?download=1`} className="btn btn-sm">
            <Download size={14} /> تنزيل الملف
          </a>
        </div>
      )}
    </main>
  );
}
