import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// يتيح الوصول إلى روابط D1 وR2 المحلية أثناء التطوير بـ next dev
initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-d1"],
  experimental: {
    /**
     * مخزون الموجّه في المتصفح. القيمة الافتراضية للصفحات الديناميكية صفر،
     * فكل رجوع إلى صفحة زُرِعت قبل ثوانٍ يعيد جلبها من الخادم كاملة.
     * ثلاثون ثانية تكفي للتنقل بين التبويبات بلا انتظار، ولا تُبقي بياناً قديماً
     * بعد تعديل: إجراءات الخادم تستدعي revalidatePath فيسقط المخزون فوراً.
     */
    staleTimes: { dynamic: 30, static: 180 },
  },
};

export default nextConfig;
