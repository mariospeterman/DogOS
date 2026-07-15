import type { AgentActorContext } from "@dogos/agent-auth";

export interface DogosTransportRequest {
  body?: unknown;
  idempotencyKey?: string;
  method: "GET" | "POST";
  path: string;
}

export interface DogosToolTransport {
  request(
    request: DogosTransportRequest,
    actor: AgentActorContext,
  ): Promise<unknown>;
}

export class DogosApiTransport implements DogosToolTransport {
  constructor(
    private readonly baseUrl: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async request(
    request: DogosTransportRequest,
    actor: AgentActorContext,
  ): Promise<unknown> {
    const response = await this.fetcher(new URL(request.path, this.baseUrl), {
      method: request.method,
      headers: {
        "content-type": "application/json",
        "x-dogos-user": actor.identity,
        "x-request-id": actor.traceId,
        ...(request.idempotencyKey === undefined
          ? {}
          : { "idempotency-key": request.idempotencyKey }),
      },
      ...(request.body === undefined
        ? {}
        : { body: JSON.stringify(request.body) }),
    });
    const result = (await response.json()) as unknown;
    if (!response.ok) {
      const code =
        typeof result === "object" && result !== null && "error" in result
          ? String((result as { error: { code?: unknown } }).error.code)
          : "DOGOS_API_ERROR";
      throw new Error(code);
    }
    return result;
  }
}
