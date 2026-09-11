"use client";

import ErrorScreen from "@/components/ErrorScreen";

/**
 * حدّ التقاط داخل المنطقة: يبقي الإطار والتنقل قائمين حين تتعطّل صفحة،
 * فيستطيع المستخدم الانتقال إلى غيرها بدل أن يعلق في شاشة مسدودة.
 */
export default function AreaError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorScreen error={error} reset={reset} />;
}
