import { mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = new URL("../", import.meta.url).pathname;
const output = join(root, "packages/database/src/database.types.ts");
const directory = await mkdtemp(join(tmpdir(), "dogos-db-types-"));
const generated = join(directory, "database.types.ts");

try {
  const result = spawnSync(
    "pnpm",
    [
      "exec",
      "supabase",
      "gen",
      "types",
      "typescript",
      "--local",
      "--schema",
      "api",
    ],
    { cwd: root, encoding: "utf8" },
  );
  if (result.status !== 0) {
    throw new Error(result.stderr || "Supabase type generation failed");
  }
  if (!result.stdout.includes("export type Database")) {
    throw new Error("Supabase generated an invalid database type file");
  }
  await writeFile(generated, result.stdout);
  const formatted = spawnSync(
    "pnpm",
    ["exec", "prettier", "--write", generated],
    { cwd: root, encoding: "utf8" },
  );
  if (formatted.status !== 0) {
    throw new Error(formatted.stderr || "Database type formatting failed");
  }
  const contents = await readFile(generated, "utf8");
  if (contents.length < 1_000) {
    throw new Error("Refusing to replace database types with truncated output");
  }
  await rename(generated, output);
} finally {
  await rm(directory, { force: true, recursive: true });
}
