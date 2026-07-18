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
      url: "/v1/onboarding/messages",
      headers: {
        origin: "https://mobile.dogos.test",
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type,x-dogos-user",
      },
    });
    const denied = await app.inject({
      method: "OPTIONS",
      url: "/v1/onboarding/messages",
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

    const local = await app.inject({
      method: "OPTIONS",
      url: "/v1/coach/messages",
      headers: {
        origin: "http://127.0.0.1:3000",
        "access-control-request-method": "POST",
      },
    });
    expect(local.headers["access-control-allow-origin"]).toBe(
      "http://127.0.0.1:3000",
    );
  });
});

const mutationHeaders = (user = "owner", key = "test-command-1") => ({
  "x-dogos-user": user,
  "idempotency-key": key,
});

describe("product API", () => {
  it("serves one idempotent authenticated Coach timeline", async () => {
    const app = buildApp();
    apps.push(app);
    const dogId = "30000000-0000-0000-0000-000000000001";

    const initial = await app.inject({
      method: "GET",
      url: `/v1/coach/conversation?dogId=${dogId}`,
      headers: { "x-dogos-user": "owner" },
    });
    expect(initial.statusCode).toBe(200);
    expect(initial.json().messages).toEqual([]);

    const request = {
      method: "POST" as const,
      url: "/v1/coach/messages",
      headers: mutationHeaders("owner", "coach-message-1"),
      payload: {
        dogId,
        message: "Warum dieser Block?",
        contextKind: "plan",
      },
    };
    const sent = await app.inject(request);
    const replay = await app.inject(request);
    expect(sent.statusCode).toBe(200);
    expect(sent.json().conversation.messages).toHaveLength(2);
    expect(replay.json().conversation.messages).toHaveLength(2);
    expect(
      replay
        .json()
        .conversation.messages.every(
          (message: { channel: string }) => message.channel === "web",
        ),
    ).toBe(true);

    const viewer = await app.inject({
      ...request,
      headers: mutationHeaders("viewer", "coach-viewer-1"),
    });
    expect(viewer.statusCode).toBe(403);
  });

  it("streams coach replies through the same provider-neutral endpoint", async () => {
    const app = buildApp();
    apps.push(app);

    const response = await app.inject({
      method: "POST",
      url: "/v1/coach/messages?stream=1",
      headers: mutationHeaders("owner", "coach-stream-1"),
      payload: {
        dogId: "30000000-0000-0000-0000-000000000001",
        message: "Was trainieren wir heute?",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/plain");
    expect(response.body).toContain("Heute:");
  });

  it("creates and completes asynchronous video analysis jobs", async () => {
    const app = buildApp();
    apps.push(app);
    const dogId = "30000000-0000-0000-0000-000000000001";

    const created = await app.inject({
      method: "POST",
      url: `/v1/dogs/${dogId}/video-analyses`,
      headers: mutationHeaders("owner", "video-create-1"),
      payload: {
        contentType: "video/mp4",
        originalFilename: "recall-session.mp4",
        sizeBytes: 1024,
      },
    });

    expect(created.statusCode).toBe(200);
    const body = created.json() as {
      analysis: { id: string; status: string; storageObjectKey: string };
      upload: { method: string; url: string };
    };
    expect(body.analysis.status).toBe("upload_requested");
    expect(body.upload).toMatchObject({ method: "PUT" });
    expect(body.upload.url).toContain(body.analysis.storageObjectKey);

    const completed = await app.inject({
      method: "POST",
      url: `/v1/video-analyses/${body.analysis.id}/complete-upload`,
      headers: mutationHeaders("owner", "video-complete-1"),
      payload: {},
    });
    expect(completed.statusCode).toBe(200);
    expect(completed.json().analysis).toMatchObject({
      status: "completed",
    });
    expect(completed.json().analysis.findings).toHaveLength(2);

    const list = await app.inject({
      method: "GET",
      url: `/v1/dogs/${dogId}/video-analyses`,
      headers: { "x-dogos-user": "owner" },
    });
    expect(list.statusCode).toBe(200);
    expect(list.json().analyses).toHaveLength(1);
  });

  it("creates LiveKit-backed live coaching sessions", async () => {
    const app = buildApp({
      liveKit: {
        apiKey: "devkey",
        apiSecret: "a-livekit-secret-for-tests",
        url: "wss://livekit.test",
      },
    });
    apps.push(app);
    const dogId = "30000000-0000-0000-0000-000000000001";

    const created = await app.inject({
      method: "POST",
      url: `/v1/dogs/${dogId}/live-sessions`,
      headers: mutationHeaders("owner", "live-create-1"),
      payload: { plannedMinutes: 5 },
    });

    expect(created.statusCode).toBe(200);
    const body = created.json() as {
      liveKit: { token: string; url: string };
      session: { id: string; roomName: string; status: string };
    };
    expect(body.liveKit.url).toBe("wss://livekit.test");
    expect(body.liveKit.token.split(".")).toHaveLength(3);
    expect(body.session).toMatchObject({
      roomName: expect.stringMatching(/^dogos-/),
      status: "active",
    });

    const completed = await app.inject({
      method: "POST",
      url: `/v1/live-sessions/${body.session.id}/complete`,
      headers: mutationHeaders("owner", "live-complete-1"),
      payload: {
        consumedMinutes: 4,
        summary: "Practised recall timing with live coaching.",
      },
    });
    expect(completed.statusCode).toBe(200);
    expect(completed.json().session).toMatchObject({
      consumedMinutes: 4,
      status: "completed",
    });
  });

  it("exports privacy data and records deletion requests for owners", async () => {
    const app = buildApp();
    apps.push(app);

    const deletion = await app.inject({
      method: "POST",
      url: "/v1/privacy/deletion-requests",
      headers: mutationHeaders("owner", "privacy-delete-1"),
      payload: { reason: "Owner request" },
    });
    expect(deletion.statusCode).toBe(200);
    expect(deletion.json().request).toMatchObject({
      reason: "Owner request",
      status: "requested",
    });

    const exported = await app.inject({
      method: "GET",
      url: "/v1/privacy/export",
      headers: { "x-dogos-user": "owner" },
    });
    expect(exported.statusCode).toBe(200);
    expect(exported.json()).toMatchObject({
      householdId: "20000000-0000-0000-0000-000000000001",
      retention: {
        billingProjection: "retained_for_legal_and_tax_period",
      },
    });

    const viewer = await app.inject({
      method: "GET",
      url: "/v1/privacy/export",
      headers: { "x-dogos-user": "viewer" },
    });
    expect(viewer.statusCode).toBe(403);
  });

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
      "/v1/billing/checkout",
      "/v1/billing/portal",
      "/v1/coach/conversation",
      "/v1/coach/messages",
      "/v1/dogs/{id}",
      "/v1/dogs/{id}/anamneses",
      "/v1/dogs/{id}/current-plan",
      "/v1/dogs/{id}/goals",
      "/v1/dogs/{id}/live-sessions",
      "/v1/dogs/{id}/referrals",
      "/v1/dogs/{id}/video-analyses",
      "/v1/dogs/{id}/safety-assessments",
      "/v1/goals/{id}/generate-plan",
      "/v1/households",
      "/v1/households/{id}",
      "/v1/households/{id}/dogs",
      "/v1/live-sessions/{id}",
      "/v1/live-sessions/{id}/complete",
      "/v1/local/reset",
      "/v1/me",
      "/v1/onboarding",
      "/v1/onboarding/messages",
      "/v1/plans/{id}/adjust",
      "/v1/plans/{id}/calendar",
      "/v1/plans/{id}/evaluate-progress",
      "/v1/plans/{id}/progress",
      "/v1/privacy/deletion-requests",
      "/v1/privacy/export",
      "/v1/product",
      "/v1/referrals/{id}",
      "/v1/scheduled-sessions/{id}/start",
      "/v1/sessions/{id}",
      "/v1/sessions/{id}/check-in",
      "/v1/sessions/{id}/complete",
      "/v1/signed-actions",
      "/v1/signed-actions/resolve",
      "/v1/video-analyses/{id}",
      "/v1/video-analyses/{id}/complete-upload",
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
