import { cpSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dist = "dist";
const cjs = "dist-cjs";

rmSync(cjs, { recursive: true, force: true });
cpSync(dist, cjs, { recursive: true });
writeFileSync(join(cjs, "package.json"), JSON.stringify({ type: "commonjs" }));

await import("node:child_process").then(({ execFileSync }) => {
  execFileSync("npx", ["tsc", "-p", "tsconfig.cjs.json"], { stdio: "inherit", shell: true });
});

const js = readFileSync(join(cjs, "index.js"), "utf8");
writeFileSync(join(dist, "index.cjs"), js);
rmSync(cjs, { recursive: true, force: true });
