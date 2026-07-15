import type { AgentActorContext } from "@dogos/agent-auth";
import { assertAuthenticatedActor } from "@dogos/agent-auth";
import {
  dogosToolSchemas,
  dogosWriteTools,
  type DogosToolName,
} from "./schemas.js";
import type { DogosToolTransport, DogosTransportRequest } from "./transport.js";

export interface DogosToolResult {
  data: unknown;
  status: "ok" | "blocked";
  traceId: string;
}

const endpoint = (
  name: DogosToolName,
  input: Record<string, unknown>,
): DogosTransportRequest => {
  const idempotencyKey = input.idempotencyKey as string | undefined;
  const post = (path: string, body: object = {}) => ({
    method: "POST" as const,
    path,
    body,
    ...(idempotencyKey === undefined ? {} : { idempotencyKey }),
  });
  switch (name) {
    case "dogos_get_profile":
      return { method: "GET", path: "/v1/me" };
    case "dogos_get_current_state":
    case "dogos_get_today":
      return { method: "GET", path: `/v1/dogs/${String(input.dogId)}` };
    case "dogos_record_anamnesis_answer":
      return post(`/v1/anamneses/${String(input.anamnesisId)}/answers`, {
        command: input.questionCode,
      });
    case "dogos_run_safety_assessment":
      return post(`/v1/dogs/${String(input.dogId)}/safety-assessments`, {
        kind: input.kind,
      });
    case "dogos_create_goal":
      return post(`/v1/dogs/${String(input.dogId)}/goals`, {
        command: input.goalCode,
      });
    case "dogos_generate_plan":
      return post(`/v1/goals/${String(input.goalId)}/generate-plan`);
    case "dogos_start_session":
      return post(`/v1/sessions/${String(input.sessionId)}/start`);
    case "dogos_record_session":
      return post(`/v1/sessions/${String(input.sessionId)}/check-in`, input);
    case "dogos_complete_checkin":
      return post(`/v1/sessions/${String(input.sessionId)}/complete`, {
        success: input.success,
        foodAccepted: input.foodAccepted,
        ...(input.avoidance === undefined
          ? {}
          : { avoidance: input.avoidance }),
      });
    case "dogos_get_progress":
      return {
        method: "GET",
        path: `/v1/plans/${String(input.planId)}/progress`,
      };
    case "dogos_adjust_plan":
      return post(`/v1/plans/${String(input.planId)}/adjust`, {
        expectedVersion: input.expectedVersion,
      });
    case "dogos_request_professional_handoff":
      return post(`/v1/dogs/${String(input.dogId)}/referrals`);
  }
};

export class DogosToolRuntime {
  constructor(
    private readonly transport: DogosToolTransport,
    private readonly options: {
      allowlist?: ReadonlySet<DogosToolName>;
      readOnly?: boolean;
    } = {},
  ) {}

  async call(
    name: DogosToolName,
    input: unknown,
    actor: AgentActorContext | undefined,
  ): Promise<DogosToolResult> {
    assertAuthenticatedActor(actor);
    if (
      this.options.allowlist !== undefined &&
      !this.options.allowlist.has(name)
    ) {
      throw new Error("TOOL_NOT_ALLOWED");
    }
    if (this.options.readOnly === true && dogosWriteTools.has(name)) {
      throw new Error("READ_ONLY_MODE");
    }
    const parsed = dogosToolSchemas[name].parse(input) as Record<
      string,
      unknown
    >;
    const data = await this.transport.request(endpoint(name, parsed), actor);
    const serialized = JSON.stringify(data);
    if (serialized.length > 32_768) throw new Error("TOOL_RESULT_TOO_LARGE");
    const blocked =
      typeof data === "object" &&
      data !== null &&
      (("planStatus" in data && data.planStatus === "blocked") ||
        ("status" in data && data.status === "blocked"));
    return { data, status: blocked ? "blocked" : "ok", traceId: actor.traceId };
  }
}
