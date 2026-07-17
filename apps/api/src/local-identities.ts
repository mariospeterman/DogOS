import type { LocalAgentIdentity } from "@dogos/agent-auth";

export const localIdentities: Record<
  LocalAgentIdentity,
  { id: string; role: string; householdId: string | null }
> = {
  owner: {
    id: "10000000-0000-0000-0000-000000000001",
    role: "owner",
    householdId: "20000000-0000-0000-0000-000000000001",
  },
  caregiver: {
    id: "10000000-0000-0000-0000-000000000002",
    role: "caregiver",
    householdId: "20000000-0000-0000-0000-000000000001",
  },
  viewer: {
    id: "10000000-0000-0000-0000-000000000003",
    role: "viewer",
    householdId: "20000000-0000-0000-0000-000000000001",
  },
  trainer: {
    id: "10000000-0000-0000-0000-000000000006",
    role: "trainer",
    householdId: "20000000-0000-0000-0000-000000000001",
  },
  unrelated: {
    id: "10000000-0000-0000-0000-000000000005",
    role: "owner",
    householdId: "20000000-0000-0000-0000-000000000002",
  },
};
