import images from "@/app/startup-images.json";

/**
 * وسوم شاشات الإقلاع لـ iOS. لا يعرض iOS شاشة إقلاع للتطبيق المثبَّت إلا إذا
 * وُجدت صورة تطابق مقاس الجهاز وكثافته واتجاهه، وإلا فشاشة سوداء.
 *
 * لكل مقاس واتجاه ثلاثة وسوم:
 * ١) وسم بلا شرط لون — يُذكر أولاً — فإن لم يكن تفضيل اللون مدعوماً في هذا
 *    الموضع على إصدار ما من iOS بقي شيء يطابق، ولم تُترك الشاشة سوداء.
 * ٢) الفاتح مشروطاً، ٣) الداكن مشروطاً — ويأتيان بعده فيغلبانه حيث يُدعم الشرط.
 *
 * ولا تُقيَّد بنوع الجهاز في الخادم: تقييدها بمعرّف المتصفح يجعل أي تخزين
 * وسيط لصفحة وُلّدت لجهاز آخر يمحوها عن الآيفون — وثمنُها بضعة كيلوبايتات
 * تنضغط إلى أقل منها.
 */
export default function StartupImages() {
  const base = (i: (typeof images)[number]) =>
    `screen and (device-width: ${i.w}px) and (device-height: ${i.h}px)` +
    ` and (-webkit-device-pixel-ratio: ${i.s}) and (orientation: ${i.o})`;
  return (
    <>
      {images
        .filter((i) => !i.dark)
        .map((i) => (
          <link key={`any-${i.name}`} rel="apple-touch-startup-image" href={`/splash/${i.name}`} media={base(i)} />
        ))}
      {images.map((i) => (
        <link
          key={i.name}
          rel="apple-touch-startup-image"
          href={`/splash/${i.name}`}
          media={`${base(i)} and (prefers-color-scheme: ${i.dark ? "dark" : "light"})`}
        />
      ))}
    </>
  );
}
