import { randomUUID } from "node:crypto";

export const localAgentIdentities = [
  "owner",
  "caregiver",
  "viewer",
  "trainer",
  "unrelated",
] as const;
export type LocalAgentIdentity = (typeof localAgentIdentities)[number];

export interface AgentActorContext {
  actorId: string;
  authMode: "development" | "supabase";
  householdId: string | null;
  identity: LocalAgentIdentity;
  role: "owner" | "caregiver" | "viewer" | "trainer";
  traceId: string;
}

const localActors: Record<
  LocalAgentIdentity,
  Omit<AgentActorContext, "authMode" | "traceId">
> = {
  owner: {
    actorId: "10000000-0000-0000-0000-000000000001",
    householdId: "20000000-0000-0000-0000-000000000001",
    identity: "owner",
    role: "owner",
  },
  caregiver: {
    actorId: "10000000-0000-0000-0000-000000000002",
    householdId: "20000000-0000-0000-0000-000000000001",
    identity: "caregiver",
    role: "caregiver",
  },
  viewer: {
    actorId: "10000000-0000-0000-0000-000000000003",
    householdId: "20000000-0000-0000-0000-000000000001",
    identity: "viewer",
    role: "viewer",
  },
  trainer: {
    actorId: "10000000-0000-0000-0000-000000000006",
    householdId: "20000000-0000-0000-0000-000000000001",
    identity: "trainer",
    role: "trainer",
  },
  unrelated: {
    actorId: "10000000-0000-0000-0000-000000000005",
    householdId: "20000000-0000-0000-0000-000000000002",
    identity: "unrelated",
    role: "owner",
  },
};

export function createLocalActor(
  identity: LocalAgentIdentity,
  environment = process.env.NODE_ENV,
): AgentActorContext {
  if (environment === "production") {
    throw new Error("DEVELOPMENT_AUTH_FORBIDDEN");
  }
  return {
    ...localActors[identity],
    authMode: "development",
    traceId: randomUUID(),
  };
}

export function assertAuthenticatedActor(
  actor: AgentActorContext | undefined,
): asserts actor is AgentActorContext {
  if (actor === undefined || actor.actorId.length === 0) {
    throw new Error("AUTH_REQUIRED");
  }
}
