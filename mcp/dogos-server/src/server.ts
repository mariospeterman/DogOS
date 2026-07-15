import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createLocalActor, localAgentIdentities } from "@dogos/agent-auth";
import {
  DogosApiTransport,
  DogosToolRuntime,
  dogosToolNames,
  dogosToolSchemas,
  dogosWriteTools,
  type DogosToolName,
} from "@dogos/agent-tools";

export function createDogosMcpServer(environment = process.env) {
  if (
    environment.NODE_ENV === "production" ||
    environment.DOGOS_MCP_AUTH_MODE === "production"
  ) {
    throw new Error("Production MCP requires secure user-token authentication");
  }
  const identity = environment.DOGOS_MCP_ACTOR ?? "owner";
  if (
    !localAgentIdentities.includes(
      identity as (typeof localAgentIdentities)[number],
    )
  ) {
    throw new Error("Invalid DOGOS_MCP_ACTOR");
  }
  const configured = environment.DOGOS_MCP_TOOLS?.split(",").filter(Boolean);
  const allowlist = new Set<DogosToolName>(
    configured === undefined ? dogosToolNames : (configured as DogosToolName[]),
  );
  for (const name of allowlist) {
    if (!dogosToolNames.includes(name))
      throw new Error(`Unknown MCP tool: ${name}`);
  }
  const runtime = new DogosToolRuntime(
    new DogosApiTransport(environment.DOGOS_API_URL ?? "http://127.0.0.1:4000"),
    { allowlist, readOnly: environment.DOGOS_MCP_READ_ONLY === "true" },
  );
  const server = new McpServer(
    { name: "dogos", version: "0.1.0" },
    {
      instructions:
        "DogOS tools expose canonical training state. Never invent exercises, diagnoses, thresholds, safety decisions, or database operations. Ask for missing facts and obey blocked results.",
    },
  );
  for (const name of allowlist) {
    const write = dogosWriteTools.has(name);
    server.registerTool(
      name,
      {
        description: `${write ? "Authenticated mutation" : "Read-only query"} through the deterministic DogOS product core.`,
        inputSchema: dogosToolSchemas[name],
        annotations: {
          title: name,
          readOnlyHint: !write,
          destructiveHint: false,
          idempotentHint: write,
          openWorldHint: false,
        },
      },
      async (input: unknown) => {
        try {
          const result = await runtime.call(
            name,
            input,
            createLocalActor(
              identity as (typeof localAgentIdentities)[number],
              environment.NODE_ENV,
            ),
          );
          return {
            content: [{ type: "text" as const, text: JSON.stringify(result) }],
            structuredContent: result as unknown as Record<string, unknown>,
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  error: error instanceof Error ? error.message : "TOOL_FAILED",
                }),
              },
            ],
            isError: true,
          };
        }
      },
    );
  }
  return { allowlist, server };
}

if (process.argv.includes("--catalog")) {
  const { allowlist } = createDogosMcpServer();
  process.stdout.write(
    `${JSON.stringify({ mode: "development", tools: [...allowlist] }, null, 2)}\n`,
  );
} else {
  const { server } = createDogosMcpServer();
  await server.connect(new StdioServerTransport());
}
