import localFont from "next/font/local";

export const thmanyahSans = localFont({
  variable: "--font-thmanyah-sans",
  display: "swap",
  src: [
    { path: "./fonts/ThmanyahSans-Light.woff2", weight: "300", style: "normal" },
    { path: "./fonts/ThmanyahSans-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/ThmanyahSans-Medium.woff2", weight: "500", style: "normal" },
    { path: "./fonts/ThmanyahSans-Bold.woff2", weight: "700", style: "normal" },
    { path: "./fonts/ThmanyahSans-Black.woff2", weight: "900", style: "normal" },
  ],
});

export const thmanyahDisplay = localFont({
  variable: "--font-thmanyah-display",
  display: "swap",
  src: [
    { path: "./fonts/ThmanyahSerifDisplay-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/ThmanyahSerifDisplay-Medium.woff2", weight: "500", style: "normal" },
    { path: "./fonts/ThmanyahSerifDisplay-Bold.woff2", weight: "700", style: "normal" },
  ],
});
