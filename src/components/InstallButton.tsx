"use client";
import { useEffect, useState } from "react";
import { Download, CheckCircle2 } from "lucide-react";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export default function InstallButton() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
    setInstalled(standalone);
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", () => setInstalled(true));
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (installed) {
    return (
      <div className="card card-muted flex items-center gap-2 text-sm">
        <CheckCircle2 size={18} /> التطبيق مثبّت على هذا الجهاز.
      </div>
    );
  }
  if (deferred) {
    return (
      <button
        className="btn w-full md:w-auto"
        onClick={async () => {
          await deferred.prompt();
          const { outcome } = await deferred.userChoice;
          if (outcome === "accepted") setInstalled(true);
          setDeferred(null);
        }}
      >
        <Download size={16} /> تثبيت التطبيق
      </button>
    );
  }
  return (
    <div className="card card-muted text-sm text-muted">
      {ios ? "على آيفون: استخدم زر المشاركة في سفاري ثم «إضافة إلى الشاشة الرئيسية»." : "إن لم يظهر زر التثبيت، استخدم قائمة المتصفح واختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية»."}
    </div>
  );
}
