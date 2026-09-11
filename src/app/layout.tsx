import type { Metadata, Viewport } from "next";
import "./globals.css";
import { thmanyahDisplay, thmanyahSans } from "./fonts";
import PwaRegistrar from "@/components/PwaRegistrar";
import ThemeScript from "@/components/ThemeScript";
import StartupImages from "@/components/StartupImages";
import StaleAssetGuard from "@/components/StaleAssetGuard";
import BootSplash from "@/components/BootSplash";

export const metadata: Metadata = {
  title: { default: "معالم التربية", template: "%s — معالم التربية" },
  description: "منصة برنامج «معالم التربية» لتأهيل المشرفين التربويين الجدد",
  applicationName: "معالم التربية",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "معالم التربية" },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }, { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

/**
 * لا يُصدَّر themeColor من هنا عمداً: الوسم المشروط بـ prefers-color-scheme يتبع
 * تفضيل النظام وحده ويتجاهل اختيار المستخدم داخل التطبيق، والمتصفح يأخذ بأول وسم
 * مطابق فيغلب المشروطُ ما يضبطه النص. فيتولّى نص الإقلاع إنشاءه وضبطه وحده.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl" className={`${thmanyahSans.variable} ${thmanyahDisplay.variable}`}>
      <head><ThemeScript /><StartupImages /></head>
      <body className="antialiased">
        {/*
          شاشة الإقلاع مرسومة من الخادم وأولَ عنصر في الصفحة: تظهر مع أول رسم،
          لا بعد تحميل جافاسكربت وتفاعل الواجهة — وإلا وصلت بعد أن يظهر المحتوى.
        */}
        <div id="boot" aria-hidden="true" suppressHydrationWarning>
          <div className="boot-mark">معالم التربية</div>
          <span className="boot-rule" />
          <div className="boot-sub">برنامج تأهيل المشرفين التربويين الجدد</div>
        </div>
        {children}
        <BootSplash />
        <StaleAssetGuard />
        <PwaRegistrar />
      </body>
    </html>
  );
}
