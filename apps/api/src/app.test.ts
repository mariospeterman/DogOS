import { afterEach, describe, expect, it } from "vitest";
import {
  InMemoryContextSnapshotStore,
  InMemoryMemoryStore,
  InMemoryProfessionalHandoffStore,
  InMemorySearchStore,
  InMemoryVideoAnalysisStore,
} from "@dogos/database";
import {
  CoachConversationService,
  InMemoryCoachConversationStore,
  type CoachTrainingContext,
} from "@dogos/conversation";
import { privatePilotFeatureDefaults } from "@dogos/config/features";

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

  it("reports configured provider readiness separately from liveness", async () => {
    const app = buildApp({
      readiness: {
        ai: {
          asr: "disabled",
          cv: "disabled",
          embedding: "disabled",
          knowledgeRelease: null,
          live: "disabled",
          moderation: "disabled",
          policyVersion: "test-policy",
          text: "ready",
          vod: "disabled",
        },
        database: true,
        liveKit: false,
        openAI: true,
        stripe: false,
        supabaseStorage: true,
        workers: true,
      },
    });
    apps.push(app);

    const response = await app.inject({
      method: "GET",
      url: "/health/ready",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      checks: {
        api: "ready",
        database: "configured",
        liveKit: "not_configured",
        openAI: "configured",
        stripe: "not_configured",
        supabaseStorage: "configured",
        workers: "configured",
      },
      status: "ready",
    });

    const capabilities = await app.inject({
      method: "GET",
      url: "/health/capabilities",
    });
    expect(capabilities.statusCode).toBe(200);
    expect(capabilities.json()).toEqual({
      capabilities: expect.objectContaining({
        policyVersion: "test-policy",
        text: "ready",
        vod: "disabled",
      }),
    });
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

  it("passes a compiled context snapshot into coach generation", async () => {
    const capturedContexts: CoachTrainingContext[] = [];
    const coach = new CoachConversationService(
      new InMemoryCoachConversationStore(),
      {
        generate: async (input) => {
          capturedContexts.push(input.context);
          return "Generated reply from compiled context.";
        },
      },
    );
    const contextSnapshots = new InMemoryContextSnapshotStore();
    const app = buildApp({ coach, contextSnapshots });
    apps.push(app);

    const response = await app.inject({
      method: "POST",
      url: "/v1/coach/messages",
      headers: mutationHeaders("owner", "coach-context-1"),
      payload: {
        dogId: "30000000-0000-0000-0000-000000000001",
        message: "Explain the plan",
        contextKind: "plan",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(capturedContexts[0]?.contextSnapshot).toMatchObject({
      activeStep: expect.objectContaining({
        code: "step.low_distraction_baseline",
      }),
      dog: expect.objectContaining({ name: "Rex" }),
      unknownFactCodes: expect.arrayContaining([
        "knowledge.approved_claims",
        "video.timestamped_observations",
      ]),
      version: "1.0",
    });
    expect(capturedContexts[0]?.contextSnapshotId).toBe(
      contextSnapshots.records[0]?.id,
    );
    expect(contextSnapshots.records[0]).toMatchObject({
      task: "plan.explain",
      tokenEstimate: expect.any(Number),
    });
  });

  it("degrades coach quota exhaustion to deterministic output with one billing action", async () => {
    let generated = false;
    const coach = new CoachConversationService(
      new InMemoryCoachConversationStore(),
      {
        generate: async () => {
          generated = true;
          return "should not be used";
        },
      },
    );
    const app = buildApp({
      accounts: {
        resolveByAppUser: async (appUserId) => ({
          appUserId,
          capabilities: {
            coachingMessagesPerDay: 1,
            concurrentDogs: 1,
            liveCoachingMinutesPerMonth: 0,
            planAdjustmentsPerMonth: 1,
            videoAnalysesPerMonth: 0,
          },
          country: "CH",
          currency: "CHF",
          displayName: "Owner",
          householdId: "20000000-0000-0000-0000-000000000001",
          householdName: "Household",
          locale: "en",
          role: "owner" as const,
          tier: "freemium" as const,
          timezone: "Europe/Zurich",
        }),
      },
      coach,
      usage: {
        consumeCoachingMessage: async () => false,
        consumeLiveCoachingMinutes: async () => false,
        consumeVideoAnalysis: async () => false,
      },
    });
    apps.push(app);

    const response = await app.inject({
      method: "POST",
      url: "/v1/coach/messages",
      headers: mutationHeaders("owner", "coach-quota-1"),
      payload: {
        dogId: "30000000-0000-0000-0000-000000000001",
        message: "What should we train today?",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(generated).toBe(false);
    expect(response.json().reply.text).toContain(
      "daily AI allowance has been reached",
    );
    expect(response.json().reply.actions).toContainEqual(
      expect.objectContaining({
        href: "/app/account/billing",
        label: "View allowance",
      }),
    );
  });

  it("creates and processes asynchronous video analysis jobs after upload when a worker is available", async () => {
    const app = buildApp({
      videoAnalysisWorker: {
        processUploadedAnalysis: async (input) => ({
          completedAt: new Date().toISOString(),
          contentType: "video/mp4",
          createdAt: new Date().toISOString(),
          dogId: "30000000-0000-0000-0000-000000000001",
          failureCode: null,
          findings: [
            {
              confidence: 0.82,
              evidence: `Reviewed ${input.activeStep ?? "current step"}.`,
              label: "Reward timing",
              recommendation: "Keep the marker and reward close together.",
            },
          ],
          householdId: input.householdId,
          id: input.id,
          jobId: "job-worker",
          originalFilename: "recall-session.mp4",
          sizeBytes: 1024,
          status: "completed",
          storageObjectKey:
            "20000000-0000-0000-0000-000000000001/30000000-0000-0000-0000-000000000001/test",
          uploadedAt: new Date().toISOString(),
        }),
      },
      videoUploads: {
        createUpload: async (input) => ({
          expiresInSeconds: 7200,
          method: "PUT",
          url: `https://storage.test/signed/${input.objectKey}`,
        }),
      },
    });
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
    expect(body.upload).toMatchObject({
      expiresInSeconds: 7200,
      method: "PUT",
    });
    expect(body.upload.url).toBe(
      `https://storage.test/signed/${body.analysis.storageObjectKey}`,
    );

    const queued = await app.inject({
      method: "POST",
      url: `/v1/video-analyses/${body.analysis.id}/complete-upload`,
      headers: mutationHeaders("owner", "video-complete-1"),
      payload: {},
    });
    expect(queued.statusCode).toBe(200);
    expect(queued.json().analysis).toMatchObject({
      status: "completed",
    });
    expect(queued.json().analysis.findings).toContainEqual(
      expect.objectContaining({ label: "Reward timing" }),
    );
    expect(queued.json().analysis.jobId).toEqual(expect.any(String));

    const list = await app.inject({
      method: "GET",
      url: `/v1/dogs/${dogId}/video-analyses`,
      headers: { "x-dogos-user": "owner" },
    });
    expect(list.statusCode).toBe(200);
    expect(list.json().analyses).toHaveLength(1);
  });

  it("disables LiveKit-backed live coaching sessions in the private pilot", async () => {
    const app = buildApp({
      liveKit: {
        apiKey: "devkey",
        apiSecret: "a-livekit-secret-for-tests",
        url: "wss://livekit.test",
      },
    });
    apps.push(app);
    const dogId = "30000000-0000-0000-0000-000000000001";

    const disabled = await app.inject({
      method: "POST",
      url: `/v1/dogs/${dogId}/live-sessions`,
      headers: mutationHeaders("owner", "live-disabled-1"),
      payload: { plannedMinutes: 5 },
    });

    expect(disabled.statusCode).toBe(409);
    expect(disabled.json().error.code).toBe("CAPABILITY_DISABLED");
  });

  it("creates LiveKit-backed live coaching sessions when explicitly enabled", async () => {
    const app = buildApp({
      features: { ...privatePilotFeatureDefaults, live: true },
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

  it("disables partner marketplace referrals in the private pilot", async () => {
    const app = buildApp();
    apps.push(app);
    const dogId = "30000000-0000-0000-0000-000000000001";

    const disabled = await app.inject({
      method: "GET",
      url: `/v1/dogs/${dogId}/partner-offers?kind=trainer_booking`,
      headers: { "x-dogos-user": "owner" },
    });

    expect(disabled.statusCode).toBe(409);
    expect(disabled.json().error.code).toBe("CAPABILITY_DISABLED");
  });

  it("lists reviewed partner offers and creates disclosed referrals when explicitly enabled", async () => {
    const app = buildApp({
      features: {
        ...privatePilotFeatureDefaults,
        professionalMarketplace: true,
      },
    });
    apps.push(app);
    const dogId = "30000000-0000-0000-0000-000000000001";

    const offers = await app.inject({
      method: "GET",
      url: `/v1/dogs/${dogId}/partner-offers?kind=trainer_booking`,
      headers: { "x-dogos-user": "owner" },
    });

    expect(offers.statusCode).toBe(200);
    expect(offers.json().offers[0]).toMatchObject({
      bookingProvider: "cal.com",
      disclosure: expect.stringMatching(/Commission never affects ranking/),
      kind: "trainer_booking",
    });

    const referral = await app.inject({
      method: "POST",
      url: `/v1/dogs/${dogId}/partner-referrals`,
      headers: mutationHeaders("owner", "partner-referral-1"),
      payload: {
        offerId: offers.json().offers[0].id,
        rewardfulReferralId: "rw_123",
      },
    });

    expect(referral.statusCode).toBe(200);
    expect(referral.json().referral).toMatchObject({
      offerId: offers.json().offers[0].id,
      provider: "cal.com",
      status: "created",
    });
    expect(referral.json().referral.url).toContain("dogos_referral=");
    expect(referral.json().referral.url).toContain("rewardful_referral=rw_123");
  });

  it("creates an evidence-preserving professional handoff for owner review", async () => {
    const memories = new InMemoryMemoryStore();
    const videos = new InMemoryVideoAnalysisStore();
    const professionalHandoffs = new InMemoryProfessionalHandoffStore();
    const app = buildApp({ memories, professionalHandoffs, videos });
    apps.push(app);
    const dogId = "30000000-0000-0000-0000-000000000001";
    const householdId = "20000000-0000-0000-0000-000000000001";

    const candidate = await memories.createMemoryCandidate({
      category: "stable_profile",
      dogId,
      householdId,
      subject: "dog.trigger_distance",
      value: "Rex starts scanning at 12 meters from other dogs.",
    });
    await memories.confirmMemoryCandidate({
      actorUserId: "10000000-0000-0000-0000-000000000001",
      householdId,
      id: candidate.id,
    });
    const analysis = await videos.create({
      actorUserId: "10000000-0000-0000-0000-000000000001",
      contentType: "video/mp4",
      dogId,
      householdId,
      originalFilename: "loose-leash-review.mp4",
      sizeBytes: 1024,
    });
    await videos.completeAnalysis({
      findings: [
        {
          confidence: 0.82,
          evidence: "Handler tightens lead as the other dog enters frame.",
          label: "lead_tension_before_trigger",
          recommendation: "Increase distance and mark before lead tension.",
        },
      ],
      householdId,
      id: analysis.id,
    });

    const response = await app.inject({
      method: "POST",
      url: `/v1/dogs/${dogId}/referrals`,
      headers: mutationHeaders("owner", "handoff-1"),
      payload: {
        reason: "Prepare a case packet before Saturday trainer session.",
        targetProfessionalType: "trainer",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().handoff).toMatchObject({
      dogId,
      evidenceRefs: expect.arrayContaining([
        expect.objectContaining({ kind: "memory" }),
        expect.objectContaining({ kind: "video" }),
      ]),
      status: "requested",
      summary: expect.objectContaining({
        evidenceCounts: {
          confirmedMemory: 1,
          reviewedVideo: 1,
          videoFindings: 1,
        },
        transparency: expect.stringMatching(/AI-assisted DogOS case packet/),
      }),
      targetProfessionalType: "trainer",
    });

    const denied = await app.inject({
      method: "POST",
      url: `/v1/dogs/${dogId}/referrals`,
      headers: mutationHeaders("caregiver", "handoff-caregiver-1"),
      payload: { targetProfessionalType: "trainer" },
    });
    expect(denied.statusCode).toBe(403);
  });

  it("supports scoped collaboration grants, feedback, reviews, and handoff packages", async () => {
    const app = buildApp();
    apps.push(app);
    const dogId = "30000000-0000-0000-0000-000000000001";

    const feedbackRequest = await app.inject({
      method: "POST",
      url: `/v1/dogs/${dogId}/feedback-requests`,
      headers: mutationHeaders("owner", "feedback-request-1"),
      payload: {
        questions: [
          "What happened immediately before the cue?",
          "What did the dog visibly do next?",
        ],
        recipientRole: "observer_guest",
      },
    });
    expect(feedbackRequest.statusCode).toBe(200);
    const feedbackBody = feedbackRequest.json() as {
      feedbackRequest: { id: string };
      grant: { id: string; token: string };
    };

    const feedbackResponse = await app.inject({
      method: "POST",
      url: `/v1/feedback-requests/${feedbackBody.feedbackRequest.id}/responses`,
      payload: {
        certainty: 0.7,
        observationSummary:
          "I saw the handler step forward before the recall cue.",
        responderRole: "observer_guest",
        shareToken: feedbackBody.grant.token,
        subjectiveInterpretation: "It looked like the step mattered.",
      },
    });
    expect(feedbackResponse.statusCode).toBe(200);
    expect(feedbackResponse.json().response).toMatchObject({
      responderRole: "observer_guest",
    });

    const trainerGrant = await app.inject({
      method: "POST",
      url: `/v1/dogs/${dogId}/case-share-grants`,
      headers: mutationHeaders("owner", "trainer-grant-1"),
      payload: {
        recipientRole: "trainer",
        scopes: ["trainer_review.submit", "dog_profile.read"],
        subjectType: "case",
      },
    });
    expect(trainerGrant.statusCode).toBe(200);

    const review = await app.inject({
      method: "POST",
      url: `/v1/dogs/${dogId}/professional-reviews`,
      payload: {
        correctionType: "timing_corrected",
        professionalRole: "trainer",
        shareToken: trainerGrant.json().grant.token,
        summary: "The handler movement likely became the salient cue.",
        targetType: "case",
      },
    });
    expect(review.statusCode).toBe(200);
    expect(review.json().review).toMatchObject({
      correctionType: "timing_corrected",
      professionalRole: "trainer",
    });

    const handoffPackage = await app.inject({
      method: "POST",
      url: `/v1/dogs/${dogId}/handoff-packages`,
      headers: mutationHeaders("owner", "handoff-package-1"),
      payload: {
        consentReference: "owner-confirmed-preview-v1",
        packageType: "trainer_handoff",
      },
    });
    expect(handoffPackage.statusCode).toBe(200);
    expect(handoffPackage.json().package).toMatchObject({
      packageType: "trainer_handoff",
      version: 1,
    });

    const delivery = await app.inject({
      method: "POST",
      url: `/v1/handoff-packages/${handoffPackage.json().package.id}/deliveries`,
      headers: mutationHeaders("owner", "handoff-delivery-1"),
      payload: {
        deliveryMethod: "secure_link",
        dogId,
        shareGrantId: trainerGrant.json().grant.id,
      },
    });
    expect(delivery.statusCode).toBe(200);
    expect(delivery.json().delivery).toMatchObject({
      deliveryMethod: "secure_link",
      status: "created",
    });

    const revoked = await app.inject({
      method: "POST",
      url: `/v1/dogs/${dogId}/case-share-grants/${feedbackBody.grant.id}/revoke`,
      headers: mutationHeaders("owner", "feedback-revoke-1"),
      payload: {},
    });
    expect(revoked.statusCode).toBe(200);

    const blockedResponse = await app.inject({
      method: "POST",
      url: `/v1/feedback-requests/${feedbackBody.feedbackRequest.id}/responses`,
      payload: {
        certainty: 0.4,
        observationSummary: "This should be blocked after revocation.",
        responderRole: "observer_guest",
        shareToken: feedbackBody.grant.token,
      },
    });
    expect(blockedResponse.statusCode).toBe(403);
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

  it("lets owners inspect, confirm, correct, and forget bounded memory", async () => {
    const app = buildApp();
    apps.push(app);

    const created = await app.inject({
      method: "POST",
      url: "/v1/memory/candidates",
      headers: mutationHeaders("owner", "memory-create-1"),
      payload: {
        category: "stable_profile",
        subject: "reward preference",
        value: "Mika works best for chicken outside.",
      },
    });
    expect(created.statusCode).toBe(201);
    const id = created.json().fact.id as string;

    const confirmed = await app.inject({
      method: "POST",
      url: `/v1/memory/${id}/confirm`,
      headers: mutationHeaders("owner", "memory-confirm-1"),
      payload: {},
    });
    expect(confirmed.statusCode).toBe(200);
    expect(confirmed.json().fact.status).toBe("confirmed");

    const relevant = await app.inject({
      method: "GET",
      url: "/v1/memory?relevant=1&query=chicken",
      headers: { "x-dogos-user": "owner" },
    });
    expect(relevant.statusCode).toBe(200);
    expect(relevant.json().facts).toHaveLength(1);

    const corrected = await app.inject({
      method: "POST",
      url: `/v1/memory/${id}/correct`,
      headers: mutationHeaders("owner", "memory-correct-1"),
      payload: { value: "Mika works best for cheese outside." },
    });
    expect(corrected.statusCode).toBe(200);
    expect(corrected.json().fact.value).toContain("cheese");

    const forgotten = await app.inject({
      method: "POST",
      url: `/v1/memory/${corrected.json().fact.id}/forget`,
      headers: mutationHeaders("owner", "memory-forget-1"),
      payload: {},
    });
    expect(forgotten.statusCode).toBe(200);
    expect(forgotten.json().fact.status).toBe("forgotten");
  });

  it("searches scoped workspace history across durable sources", async () => {
    const app = buildApp({
      search: new InMemorySearchStore([
        {
          createdAt: new Date(0).toISOString(),
          excerpt: "Recall setup with Echo",
          href: "#message-search-1",
          id: "message:search-1",
          kind: "message",
          rank: 0.2,
          title: "DogOS response",
          workspace: "coach",
        },
      ]),
    });
    apps.push(app);

    const response = await app.inject({
      method: "GET",
      url: "/v1/search?query=recall&dogId=30000000-0000-0000-0000-000000000001",
      headers: { "x-dogos-user": "owner" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().results).toEqual([
      expect.objectContaining({
        href: "#message-search-1",
        kind: "message",
        title: "DogOS response",
      }),
    ]);
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
      "/v1/dogs/{id}/case-share-grants",
      "/v1/dogs/{id}/case-share-grants/{grantId}/revoke",
      "/v1/dogs/{id}/current-plan",
      "/v1/dogs/{id}/feedback-requests",
      "/v1/dogs/{id}/goals",
      "/v1/dogs/{id}/handoff-packages",
      "/v1/dogs/{id}/live-sessions",
      "/v1/dogs/{id}/partner-offers",
      "/v1/dogs/{id}/partner-referrals",
      "/v1/dogs/{id}/professional-reviews",
      "/v1/dogs/{id}/referrals",
      "/v1/dogs/{id}/video-analyses",
      "/v1/dogs/{id}/safety-assessments",
      "/v1/feedback-requests/{id}/responses",
      "/v1/goals/{id}/generate-plan",
      "/v1/handoff-packages/{id}/deliveries",
      "/v1/households",
      "/v1/households/{id}",
      "/v1/households/{id}/dogs",
      "/v1/live-sessions/{id}",
      "/v1/live-sessions/{id}/complete",
      "/v1/local/reset",
      "/v1/me",
      "/v1/memory",
      "/v1/memory/{id}/confirm",
      "/v1/memory/{id}/correct",
      "/v1/memory/{id}/forget",
      "/v1/memory/candidates",
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
      "/v1/search",
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
    expect(serialized).not.toContain("secret");
    expect(serialized).toContain("VALIDATION_FAILED");
  });
});
