#!/usr/bin/env node
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import os from "node:os";
import process from "node:process";

const require = createRequire(import.meta.url);
const suffixes = {
  darwin: {
    arm64: ["darwin-arm64"],
    x64: ["darwin-x64"],
  },
  linux: {
    arm64: ["linux-arm64", "linux-arm64-musl"],
    x64: ["linux-x64", "linux-x64-musl"],
  },
  win32: {
    arm64: ["windows-arm64"],
    x64: ["windows-x64"],
  },
};

function binaryPath() {
  if (process.env.SUPABASE_CLI_BINARY_OVERRIDE) {
    return process.env.SUPABASE_CLI_BINARY_OVERRIDE;
  }
  const platform = suffixes[process.platform]?.[os.arch()] ?? [];
  for (const suffix of platform) {
    try {
      return join(
        dirname(require.resolve(`@supabase/cli-${suffix}/package.json`)),
        "bin",
        process.platform === "win32" ? "supabase.exe" : "supabase",
      );
    } catch {}
    const pnpmPath = resolve(
      `node_modules/.pnpm/@supabase+cli-${suffix}@2.109.1/node_modules/@supabase/cli-${suffix}/bin/supabase`,
    );
    if (existsSync(pnpmPath)) return pnpmPath;
  }
  return "supabase";
}

const result = spawnSync(binaryPath(), process.argv.slice(2), {
  stdio: "inherit",
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
