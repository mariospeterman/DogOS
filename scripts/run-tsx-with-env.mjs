import { spawnSync } from "node:child_process";

const [script, ...args] = process.argv.slice(2);
if (script === undefined) {
  throw new Error("A TypeScript entrypoint is required");
}

const nodeOptions = [process.env.NODE_OPTIONS, "--conditions=development"]
  .filter(Boolean)
  .join(" ");
const result = spawnSync("pnpm", ["exec", "tsx", script, ...args], {
  env: { ...process.env, NODE_OPTIONS: nodeOptions },
  stdio: "inherit",
});

if (result.error !== undefined) throw result.error;
process.exitCode = result.status ?? 1;
