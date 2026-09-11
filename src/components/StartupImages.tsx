import images from "@/app/startup-images.json";

/**
 * وسوم شاشات الإقلاع لـ iOS. لا يعرض iOS شاشة إقلاع للتطبيق المثبَّت إلا إذا
 * وُجدت صورة تطابق مقاس الجهاز وكثافته واتجاهه بالضبط، وإلا فشاشة بيضاء.
 * أندرويد يبني شاشته من الـ manifest فلا يحتاج هذه.
 */
export default function StartupImages() {
  return (
    <>
      {images.map((i) => (
        <link
          key={i.name}
          rel="apple-touch-startup-image"
          href={`/splash/${i.name}`}
          media={
            `screen and (device-width: ${i.w}px) and (device-height: ${i.h}px)` +
            ` and (-webkit-device-pixel-ratio: ${i.s}) and (orientation: portrait)` +
            (i.dark ? " and (prefers-color-scheme: dark)" : "")
          }
        />
      ))}
    </>
  );
}
