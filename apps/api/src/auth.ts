import type { IncomingHttpHeaders } from "node:http";

import {
  createLocalActor,
  localAgentIdentities,
  type AgentActorContext,
  type LocalAgentIdentity,
} from "@dogos/agent-auth";
import { AccountRepository } from "@dogos/database";

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
    if (this.environment === "production" || this.environment === "preview") {
      return Promise.reject(new AuthenticationError("AUTH_REQUIRED"));
    }
    const value = headers["x-dogos-user"];
    if (
      typeof value !== "string" ||
      !localAgentIdentities.includes(value as LocalAgentIdentity)
    ) {
      return Promise.reject(new AuthenticationError("AUTH_REQUIRED"));
    }
    const identity = value as LocalAgentIdentity;
    const actor = createLocalActor(identity, this.environment);
    return Promise.resolve({
      ...actor,
      traceId,
    });
  }
}

interface SupabaseUserResponse {
  email?: string;
  id?: string;
  user_metadata?: Record<string, unknown>;
}

export class SupabaseRequestAuthenticator implements RequestAuthenticator {
  readonly #accounts: AccountRepository;

  constructor(
    private readonly supabaseUrl: string,
    private readonly publishableKey: string,
    databaseUrl: string,
    private readonly fetcher: typeof fetch = fetch,
    accountRepository?: AccountRepository,
  ) {
    this.#accounts = accountRepository ?? new AccountRepository(databaseUrl);
  }

  async close(): Promise<void> {
    await this.#accounts.close();
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

    let account = await this.#accounts.resolveByAuthUser(authUser.id);
    if (account === null) {
      const metadata = authUser.user_metadata ?? {};
      const rawName = metadata.full_name;
      const displayName =
        typeof rawName === "string" && rawName.trim().length > 0
          ? rawName.trim()
          : (authUser.email?.split("@")[0] ?? "DogOS owner");
      const rawLocale = metadata.locale;
      const locale =
        typeof rawLocale === "string" &&
        rawLocale.toLowerCase().startsWith("de")
          ? "de-CH"
          : "en";
      account = await this.#accounts.bootstrap({
        authUserId: authUser.id,
        displayName,
        locale,
      });
    }

    return {
      actorId: account.appUserId,
      authMode: "supabase",
      householdId: account.householdId,
      identity: account.role,
      role: account.role,
      traceId,
    };
  }
}

export function createRequestAuthenticator(input: {
  accountRepository?: AccountRepository;
  authMode: "hybrid" | "local" | "supabase";
  databaseUrl: string | undefined;
  environment: "local" | "preview" | "production" | "test";
  publishableKey: string | undefined;
  supabaseUrl: string | undefined;
}): RequestAuthenticator {
  if (
    input.authMode === "hybrid" &&
    (input.environment === "preview" || input.environment === "production")
  ) {
    throw new Error("HYBRID_AUTH_FORBIDDEN");
  }
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
    fetch,
    input.accountRepository,
  );
  return input.authMode === "hybrid"
    ? new CompositeRequestAuthenticator([
        supabase,
        new LocalRequestAuthenticator("development"),
      ])
    : supabase;
}
