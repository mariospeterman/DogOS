import { createLocalActor } from "@dogos/agent-auth";
import { DogosApiTransport, DogosToolRuntime } from "@dogos/agent-tools";

const runtime = new DogosToolRuntime(
  new DogosApiTransport(process.env.DOGOS_API_URL ?? "http://127.0.0.1:4000"),
  { readOnly: true },
);
async function main() {
  const result = await runtime.call(
    "dogos_get_today",
    { dogId: "30000000-0000-0000-0000-000000000001" },
    createLocalActor("owner"),
  );
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

void main();
