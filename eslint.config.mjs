import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// eslint-config-next 16 يصدّر إعداداً مسطّحاً مباشرةً، فلا حاجة إلى FlatCompat
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    /**
     * قواعد React Compiler التي فعّلها eslint-config-next 16: المنصة لا تستعمل المترجم،
     * والمواضع التي تشير إليها كانت قائمةً سليمةً قبل الترقية — حالةٌ تُقرأ من المتصفح
     * في أثرٍ بعد التركيب (السمة، والتثبيت، وغلاف PDF)، و`Date.now` في مكوّنات الخادم
     * التي تُصيَّر مرةً لكل طلب. فتبقى تنبيهاتٍ تُرى ولا تُسقط الفحص، ويُعاد النظر فيها
     * إن فُعّل المترجم.
     */
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
    },
  },
  // ملفات مولَّدة عند البناء: عامل الخدمة وعامل PDF.js ومخطط الترحيلات
  globalIgnores([
    ".open-next/**",
    ".wrangler/**",
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "src/lib/schema-sql.ts",
    "public/sw.js",
    "public/pdf.worker.min.mjs",
    "public/pdf/**",
  ]),
]);

export default eslintConfig;
