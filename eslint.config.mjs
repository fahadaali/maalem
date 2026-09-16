import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  // ملفات مولَّدة عند البناء: عامل الخدمة وعامل PDF.js ومخطط الترحيلات
  { ignores: [".open-next/**", ".wrangler/**", ".next/**", "src/lib/schema-sql.ts", "public/sw.js", "public/pdf.worker.min.mjs", "public/pdf/**"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
];

export default eslintConfig;
