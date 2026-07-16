import type { IncomingHttpHeaders } from "node:http";
import postgres, { type Sql } from "postgres";

import type { AgentActorContext, LocalAgentIdentity } from "@dogos/agent-auth";

import { localIdentities } from "./product-service.js";

export interface RequestAuthenticator {
  authenticate(
    headers: IncomingHttpHeaders,
    traceId: string,
  ): Promise<AgentActorContext>;
}

export class CompositeRequestAuthenticator implements RequestAuthenticator {
  constructor(private readonly authenticators: RequestAuthenticator[]) {}

  async authenticate(
    headers: IncomingHttpHeaders,
    traceId: string,
  ): Promise<AgentActorContext> {
    let lastError: unknown;
    for (const authenticator of this.authenticators) {
      try {
        return await authenticator.authenticate(headers, traceId);
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError ?? new AuthenticationError("AUTH_REQUIRED");
  }
}

export class AuthenticationError extends Error {
  constructor(readonly code: "AUTH_REQUIRED" | "ACCESS_DENIED") {
    super(code);
  }
}

export class LocalRequestAuthenticator implements RequestAuthenticator {
  constructor(private readonly environment = process.env.NODE_ENV) {}

  authenticate(
    headers: IncomingHttpHeaders,
    traceId: string,
  ): Promise<AgentActorContext> {
    if (this.environment === "production") {
      throw new AuthenticationError("AUTH_REQUIRED");
    }
    const value = headers["x-dogos-user"];
    if (typeof value !== "string" || !(value in localIdentities)) {
      throw new AuthenticationError("AUTH_REQUIRED");
    }
    const identity = value as LocalAgentIdentity;
    const actor = localIdentities[identity];
    return Promise.resolve({
      actorId: actor.id,
      authMode: "development",
      householdId: actor.householdId,
      identity,
      role: actor.role as AgentActorContext["role"],
      traceId,
    });
  }
}

interface SupabaseUserResponse {
  id?: string;
}

export class SupabaseRequestAuthenticator implements RequestAuthenticator {
  readonly #sql: Sql;

  constructor(
    private readonly supabaseUrl: string,
    private readonly publishableKey: string,
    databaseUrl: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {
    this.#sql = postgres(databaseUrl, { max: 5, prepare: false });
  }

  async close(): Promise<void> {
    await this.#sql.end();
  }

  async authenticate(
    headers: IncomingHttpHeaders,
    traceId: string,
  ): Promise<AgentActorContext> {
    const authorization = headers.authorization;
    if (
      typeof authorization !== "string" ||
      !authorization.startsWith("Bearer ") ||
      authorization.length <= 7
    ) {
      throw new AuthenticationError("AUTH_REQUIRED");
    }

    const response = await this.fetcher(`${this.supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: this.publishableKey,
        authorization,
      },
    });
    if (!response.ok) throw new AuthenticationError("AUTH_REQUIRED");
    const authUser = (await response.json()) as SupabaseUserResponse;
    if (typeof authUser.id !== "string") {
      throw new AuthenticationError("AUTH_REQUIRED");
    }

    const rows = await this.#sql<
      Array<{ app_user_id: string; household_id: string; role: string }>
    >`
      select u.id::text as app_user_id, hm.household_id::text, hm.role::text
      from api.users u
      join api.household_members hm on hm.user_id = u.id
      where u.auth_user_id = ${authUser.id}
        and u.status = 'active'
        and hm.status = 'active'
      order by case hm.role when 'owner' then 0 when 'caregiver' then 1 else 2 end,
        hm.created_at
      limit 1
    `;
    const membership = rows[0];
    if (membership === undefined) {
      throw new AuthenticationError("ACCESS_DENIED");
    }
    if (!["owner", "caregiver", "viewer"].includes(membership.role)) {
      throw new AuthenticationError("ACCESS_DENIED");
    }

    return {
      actorId: membership.app_user_id,
      authMode: "supabase",
      householdId: membership.household_id,
      identity: membership.role as "owner" | "caregiver" | "viewer",
      role: membership.role as "owner" | "caregiver" | "viewer",
      traceId,
    };
  }
}

export function createRequestAuthenticator(input: {
  authMode: "hybrid" | "local" | "supabase";
  databaseUrl: string | undefined;
  environment: "local" | "preview" | "production" | "test";
  publishableKey: string | undefined;
  supabaseUrl: string | undefined;
}): RequestAuthenticator {
  if (input.authMode === "local") {
    if (input.environment === "preview" || input.environment === "production") {
      throw new Error("DEVELOPMENT_AUTH_FORBIDDEN");
    }
    return new LocalRequestAuthenticator(
      input.environment === "test" ? "test" : "development",
    );
  }
  if (
    input.databaseUrl === undefined ||
    input.publishableKey === undefined ||
    input.supabaseUrl === undefined
  ) {
    throw new Error("SUPABASE_AUTH_CONFIGURATION_REQUIRED");
  }
  const supabase = new SupabaseRequestAuthenticator(
    input.supabaseUrl,
    input.publishableKey,
    input.databaseUrl,
  );
  return input.authMode === "hybrid"
    ? new CompositeRequestAuthenticator([
        supabase,
        new LocalRequestAuthenticator("development"),
      ])
    : supabase;
}
