import type { Metadata, Viewport } from "next";
import "./globals.css";
import { thmanyahDisplay, thmanyahSans } from "./fonts";
import PwaRegistrar from "@/components/PwaRegistrar";
import ThemeScript from "@/components/ThemeScript";

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

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f0f0f" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl" className={`${thmanyahSans.variable} ${thmanyahDisplay.variable}`}>
      <head><ThemeScript /></head>
      <body className="antialiased">
        {children}
        <PwaRegistrar />
      </body>
    </html>
  );
}
