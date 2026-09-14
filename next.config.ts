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
  experimental: {
    inlineCss: true,
    /**
     * ملف المادة يُرفع مع نموذج إضافتها عبر إجراء خادم، وحدّ جسم الإجراء الافتراضي
     * ميغابايت واحد — فكان كتابٌ من ثلاثة ميغابايت يسقط بخطأ 500 بلا رسالة، والواجهة
     * تَعِد بخمسة وعشرين. يُرفع الحدّ ليطابق MAX_FILE_BYTES في src/lib/storage.ts،
     * مع فسحة لترويسات النموذج متعدد الأجزاء.
     */
    serverActions: { bodySizeLimit: "26mb" },
  },
};

export default nextConfig;
