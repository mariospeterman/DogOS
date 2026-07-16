import { z } from "zod";

const booleanString = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

const apiEnvironmentSchema = z
  .object({
    API_HOST: z.string().min(1).default("127.0.0.1"),
    API_PORT: z.coerce.number().int().positive().max(65_535).default(4000),
    DATABASE_URL: z.string().min(1).optional(),
    DOGOS_AUTH_MODE: z.enum(["hybrid", "local", "supabase"]),
    DOGOS_ENV: z
      .enum(["local", "preview", "production", "test"])
      .default("local"),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace"])
      .default("info"),
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    SUPABASE_PUBLISHABLE_KEY: z.string().min(20).optional(),
    SUPABASE_URL: z.url().optional(),
    SIGNED_LINK_SECRET: z.string().min(32),
    USE_MOCK_PROVIDERS: booleanString,
    WEB_ORIGIN: z.url(),
  })
  .superRefine((environment, context) => {
    if (
      environment.DOGOS_ENV === "production" &&
      environment.USE_MOCK_PROVIDERS
    ) {
      context.addIssue({
        code: "custom",
        message: "USE_MOCK_PROVIDERS must be false in production",
        path: ["USE_MOCK_PROVIDERS"],
      });
    }

    if (
      environment.DOGOS_AUTH_MODE !== "local" &&
      (environment.DATABASE_URL === undefined ||
        environment.SUPABASE_PUBLISHABLE_KEY === undefined ||
        environment.SUPABASE_URL === undefined)
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Supabase auth requires DATABASE_URL, SUPABASE_URL, and SUPABASE_PUBLISHABLE_KEY",
        path: ["DOGOS_AUTH_MODE"],
      });
    }

    if (
      environment.DOGOS_ENV === "production" &&
      environment.DOGOS_AUTH_MODE !== "supabase"
    ) {
      context.addIssue({
        code: "custom",
        message: "Production requires Supabase authentication",
        path: ["DOGOS_AUTH_MODE"],
      });
    }

    if (
      environment.DOGOS_ENV === "production" &&
      environment.SIGNED_LINK_SECRET.startsWith("local-only")
    ) {
      context.addIssue({
        code: "custom",
        message: "Production requires a non-development signing secret",
        path: ["SIGNED_LINK_SECRET"],
      });
    }
  });

export type ApiEnvironment = z.infer<typeof apiEnvironmentSchema>;

export function loadApiEnv(input: NodeJS.ProcessEnv): ApiEnvironment {
  const dogosEnvironment = input.DOGOS_ENV ?? "local";
  const localDefaults =
    dogosEnvironment === "production"
      ? {}
      : {
          DOGOS_AUTH_MODE: "local",
          SIGNED_LINK_SECRET: "local-only-change-before-production-32-chars",
          USE_MOCK_PROVIDERS: "true",
          WEB_ORIGIN: "http://localhost:3000",
        };

  return apiEnvironmentSchema.parse({
    DOGOS_AUTH_MODE:
      dogosEnvironment === "production" || dogosEnvironment === "preview"
        ? "supabase"
        : "local",
    ...localDefaults,
    ...input,
  });
}
