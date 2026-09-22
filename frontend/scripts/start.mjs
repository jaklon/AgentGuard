import "./copy-standalone-assets.mjs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const server = join(root, ".next", "standalone", "server.js");
const child = spawn(process.execPath, [server], {
  stdio: "inherit",
  env: {
    ...process.env,
    PORT: process.env.PORT || "5173",
    HOSTNAME: process.env.AGENTGUARD_HOSTNAME || "0.0.0.0",
  },
});

child.on("exit", (code) => process.exit(code ?? 0));
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
