import type { MetadataRoute } from "next";

/**
 * ما يُفهرس من المنصة: صفحة التعريف ودليل التثبيت وصفحة الدخول. وما عداها
 * خلف الجلسة — الوثيقة والمساعدة ومناطق الأدوار والملفات — فيُمنع صراحةً هنا،
 * ويُمنع في ترويسة كل صفحة منها بـ robots في البيانات الوصفية.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/app/", "/admin/", "/mentor/", "/program", "/program/", "/help", "/help/", "/file/", "/api/", "/setup"],
    },
  };
}
