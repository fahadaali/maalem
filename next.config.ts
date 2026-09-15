import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// يتيح الوصول إلى روابط D1 وR2 المحلية أثناء التطوير بـ next dev
initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-d1"],
  /**
   * رؤوس أمان لكل صفحة: لا تُخمَّن أنواع المحتوى، ولا تُؤطَّر المنصة في موقع
   * آخر، ولا يُسرَّب مسار الصفحة إلى وجهةٍ خارجية مع الرابط، ولا تُطلب أذونات
   * جهازٍ لا تستعملها. وملف public/_headers يبقى للتخزين المؤقت للأصول.
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        ],
      },
    ];
  },
  /**
   * إدراج التنسيق في الوثيقة بدل ربطه بملف: ملف التنسيق المرتبط يحجب أول رسم
   * حتى يصل — رحلةٌ كاملة إلى الخادم بعد وصول الوثيقة، قِيست فأخّرت ظهور شاشة
   * الإقلاع بقدرها كاملاً. وحجمه ستة كيلوبايتات ونصف مضغوطاً، والوثيقة لا
   * تُجلب إلا عند الفتح البارد لأن التنقّل بعدها من طرف العميل.
   */
  /**
   * لا حاجة إلى رفع `serverActions.bodySizeLimit`: لم يعد أي إجراء خادم يحمل
   * بايتات ملف — الرفع كله على ‎/api/upload، ومُعالِج المسار بلا حدّ. ورفعُ الحدّ
   * كان يداري العطل لا يزيله: أيّ تجاوزٍ له يردّ 500 لا يفهمه عميل React، فيبقى
   * النموذج دائراً بلا رسالة.
   */
  experimental: { inlineCss: true },
};

export default nextConfig;
