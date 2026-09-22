import { cpSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const standalone = join(root, ".next", "standalone");
const assets = [
  [join(root, "public"), join(standalone, "public")],
  [join(root, ".next", "static"), join(standalone, ".next", "static")],
];

for (const [source, target] of assets) {
  if (!existsSync(source)) continue;
  mkdirSync(target, { recursive: true });
  cpSync(source, target, { recursive: true, force: true });
}
