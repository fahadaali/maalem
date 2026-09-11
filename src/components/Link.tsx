"use client";

import NextLink from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof NextLink>;

/**
 * بديل Link المعتاد في التطبيق كله.
 *
 * جلب Next التلقائي يطلب كل رابط يظهر في الشاشة. وصفحات هذه اللوحة كثيفة
 * الروابط — شريط الأسابيع، وشبكة «المزيد» بأكثر من ثلاثين رابطاً — فكان فتح
 * الصفحة يطلق عشرات طلبات التصيير المتزامنة، كلٌّ منها عشرات الاستعلامات على
 * قاعدة D1. فتتزاحم على الخادم وينقطع بثّ بعضها، فيصل إلى المتصفح ناقصاً
 * ويرمي «Connection closed» عند أول انتقال — وهو ما كان يُسقط الصفحات.
 *
 * فالجلب هنا عند اللمس أو مرور المؤشر: طلب واحد للمسار المقصود وحده، يسبق
 * النقر بما يكفي ليبقى الانتقال فورياً، بلا زحام.
 */
export default function Link({ prefetch, onPointerDown, onMouseEnter, ...rest }: Props) {
  const router = useRouter();
  const href = rest.href;
  const warm = () => {
    if (prefetch === false) return;
    if (typeof href === "string" && href.startsWith("/")) router.prefetch(href);
  };
  return (
    <NextLink
      {...rest}
      prefetch={false}
      onPointerDown={(e) => {
        warm();
        onPointerDown?.(e);
      }}
      onMouseEnter={(e) => {
        warm();
        onMouseEnter?.(e);
      }}
    />
  );
}
