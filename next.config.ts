import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// يتيح الوصول إلى روابط D1 وR2 المحلية أثناء التطوير بـ next dev
initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-d1"],
  /**
   * إدراج التنسيق في الوثيقة بدل ربطه بملف: ملف التنسيق المرتبط يحجب أول رسم
   * حتى يصل — رحلةٌ كاملة إلى الخادم بعد وصول الوثيقة، قِيست فأخّرت ظهور شاشة
   * الإقلاع بقدرها كاملاً. وحجمه ستة كيلوبايتات ونصف مضغوطاً، والوثيقة لا
   * تُجلب إلا عند الفتح البارد لأن التنقّل بعدها من طرف العميل.
   */
  experimental: { inlineCss: true },
};

export default nextConfig;
