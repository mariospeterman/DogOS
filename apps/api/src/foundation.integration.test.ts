import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "./app.js";

const app = buildApp();

beforeAll(async () => {
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe("API foundation", () => {
  it("exposes a deterministic readiness contract", async () => {
    const response = await app.inject({ method: "GET", url: "/health/ready" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      checks: {
        api: "ready",
        database: "not_configured",
        liveKit: "not_configured",
        openAI: "deterministic",
        stripe: "not_configured",
        supabaseStorage: "deterministic",
        workers: "in_process",
      },
      status: "ready",
    });
  });
});
