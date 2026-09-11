/**
 * يولّد نسخة مصغَّرة من خط الهوية لا تحمل إلا حروف الشعار، لتُدرَج في الصفحة
 * نفسها فيُرسم الشعار مع أول بايت بلا طلب إضافي ولا تبدّل خط.
 *
 * يحتاج fonttools:  python3 -m pip install fonttools brotli
 * يُشغَّل عند تغيّر الشعار فقط:  node scripts/boot-font.mjs
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";

const WORDMARK = "معالم التربية";
const SRC = "src/app/fonts/ThmanyahSerifDisplay-Bold.woff2";
const TMP = "/tmp/maalem-wordmark.woff2";

execFileSync("python3", ["-m", "fontTools.subset", SRC, `--text=${WORDMARK}`,
  "--layout-features=*", "--flavor=woff2", `--output-file=${TMP}`, "--no-hinting", "--desubroutinize"]);

const b64 = readFileSync(TMP).toString("base64");
unlinkSync(TMP);
writeFileSync("src/app/boot-font.ts",
  `// مولَّد بـ scripts/boot-font.mjs — خط الشعار مصغَّراً على حروفه وحدها\n` +
  `export const WORDMARK_FONT = ${JSON.stringify(b64)};\n`);
console.log(`wordmark font: ${Math.round(b64.length / 1024)} KB base64`);
