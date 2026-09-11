"use client";

import ErrorScreen from "@/components/ErrorScreen";

/** حدّ التقاط أخطاء الصفحات: يمنع أن يهوي التطبيق كله إلى شاشة Next الإنجليزية */
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorScreen error={error} reset={reset} bare />;
}
