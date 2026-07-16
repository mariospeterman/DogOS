import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "./app.js";

const apps: ReturnType<typeof buildApp>[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("health routes", () => {
  it("reports liveness without external dependencies", async () => {
    const app = buildApp();
    apps.push(app);

    const response = await app.inject({ method: "GET", url: "/health/live" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  }, 10_000);

  it("allows browser API calls only from the configured web origin", async () => {
    const app = buildApp({ webOrigin: "https://mobile.dogos.test" });
    apps.push(app);

    const allowed = await app.inject({
      method: "OPTIONS",
      url: "/v1/whatsapp/link/confirm",
      headers: {
        origin: "https://mobile.dogos.test",
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type,x-dogos-user",
      },
    });
    const denied = await app.inject({
      method: "OPTIONS",
      url: "/v1/whatsapp/link/confirm",
      headers: {
        origin: "https://attacker.test",
        "access-control-request-method": "POST",
      },
    });

    expect(allowed.statusCode).toBe(204);
    expect(allowed.headers["access-control-allow-origin"]).toBe(
      "https://mobile.dogos.test",
    );
    expect(denied.headers["access-control-allow-origin"]).not.toBe(
      "https://attacker.test",
    );
  });
});

const mutationHeaders = (user = "owner", key = "test-command-1") => ({
  "x-dogos-user": user,
  "idempotency-key": key,
});

describe("product API", () => {
  it("enforces local roles without weakening authentication", async () => {
    const app = buildApp();
    apps.push(app);

    const unauthenticated = await app.inject({ method: "GET", url: "/v1/me" });
    expect(unauthenticated.statusCode).toBe(401);
    expect(unauthenticated.json().error.code).toBe("AUTH_REQUIRED");

    const viewer = await app.inject({
      method: "POST",
      url: "/v1/sessions/session-1/complete",
      headers: mutationHeaders("viewer"),
      payload: { success: 80, foodAccepted: true },
    });
    expect(viewer.statusCode).toBe(403);
    expect(viewer.json().error.code).toBe("ACCESS_DENIED");

    const caregiver = await app.inject({
      method: "POST",
      url: "/v1/sessions/session-1/complete",
      headers: mutationHeaders("caregiver"),
      payload: { success: 80, foodAccepted: true },
    });
    expect(caregiver.statusCode).toBe(200);

    const unrelated = await app.inject({
      method: "GET",
      url: "/v1/dogs/dog-1",
      headers: { "x-dogos-user": "unrelated" },
    });
    expect(unrelated.statusCode).toBe(403);
  });

  it("replays identical commands and rejects conflicting reuse", async () => {
    const app = buildApp();
    apps.push(app);
    const request = {
      method: "POST" as const,
      url: "/v1/sessions/session-1/complete",
      headers: mutationHeaders(),
      payload: { success: 75, foodAccepted: true },
    };

    const first = await app.inject(request);
    const duplicate = await app.inject(request);
    expect(first.json().sessions).toHaveLength(1);
    expect(duplicate.json()).toEqual(first.json());
    expect(duplicate.headers["x-idempotent-replay"]).toBe("true");

    const conflict = await app.inject({
      ...request,
      payload: { success: 10, foodAccepted: false },
    });
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json().error.code).toBe("IDEMPOTENCY_CONFLICT");
  });

  it("switches language without changing Swiss account context", async () => {
    const app = buildApp();
    apps.push(app);
    const response = await app.inject({
      method: "POST",
      url: "/v1/account/locale",
      headers: mutationHeaders(),
      payload: { locale: "en" },
    });

    expect(response.json()).toMatchObject({
      locale: "en",
      country: "CH",
      currency: "CHF",
      timezone: "Europe/Zurich",
      workflowState: "plan_ready",
    });
  });

  it("generates a documented provider-neutral OpenAPI contract", async () => {
    const app = buildApp();
    apps.push(app);
    await app.ready();
    const document = app.swagger() as {
      paths: Record<string, Record<string, { responses?: object }>>;
    };

    const expectedPaths = [
      "/v1/account/locale",
      "/v1/anamneses/{id}/answers",
      "/v1/dogs/{id}",
      "/v1/dogs/{id}/anamneses",
      "/v1/dogs/{id}/current-plan",
      "/v1/dogs/{id}/goals",
      "/v1/dogs/{id}/referrals",
      "/v1/dogs/{id}/safety-assessments",
      "/v1/goals/{id}/generate-plan",
      "/v1/households",
      "/v1/households/{id}",
      "/v1/households/{id}/dogs",
      "/v1/local/reset",
      "/v1/me",
      "/v1/plans/{id}/adjust",
      "/v1/plans/{id}/calendar",
      "/v1/plans/{id}/evaluate-progress",
      "/v1/plans/{id}/progress",
      "/v1/referrals/{id}",
      "/v1/sessions/{id}",
      "/v1/sessions/{id}/check-in",
      "/v1/sessions/{id}/complete",
      "/v1/sessions/{id}/start",
      "/v1/signed-actions",
      "/v1/signed-actions/resolve",
    ];
    expect(Object.keys(document.paths).sort()).toEqual(expectedPaths.sort());
    for (const methods of Object.values(document.paths))
      for (const operation of Object.values(methods))
        expect(operation.responses).toBeDefined();

    const serialized = JSON.stringify(document);
    expect(serialized).not.toMatch(/whatsapp|stripe|cal\.com|access_token/i);
    expect(serialized).toContain("VALIDATION_FAILED");
  });
});
