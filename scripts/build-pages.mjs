import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const stage = mkdtempSync(join(tmpdir(), "guitar-vibe-pages-"));
try {
  for (const source of ["app", "components", "lib", "types", "public", "package.json", "tsconfig.json", "next.config.ts", "postcss.config.mjs"]) {
    cpSync(join(root, source), join(stage, source), {
      recursive: true,
      filter: (path) => path !== join(root, "app", "api"),
    });
  }
  symlinkSync(join(root, "node_modules"), join(stage, "node_modules"), "dir");
  execFileSync(process.execPath, [join(root, "node_modules/next/dist/bin/next"), "build", "--webpack"], {
    cwd: stage,
    stdio: "inherit",
    env: { ...process.env, NEXT_PUBLIC_APP_MODE: "pages", NEXT_PUBLIC_BASE_PATH: "/guitar-vibe" },
  });
  rmSync(join(root, "out"), { recursive: true, force: true });
  cpSync(join(stage, "out"), join(root, "out"), { recursive: true });
  writeFileSync(join(root, "out", ".nojekyll"), "");
} finally {
  rmSync(stage, { recursive: true, force: true });
}
