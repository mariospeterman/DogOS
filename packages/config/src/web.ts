import { z } from "zod";

const webEnvironmentSchema = z.object({
  NEXT_PUBLIC_API_URL: z.url().default("http://127.0.0.1:4000"),
  NEXT_PUBLIC_DOGOS_ENV: z
    .enum(["local", "preview", "production", "test"])
    .default("local"),
  NEXT_PUBLIC_DOGOS_LOCAL_IDENTITY: z
    .enum(["owner", "caregiver", "viewer", "trainer", "unrelated"])
    .optional(),
});

const privateNamePattern = /(SECRET|SERVICE_ROLE|PRIVATE_KEY|ACCESS_TOKEN)/i;

export type WebEnvironment = z.infer<typeof webEnvironmentSchema>;

export function parseWebEnv(input: NodeJS.ProcessEnv): WebEnvironment {
  return webEnvironmentSchema.parse(input);
}

export function assertNoPrivateBrowserEnv(input: NodeJS.ProcessEnv): void {
  const exposedPrivateNames = Object.keys(input).filter(
    (name) => name.startsWith("NEXT_PUBLIC_") && privateNamePattern.test(name),
  );

  if (exposedPrivateNames.length > 0) {
    throw new Error(
      `Private-looking environment variables cannot be browser-exposed: ${exposedPrivateNames.join(", ")}`,
    );
  }
}
