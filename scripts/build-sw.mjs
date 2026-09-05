// يولّد public/sw.js من القالب مع بصمة إصدار تتغيّر مع كل بناء،
// فيكتشف المتصفح وجود إصدار جديد ويعرض إشعار التحديث داخل التطبيق.
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

let stamp;
try {
  stamp = execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
} catch {
  stamp = "";
}
const version = `${stamp || "dev"}.${Date.now().toString(36)}`;
const template = readFileSync("src/pwa/sw-template.js", "utf8");
writeFileSync("public/sw.js", template.replace("__SW_VERSION__", version));
console.log(`built public/sw.js (version ${version})`);
