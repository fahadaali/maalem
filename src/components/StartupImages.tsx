import { headers } from "next/headers";
import images from "@/app/startup-images.json";

/**
 * وسوم شاشات الإقلاع لـ iOS. لا يعرض iOS شاشة إقلاع للتطبيق المثبَّت إلا إذا
 * وُجدت صورة تطابق مقاس الجهاز وكثافته واتجاهه بالضبط، وإلا فشاشة سوداء.
 *
 * يُذكر تفضيل اللون في الوسمين معاً — الفاتح والداكن — فبغير ذكره في الفاتح
 * يطابق الوسمان معاً في الوضع الليلي ويبقى المعروض رهن ترتيبهما.
 *
 * ولا تُرسَل إلا لأجهزة آبل: أندرويد يبني شاشته من الـ manifest، وإرسال أربعة
 * وثمانين وسماً إلى كل جهاز يثقل كل صفحة بلا فائدة.
 */
export default async function StartupImages() {
  const ua = (await headers()).get("user-agent") ?? "";
  if (!/iPhone|iPad|iPod|Macintosh/i.test(ua)) return null;
  return (
    <>
      {images.map((i) => (
        <link
          key={i.name}
          rel="apple-touch-startup-image"
          href={`/splash/${i.name}`}
          media={
            `screen and (device-width: ${i.w}px) and (device-height: ${i.h}px)` +
            ` and (-webkit-device-pixel-ratio: ${i.s}) and (orientation: ${i.o})` +
            ` and (prefers-color-scheme: ${i.dark ? "dark" : "light"})`
          }
        />
      ))}
    </>
  );
}
