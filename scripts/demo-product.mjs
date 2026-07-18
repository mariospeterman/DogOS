import { spawn, spawnSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const checkOnly = process.argv.includes("--check");
const children = [];
const apiPort = 4100;
const webPort = 3100;
const apiOrigin = `http://127.0.0.1:${apiPort}`;
const webOrigin = `http://127.0.0.1:${webPort}`;
const localDatabaseUrl =
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const supabaseCli = resolve(root, "node_modules/supabase/dist/supabase.js");
const tsxCli = resolve(root, "node_modules/tsx/dist/cli.mjs");
const nextCli = resolve(root, "apps/web/node_modules/next/dist/bin/next");

function runNode(script, args) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    stdio: "inherit",
  });
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
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (await available(url)) return;
    await new Promise((resolveWait) => setTimeout(resolveWait, 500));
  }
  throw new Error(`Local service did not become ready: ${url}`);
}

function startNode(script, args, environment, cwd = root) {
  const child = spawn(process.execPath, [script, ...args], {
    cwd,
    env: { ...process.env, ...environment },
    stdio: checkOnly ? "ignore" : "inherit",
  });
  child.on("error", (error) => {
    console.error(`Unable to start ${script}:`, error);
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
  spawnSync(process.execPath, [supabaseCli, "status"], {
    cwd: root,
    stdio: "ignore",
  }).status !== 0
)
  runNode(supabaseCli, ["start", "--exclude", "storage-api"]);

runNode(supabaseCli, ["db", "reset"]);

if (await available(`${apiOrigin}/health/ready`)) {
  throw new Error(`Review API port is already in use: ${apiOrigin}`);
}
if (await available(`${webOrigin}/app/coach`)) {
  throw new Error(`Review web port is already in use: ${webOrigin}`);
}

startNode(tsxCli, ["apps/api/src/server.ts"], {
  API_PORT: String(apiPort),
  DATABASE_URL: localDatabaseUrl,
  DOGOS_AUTH_MODE: "local",
  DOGOS_ENV: "local",
  DOGOS_LLM_MODE: "deterministic",
  NODE_OPTIONS: "--conditions=development",
  WEB_ORIGIN: webOrigin,
});
startNode(
  nextCli,
  ["dev", "--webpack", "--hostname", "127.0.0.1", "--port", String(webPort)],
  {
    NEXT_DIST_DIR: ".next-demo",
    NEXT_PUBLIC_API_URL: apiOrigin,
    NEXT_PUBLIC_DOGOS_ENV: "local",
    NEXT_PUBLIC_DOGOS_LOCAL_IDENTITY: "unrelated",
    WEB_ORIGIN: webOrigin,
  },
  resolve(root, "apps/web"),
);

await Promise.all([
  waitFor(`${apiOrigin}/health/ready`),
  waitFor(`${webOrigin}/app/coach`),
]);

console.log(`
DogOS local product is ready

Coach:    ${webOrigin}/app/coach
Plan:     ${webOrigin}/app/plan
Account:  ${webOrigin}/app/account
API:      ${apiOrigin}/openapi.json

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
