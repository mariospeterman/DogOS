# Agent and MCP boundary

DogOS agents are presentation and orchestration clients. They cannot redefine canonical validation, safety, protocol eligibility, plan generation, progress thresholds, escalation, or ranking.

```text
Codex / Claude / MCP client / WhatsApp
  -> portable skill or focused agent
  -> authenticated @dogos/agent-tools runtime
  -> typed DogOS HTTP application service
  -> deterministic engines and transaction/audit boundary
```

The host injects actor, household, auth mode, and trace context. Tool inputs contain facts and commands only. Every mutation has a strict schema and idempotency key. Unknown keys, decision fields, thresholds, unsupported goals, anonymous calls, cross-household access, excessive responses, and non-allowlisted tools are rejected.

## MCP development configurations

Codex (`.codex/config.toml`):

```toml
[mcp_servers.dogos]
command = "pnpm"
args = ["--dir", "/absolute/path/to/DogOS", "mcp:serve"]
env = { DOGOS_MCP_AUTH_MODE = "development", DOGOS_MCP_ACTOR = "owner", DOGOS_API_URL = "http://127.0.0.1:4000" }
```

Claude Code:

```bash
claude mcp add dogos -- pnpm --dir /absolute/path/to/DogOS mcp:serve
```

Generic MCP client:

```json
{
  "mcpServers": {
    "dogos": {
      "command": "pnpm",
      "args": ["--dir", "/absolute/path/to/DogOS", "mcp:serve"],
      "env": {
        "DOGOS_MCP_AUTH_MODE": "development",
        "DOGOS_MCP_ACTOR": "owner"
      }
    }
  }
}
```

Set `DOGOS_MCP_READ_ONLY=true` to disable mutations. `DOGOS_MCP_TOOLS` is a comma-separated allowlist. Production startup with development authentication is rejected. A later remote deployment must validate Supabase JWTs and current user state, authorize household membership server-side, rate-limit per actor, and use Streamable HTTP with OAuth rather than accepting identity in tool arguments.

The server uses the current stable MCP TypeScript SDK and tool annotations described by the [official MCP server guide](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/server.md).
