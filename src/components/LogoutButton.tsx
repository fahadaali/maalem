"use client";

import { useFormStatus } from "react-dom";
import { LogOut } from "lucide-react";
import { logout } from "@/app/(auth)/actions";

/**
 * زر الخروج يمسح ما يخصّ هذا الحساب على الجهاز قبل إنهاء الجلسة: صفحات مخزّنة
 * قد تُعرض لغيره بلا اتصال، ولوحته المحفوظة لصفحة المدخل. ولا يُلغى عامل
 * الخدمة ولا اشتراك الدفع، فالجهاز في الغالب لصاحبه ويعود إليه.
 */
async function forget() {
  try {
    localStorage.removeItem("maalem-home");
  } catch {
    // لا تخزين متاح
  }
  try {
    if (typeof caches !== "undefined") {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith("maalem-") && k !== "maalem-static").map((k) => caches.delete(k)));
    }
  } catch {
    // المخزون غير متاح
  }
}

function Button() {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-ghost btn-sm" disabled={pending}>
      <LogOut size={14} /> {pending ? "جارٍ الخروج…" : "تسجيل الخروج"}
    </button>
  );
}

export default function LogoutButton() {
  return (
    <form
      action={async () => {
        await forget();
        await logout();
      }}
      className="mt-2"
    >
      <Button />
    </form>
  );
}
