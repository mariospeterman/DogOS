import { spawn, spawnSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const checkOnly = process.argv.includes("--check");
const children = [];

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

async function available(url) {
  try {
    return (await fetch(url, { signal: AbortSignal.timeout(1_500) })).ok;
  } catch {
    return false;
  }
}

async function waitFor(url) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (await available(url)) return;
    await new Promise((resolveWait) => setTimeout(resolveWait, 500));
  }
  throw new Error(`Local service did not become ready: ${url}`);
}

function start(args) {
  const child = spawn("pnpm", args, {
    cwd: root,
    stdio: checkOnly ? "ignore" : "inherit",
  });
  children.push(child);
}

function stop() {
  for (const child of children) child.kill("SIGTERM");
}

process.on("SIGINT", () => {
  stop();
  process.exit(0);
});
process.on("SIGTERM", () => {
  stop();
  process.exit(0);
});

if (
  spawnSync("pnpm", ["exec", "supabase", "status"], {
    cwd: root,
    stdio: "ignore",
  }).status !== 0
)
  run("pnpm", ["dev:services"]);

run("pnpm", ["db:reset"]);
run("node", ["scripts/generate-slice-2-5-artifacts.mjs"]);

if (!(await available("http://127.0.0.1:4000/health/ready")))
  start(["--filter", "@dogos/api", "dev"]);
if (!(await available("http://127.0.0.1:3000/app/coach")))
  start(["--filter", "@dogos/web", "dev", "--hostname", "127.0.0.1"]);

await Promise.all([
  waitFor("http://127.0.0.1:4000/health/ready"),
  waitFor("http://127.0.0.1:3000/app/coach"),
]);

console.log(`
DogOS local product is ready

Coach:    http://127.0.0.1:3000/app/coach
Today:    http://127.0.0.1:3000/app/today
Plan:     http://127.0.0.1:3000/app/plan
Account:  http://127.0.0.1:3000/app/account
API:      http://127.0.0.1:4000/openapi.json

Local identity header (x-dogos-user):
  owner | caregiver | viewer | trainer | unrelated

Local identity headers are development-only. Production authentication is unchanged.
Press Ctrl+C to stop services started by this command.
`);

if (checkOnly) {
  stop();
  process.exit(0);
}

await new Promise(() => {});
