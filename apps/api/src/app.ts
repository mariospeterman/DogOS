import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import rawBody from "fastify-raw-body";
import {
  localAgentIdentities,
  type AgentActorContext,
} from "@dogos/agent-auth";
import {
  CoachConversationService,
  InMemoryCoachConversationStore,
  type CoachContextKind,
} from "@dogos/conversation";
import { buildCoachingContext } from "@dogos/agent-tools";
import type {
  CoachingContextCapsule,
  CoachingMemoryFact,
  Measurement,
} from "@dogos/contracts";
import type { AiCapabilityReadiness } from "./ai/model-policy/config.js";
import {
  InMemoryLiveCoachingStore,
  InMemoryMemoryStore,
  InMemoryPrivacyStore,
  InMemorySearchStore,
  InMemoryContextSnapshotStore,
  InMemoryCollaborationStore,
  InMemoryPartnerMarketplaceStore,
  InMemoryProfessionalHandoffStore,
  IdempotencyConflictError,
  InMemoryVideoAnalysisStore,
  type AccountRepository,
  type CapabilityUsageRepository,
  type CaseShareRecipientRole,
  type CaseShareScope,
  type CollaborationStore,
  type ContextSnapshotStore,
  type LiveCoachingStore,
  type MemoryFactRecord,
  type MemoryStore,
  type OnboardingRepository,
  type PartnerMarketplaceStore,
  type PartnerOfferKind,
  type ProductDashboard,
  type PostgresRepository,
  type ProfessionalHandoffEvidenceRef,
  type ProfessionalHandoffStore,
  type ProfessionalHandoffSummary,
  type ProfessionalHandoffTarget,
  type PrivacyStore,
  type SearchStore,
  type VideoAnalysisRecord,
  type VideoAnalysisStore,
} from "@dogos/database";
import { LocalProductFixture } from "./local-product-fixture.js";
import {
  SignedActionError,
  SignedActionService,
  signedActionPurposes,
  type SignedActionPurpose,
} from "./signed-actions.js";
import {
  AuthenticationError,
  LocalRequestAuthenticator,
  type RequestAuthenticator,
} from "./auth.js";
import type { StripeBillingService } from "./billing.js";
import { presentGoal, presentStage } from "./training-presentation.js";
import type { WebOnboardingService } from "./web-onboarding-service.js";
import { createLiveKitJoinToken, type LiveKitConfig } from "./livekit.js";
import {
  DeterministicVideoUploadSigner,
  type VideoUploadSigner,
} from "./storage.js";

const errorCodes = [
  "AUTH_REQUIRED",
  "ACCESS_DENIED",
  "VALIDATION_FAILED",
  "RESOURCE_NOT_FOUND",
  "IDEMPOTENCY_CONFLICT",
  "SAFETY_REVIEW_REQUIRED",
  "PLAN_GENERATION_BLOCKED",
  "UNSUPPORTED_GOAL",
  "PROTOCOL_NOT_ELIGIBLE",
  "STALE_VERSION",
  "SIGNED_ACTION_INVALID",
  "SIGNED_ACTION_EXPIRED",
  "SIGNED_ACTION_REPLAYED",
  "BILLING_UNAVAILABLE",
  "LIVEKIT_UNAVAILABLE",
  "RATE_LIMITED",
] as const;
type ErrorCode = (typeof errorCodes)[number];

class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
  }
}

const errorSchema = {
  type: "object",
  additionalProperties: false,
  required: ["error", "traceId"],
  properties: {
    error: {
      type: "object",
      additionalProperties: false,
      required: ["code", "message"],
      properties: {
        code: { type: "string", enum: errorCodes },
        message: { type: "string" },
      },
    },
    traceId: { type: "string" },
  },
} as const;
const stateSchema = { type: "object", additionalProperties: true } as const;
const commonResponses = {
  400: errorSchema,
  401: errorSchema,
  403: errorSchema,
  404: errorSchema,
  409: errorSchema,
  429: errorSchema,
};
const mutationHeaders = {
  type: "object",
  required: ["idempotency-key"],
  properties: {
    authorization: { type: "string" },
    "x-dogos-user": { type: "string", enum: localAgentIdentities },
    "idempotency-key": { type: "string", minLength: 4, maxLength: 120 },
    "x-request-id": { type: "string" },
  },
} as const;
const authHeaders = {
  type: "object",
  properties: {
    authorization: { type: "string" },
    "x-dogos-user": { type: "string", enum: localAgentIdentities },
  },
} as const;
const idParams = {
  type: "object",
  additionalProperties: false,
  required: ["id"],
  properties: { id: { type: "string", minLength: 1 } },
} as const;
const caseShareScopes = [
  "dog_profile.read",
  "goal.read",
  "plan.read",
  "session.read",
  "progress.read",
  "media.selected.read",
  "feedback.submit",
  "trainer_review.submit",
  "veterinary_note.submit",
  "plan_proposal.submit",
  "booking.create",
] as const;
const collaboratorRoles = [
  "observer_guest",
  "trainer",
  "veterinarian",
  "professional_assistant",
] as const;

function requireWrite(actor: AgentActorContext): void {
  if (!["owner", "caregiver"].includes(actor.role))
    throw new ApiError(
      403,
      "ACCESS_DENIED",
      "This role cannot change the household",
    );
}
function requireOwner(actor: AgentActorContext): void {
  if (actor.role !== "owner") {
    throw new ApiError(
      403,
      "ACCESS_DENIED",
      "Only an owner can manage this resource",
    );
  }
}
function key(request: FastifyRequest): string {
  const value = request.headers["idempotency-key"];
  if (typeof value !== "string")
    throw new ApiError(400, "VALIDATION_FAILED", "Idempotency-Key is required");
  return value;
}

function requestHash(body: unknown): string {
  return createHash("sha256").update(JSON.stringify(body)).digest("hex");
}

function toCanonicalCode(prefix: string, value: string | null | undefined) {
  const normalized = (value ?? "unknown")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9.]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `${prefix}.${normalized || "unknown"}`;
}

function contextEntityId(kind: string, value: string): string {
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) {
    return value;
  }
  const hex = createHash("sha256").update(`${kind}:${value}`).digest("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `5${hex.slice(13, 16)}`,
    `${((Number.parseInt(hex.slice(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, "0")}${hex.slice(18, 20)}`,
    hex.slice(20, 32),
  ].join("-");
}

function memoryFactCode(record: MemoryFactRecord): string {
  return toCanonicalCode("memory", record.subject);
}

function evidenceIds(record: MemoryFactRecord): string[] {
  return record.evidenceRefs
    .map((ref) => {
      if (typeof ref === "string") return ref;
      if (
        typeof ref === "object" &&
        ref !== null &&
        "id" in ref &&
        typeof ref.id === "string"
      ) {
        return ref.id;
      }
      return null;
    })
    .filter(
      (id): id is string =>
        id !== null &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          id,
        ),
    );
}

function aiTaskForCoachContext(
  contextKind: CoachContextKind | undefined,
  message: string,
): string {
  if (
    contextKind === "progress" ||
    /\b(progress|evidence|fortschritt)\b/i.test(message)
  ) {
    return "progress.explain";
  }
  if (
    contextKind === "plan" ||
    /\b(plan|calendar|schedule|kalender)\b/i.test(message)
  ) {
    return "plan.explain";
  }
  if (contextKind === "media") return "video.report";
  return "coach.chat";
}

async function compileCoachContextSnapshot(input: {
  dashboard: ProductDashboard | null | undefined;
  dogId: string;
  fallback: LocalProductFixture;
  householdId: string;
  locale: "de-CH" | "en";
  memories: MemoryStore;
}): Promise<CoachingContextCapsule> {
  const snapshot = input.fallback.snapshot();
  const dashboard = input.dashboard;
  const generatedAt = new Date().toISOString();
  const goalCode = toCanonicalCode(
    "goal",
    dashboard?.goal ?? snapshot.goal ?? "unknown",
  );
  const recentMeasurements: Measurement[] =
    dashboard?.baselineSuccessRate === undefined
      ? []
      : [
          {
            metricCode: "metric.success_rate",
            value: dashboard.baselineSuccessRate,
            unit: "unit.percent",
            unknown: false,
            source: "owner_report",
            method: "method.onboarding_baseline",
            measuredAt: generatedAt,
            quality: "moderate",
          },
        ];
  return buildCoachingContext(
    {
      activeStep:
        dashboard?.currentStep === null || dashboard?.currentStep === undefined
          ? null
          : {
              code: dashboard.currentStep.stepCode,
              difficulty: dashboard.currentStep.difficulty,
              durationSeconds: dashboard.currentStep.durationSeconds,
              repetitionCap: dashboard.currentStep.repetitions,
              version: 1,
            },
      advisories:
        dashboard?.riskDisposition === undefined ||
        dashboard.riskDisposition === "continue_low_risk_training"
          ? []
          : [
              {
                affectedActivityCode:
                  dashboard.currentStep?.stepCode ?? "activity.training",
                code: toCanonicalCode("safety", dashboard.riskDisposition),
                level: "professional_review",
                message: {
                  "de-CH":
                    "DogOS behandelt diese Situation vorsichtig und empfiehlt professionelle Prüfung.",
                  en: "DogOS treats this situation cautiously and recommends professional review.",
                },
              },
            ],
      claims: [],
      dog: {
        breedDescription:
          dashboard?.dogProfileSummary ?? snapshot.dog.breed ?? "unknown",
        developmentStage: "unknown",
        id: contextEntityId("dog", input.dogId),
        name: dashboard?.dogName ?? snapshot.dog.name,
      },
      generatedAt,
      goal: {
        code: goalCode,
        ownerDescription:
          dashboard?.goalText ?? dashboard?.goal ?? snapshot.goal ?? "unknown",
      },
      locale: input.locale,
      recentMeasurements,
      sources: [],
      unknownFactCodes: [
        "knowledge.approved_claims",
        "history.relevant_episodes",
        "video.timestamped_observations",
        "questions.unresolved",
      ],
    },
    {
      findRelevant: async ({ limit }) => {
        const query = dashboard?.goalText ?? dashboard?.goal;
        const records = await input.memories.getRelevantMemory({
          dogId: input.dogId,
          householdId: input.householdId,
          ...(query === undefined ? {} : { query }),
        });
        return records.slice(0, limit).map((record): CoachingMemoryFact => ({
          evidenceIds: evidenceIds(record).map((id) =>
            contextEntityId("evidence", id),
          ),
          factCode: memoryFactCode(record),
          id: contextEntityId("memory", record.id),
          observedAt:
            record.observedAt ??
            record.confirmedAt ??
            record.createdAt ??
            generatedAt,
          source:
            record.category === "derived_pattern"
              ? "system_measurement"
              : "owner_report",
          value: record.value,
        }));
      },
    },
  );
}

function handoffReasonCode(input: {
  reason?: string;
  targetProfessionalType: ProfessionalHandoffTarget;
}): string {
  return toCanonicalCode(
    `handoff.${input.targetProfessionalType}`,
    input.reason ?? "owner_requested_case_review",
  );
}

function buildProfessionalHandoffArtifact(input: {
  dashboard: ProductDashboard;
  memories: MemoryFactRecord[];
  reason?: string;
  targetProfessionalType: ProfessionalHandoffTarget;
  videos: VideoAnalysisRecord[];
}): {
  disagreements: string[];
  evidenceRefs: ProfessionalHandoffEvidenceRef[];
  summary: ProfessionalHandoffSummary;
} {
  const reviewedVideos = input.videos.filter(
    (video) => video.status === "completed",
  );
  const videoFindingsCount = reviewedVideos.reduce(
    (count, video) => count + video.findings.length,
    0,
  );
  const evidenceRefs: ProfessionalHandoffEvidenceRef[] = [
    ...(input.dashboard.planId === null
      ? []
      : [
          {
            id: input.dashboard.planId,
            kind: "plan" as const,
            label: "Active training plan",
          },
        ]),
    ...input.memories.slice(0, 6).map((memory) => ({
      id: memory.id,
      kind: "memory" as const,
      label: `${memory.subject}: ${memory.value}`.slice(0, 160),
    })),
    ...reviewedVideos.slice(0, 6).map((video) => ({
      id: video.id,
      kind: "video" as const,
      label: `${video.originalFilename} (${video.findings.length} findings)`,
    })),
  ];
  const disagreements = [
    ...(reviewedVideos.length === 0
      ? ["No reviewed video evidence is attached to this handoff yet."]
      : []),
    ...(input.memories.length === 0
      ? ["No owner-confirmed memory facts matched the current goal query."]
      : []),
    ...(input.dashboard.riskDisposition === "continue_low_risk_training"
      ? []
      : [
          `Safety engine disposition is ${input.dashboard.riskDisposition}; professional review should resolve this before harder training.`,
        ]),
    ...(videoFindingsCount === 0 && reviewedVideos.length > 0
      ? ["Reviewed videos exist, but no timestamped CV findings were recorded."]
      : []),
  ];
  const targetLabel =
    input.targetProfessionalType === "veterinary" ? "veterinarian" : "trainer";
  return {
    disagreements,
    evidenceRefs,
    summary: {
      dog: {
        currentStep: input.dashboard.currentStep?.stepCode ?? null,
        goalText: input.dashboard.goalText,
        name: input.dashboard.dogName,
        profileSummary: input.dashboard.dogProfileSummary ?? null,
      },
      evidenceCounts: {
        confirmedMemory: input.memories.length,
        reviewedVideo: reviewedVideos.length,
        videoFindings: videoFindingsCount,
      },
      ownerRequest:
        input.reason ??
        `Owner requested a ${targetLabel} handoff for the current training case.`,
      professionalQuestion:
        input.targetProfessionalType === "veterinary"
          ? "Please review possible health, pain, medication, mobility, or sensory contributors before DogOS increases criteria."
          : "Please confirm trigger distance, reinforcement setup, criteria, handler timing, and whether the current micro-session should progress or regress.",
      risk: {
        disposition: input.dashboard.riskDisposition,
        latestDecision: input.dashboard.latestDecision,
      },
      trainingStatus: {
        baselineSuccessRate: input.dashboard.baselineSuccessRate,
        planStatus: input.dashboard.planStatus,
        sessionCount: input.dashboard.sessionCount,
        targetSuccessRate: input.dashboard.targetSuccessRate ?? null,
      },
      transparency:
        "AI-assisted DogOS case packet. It summarizes owner-approved product data and evidence references; it is not a veterinary diagnosis and preserves unknowns for professional review.",
    },
  };
}

export interface BuildAppOptions {
  accounts?: Pick<AccountRepository, "resolveByAppUser">;
  authenticator?: RequestAuthenticator;
  billing?: Pick<
    StripeBillingService,
    "createCheckout" | "createPortal" | "processWebhook"
  >;
  coach?: CoachConversationService;
  onboarding?: Pick<WebOnboardingService, "get" | "send">;
  products?: Pick<
    OnboardingRepository,
    "dashboardByDog" | "findPrimaryByHousehold"
  >;
  commands?: Pick<PostgresRepository, "completeSession" | "startSession">;
  usage?: Pick<
    CapabilityUsageRepository,
    | "consumeCoachingMessage"
    | "consumeLiveCoachingMinutes"
    | "consumeVideoAnalysis"
  >;
  liveKit?: LiveKitConfig;
  contextSnapshots?: ContextSnapshotStore;
  liveSessions?: LiveCoachingStore;
  memories?: MemoryStore;
  marketplace?: PartnerMarketplaceStore;
  professionalHandoffs?: ProfessionalHandoffStore;
  collaboration?: CollaborationStore;
  privacy?: PrivacyStore;
  search?: SearchStore;
  videoUploads?: VideoUploadSigner;
  videos?: VideoAnalysisStore;
  product?: LocalProductFixture;
  readiness?: {
    ai?: AiCapabilityReadiness;
    database: boolean;
    liveKit: boolean;
    openAI: boolean;
    stripe: boolean;
    supabaseStorage: boolean;
    workers: boolean;
  };
  signedActions?: SignedActionService;
  webOrigin?: string;
}

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const app = Fastify({
    logger: process.env.NODE_ENV !== "test",
    requestIdHeader: "x-request-id",
  });
  const product = options.product ?? new LocalProductFixture();
  const coach =
    options.coach ??
    new CoachConversationService(new InMemoryCoachConversationStore());
  const videos = options.videos ?? new InMemoryVideoAnalysisStore();
  const videoUploads =
    options.videoUploads ?? new DeterministicVideoUploadSigner();
  const liveSessions = options.liveSessions ?? new InMemoryLiveCoachingStore();
  const contextSnapshots =
    options.contextSnapshots ?? new InMemoryContextSnapshotStore();
  const memories = options.memories ?? new InMemoryMemoryStore();
  const marketplace =
    options.marketplace ?? new InMemoryPartnerMarketplaceStore();
  const professionalHandoffs =
    options.professionalHandoffs ?? new InMemoryProfessionalHandoffStore();
  const collaboration =
    options.collaboration ?? new InMemoryCollaborationStore();
  const privacy = options.privacy ?? new InMemoryPrivacyStore();
  const search = options.search ?? new InMemorySearchStore();
  const authenticator =
    options.authenticator ?? new LocalRequestAuthenticator("test");
  const signed =
    options.signedActions ??
    new SignedActionService(
      { local1: "local-only-change-before-production-32-chars" },
      "local1",
    );
  const configuredWebOrigin = options.webOrigin ?? process.env.WEB_ORIGIN;
  const readiness = options.readiness ?? {
    ai: undefined,
    database: options.products !== undefined,
    liveKit: options.liveKit !== undefined,
    openAI: options.coach !== undefined,
    stripe: options.billing !== undefined,
    supabaseStorage: options.videoUploads !== undefined,
    workers: options.videos !== undefined,
  };
  const allowedWebOrigins =
    process.env.NODE_ENV === "production"
      ? (configuredWebOrigin ?? false)
      : [
          ...new Set(
            [
              configuredWebOrigin,
              "http://localhost:3000",
              "http://127.0.0.1:3000",
            ].filter((origin): origin is string => origin !== undefined),
          ),
        ];
  app.register(swagger, {
    openapi: {
      openapi: "3.1.0",
      info: { title: "DogOS API", version: "0.2.5" },
      components: {
        securitySchemes: {
          bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
          localIdentity: { type: "apiKey", in: "header", name: "x-dogos-user" },
        },
      },
    },
  });
  app.register(cors, {
    allowedHeaders: [
      "content-type",
      "authorization",
      "idempotency-key",
      "x-dogos-user",
      "x-request-id",
    ],
    maxAge: 600,
    methods: ["GET", "POST", "OPTIONS"],
    origin: allowedWebOrigins,
  });
  app.register(rawBody, { global: false, encoding: "utf8", runFirst: true });
  app.addContentTypeParser(
    "application/x-www-form-urlencoded",
    { parseAs: "string" },
    (_request, body, done) => done(null, body),
  );

  app.setErrorHandler((error, request, reply) => {
    const message = error instanceof Error ? error.message : "";
    const hasValidation =
      typeof error === "object" &&
      error !== null &&
      "validation" in error &&
      error.validation !== undefined;
    const apiError =
      error instanceof ApiError
        ? error
        : error instanceof AuthenticationError
          ? new ApiError(
              error.code === "AUTH_REQUIRED" ? 401 : 403,
              error.code,
              error.code === "AUTH_REQUIRED"
                ? "Authentication is required"
                : "Household access denied",
            )
          : error instanceof SignedActionError
            ? new ApiError(
                error.code === "SIGNED_ACTION_REPLAYED" ? 409 : 400,
                error.code,
                "The signed action is not valid",
              )
            : error instanceof IdempotencyConflictError ||
                message === "IDEMPOTENCY_CONFLICT"
              ? new ApiError(
                  409,
                  "IDEMPOTENCY_CONFLICT",
                  "The key was already used for another command",
                )
              : message === "RESOURCE_NOT_FOUND"
                ? new ApiError(404, "RESOURCE_NOT_FOUND", "Resource not found")
                : message === "STALE_VERSION"
                  ? new ApiError(
                      409,
                      "STALE_VERSION",
                      "The resource has already changed",
                    )
                  : message === "SAFETY_REVIEW_REQUIRED"
                    ? new ApiError(
                        409,
                        "SAFETY_REVIEW_REQUIRED",
                        "Professional review is required before training",
                      )
                    : message === "PLAN_GENERATION_BLOCKED"
                      ? new ApiError(
                          409,
                          "PLAN_GENERATION_BLOCKED",
                          "Safety assessment blocks plan generation",
                        )
                      : message === "IDENTITY_LINK_INVALID"
                        ? new ApiError(
                            400,
                            "SIGNED_ACTION_INVALID",
                            "The identity link is invalid or expired",
                          )
                        : new ApiError(
                            hasValidation ? 400 : 500,
                            "VALIDATION_FAILED",
                            hasValidation
                              ? "Request validation failed"
                              : "The request could not be completed",
                          );
    if (apiError.status >= 500) {
      request.log.error({ error }, "Unhandled DogOS API error");
    }
    void reply.status(apiError.status).send({
      error: { code: apiError.code, message: apiError.message },
      traceId: request.id,
    });
  });

  app.register(async function routes(routes) {
    routes.get("/health/live", { schema: { hide: true } }, async () => ({
      status: "ok" as const,
    }));
    routes.get("/health/ready", { schema: { hide: true } }, async () => ({
      checks: {
        api: "ready" as const,
        database: readiness.database ? "configured" : "not_configured",
        liveKit: readiness.liveKit ? "configured" : "not_configured",
        openAI: readiness.openAI ? "configured" : "deterministic",
        stripe: readiness.stripe ? "configured" : "not_configured",
        supabaseStorage: readiness.supabaseStorage
          ? "configured"
          : "deterministic",
        workers: readiness.workers ? "configured" : "in_process",
      },
      status: "ready" as const,
    }));
    routes.get(
      "/health/capabilities",
      { schema: { hide: true } },
      async () => ({
        capabilities: readiness.ai ?? {
          asr: "disabled",
          cv: "disabled",
          embedding: "disabled",
          knowledgeRelease: null,
          live: readiness.liveKit ? "ready" : "disabled",
          moderation: "disabled",
          policyVersion: "local-deterministic",
          text: readiness.openAI ? "ready" : "disabled",
          vod: readiness.workers ? "ready" : "disabled",
        },
      }),
    );
    routes.get("/openapi.json", { schema: { hide: true } }, async () =>
      routes.swagger(),
    );

    if (options.billing !== undefined) {
      routes.post(
        "/webhooks/stripe",
        {
          config: { rawBody: true },
          schema: {
            hide: true,
            headers: {
              type: "object",
              required: ["stripe-signature"],
              properties: { "stripe-signature": { type: "string" } },
            },
          },
        },
        async (request, reply) => {
          const raw = (request as FastifyRequest & { rawBody?: string })
            .rawBody;
          const signature = request.headers["stripe-signature"];
          if (raw === undefined || typeof signature !== "string") {
            return reply.status(400).send();
          }
          try {
            await options.billing!.processWebhook(raw, signature);
          } catch {
            return reply.status(400).send();
          }
          return reply.status(200).send({ received: true });
        },
      );
    }

    routes.get(
      "/v1/me",
      {
        schema: {
          operationId: "getMe",
          tags: ["account"],
          headers: authHeaders,
          response: { 200: stateSchema, ...commonResponses },
        },
      },
      async (request) => {
        const actor = await authenticator.authenticate(
          request.headers,
          request.id,
        );
        const account =
          options.accounts === undefined
            ? null
            : await options.accounts.resolveByAppUser(actor.actorId);
        if (options.accounts !== undefined && account === null) {
          throw new ApiError(404, "RESOURCE_NOT_FOUND", "Account not found");
        }
        return {
          identity: actor.identity,
          id: actor.actorId,
          role: actor.role,
          householdId: actor.householdId,
          authMode: actor.authMode,
          billingAvailable: options.billing !== undefined,
          locale: account?.locale ?? product.snapshot().locale,
          ...(account === null
            ? {}
            : {
                capabilities: account.capabilities,
                country: account.country,
                currency: account.currency,
                displayName: account.displayName,
                householdName: account.householdName,
                tier: account.tier,
                timezone: account.timezone,
              }),
        };
      },
    );

    routes.post(
      "/v1/billing/checkout",
      {
        schema: {
          operationId: "createBillingCheckout",
          tags: ["billing"],
          headers: mutationHeaders,
          body: {
            type: "object",
            additionalProperties: false,
            required: ["tier"],
            properties: {
              rewardfulReferralId: {
                type: "string",
                minLength: 1,
                maxLength: 120,
              },
              tier: { type: "string", enum: ["plus", "pro", "ultra"] },
            },
          },
          response: { 200: stateSchema, ...commonResponses },
        },
      },
      async (request) => {
        const actor = await authenticator.authenticate(
          request.headers,
          request.id,
        );
        requireOwner(actor);
        key(request);
        if (actor.householdId === null || options.billing === undefined) {
          throw new ApiError(
            409,
            "BILLING_UNAVAILABLE",
            "Billing is not configured for this environment",
          );
        }
        const body = request.body as {
          rewardfulReferralId?: string;
          tier: "plus" | "pro" | "ultra";
        };
        const url = await options.billing.createCheckout({
          householdId: actor.householdId,
          rewardfulReferralId: body.rewardfulReferralId ?? null,
          returnBaseUrl: configuredWebOrigin ?? "http://localhost:3000",
          tier: body.tier,
        });
        return { url };
      },
    );

    routes.post(
      "/v1/billing/portal",
      {
        schema: {
          operationId: "createBillingPortal",
          tags: ["billing"],
          headers: mutationHeaders,
          body: { type: "object", additionalProperties: false, properties: {} },
          response: { 200: stateSchema, ...commonResponses },
        },
      },
      async (request) => {
        const actor = await authenticator.authenticate(
          request.headers,
          request.id,
        );
        requireOwner(actor);
        key(request);
        if (actor.householdId === null || options.billing === undefined) {
          throw new ApiError(
            429,
            "RATE_LIMITED",
            "Billing is not configured for this environment",
          );
        }
        try {
          return {
            url: await options.billing.createPortal({
              householdId: actor.householdId,
              returnBaseUrl: configuredWebOrigin ?? "http://localhost:3000",
            }),
          };
        } catch (error) {
          if (
            error instanceof Error &&
            error.message === "STRIPE_CUSTOMER_NOT_FOUND"
          ) {
            throw new ApiError(
              409,
              "BILLING_UNAVAILABLE",
              "No billing account exists yet",
            );
          }
          throw error;
        }
      },
    );

    routes.get(
      "/v1/product",
      {
        schema: {
          operationId: "getProductDashboard",
          tags: ["product"],
          headers: authHeaders,
          response: { 200: stateSchema, ...commonResponses },
        },
      },
      async (request) => {
        const actor = await authenticator.authenticate(
          request.headers,
          request.id,
        );
        if (actor.householdId === null) {
          throw new ApiError(403, "ACCESS_DENIED", "Household access denied");
        }
        if (
          options.products === undefined &&
          (actor.householdId !== product.snapshot().household.id ||
            actor.identity === "unrelated")
        ) {
          throw new ApiError(403, "ACCESS_DENIED", "Household access denied");
        }
        const dashboard =
          options.products === undefined
            ? product.dashboard()
            : await options.products.findPrimaryByHousehold(actor.householdId);
        return dashboard === null || dashboard === undefined
          ? { status: "onboarding_required", householdId: actor.householdId }
          : { status: "ready", ...dashboard };
      },
    );

    routes.get(
      "/v1/onboarding",
      {
        schema: {
          operationId: "getOnboardingConversation",
          tags: ["onboarding"],
          headers: authHeaders,
          response: { 200: stateSchema, ...commonResponses },
        },
      },
      async (request) => {
        const actor = await authenticator.authenticate(
          request.headers,
          request.id,
        );
        requireOwner(actor);
        if (actor.householdId === null || options.onboarding === undefined) {
          throw new ApiError(
            404,
            "RESOURCE_NOT_FOUND",
            "Onboarding unavailable",
          );
        }
        const account = await options.accounts?.resolveByAppUser(actor.actorId);
        return options.onboarding.get({
          actorUserId: actor.actorId,
          householdId: actor.householdId,
          locale: account?.locale === "en" ? "en" : "de-CH",
        });
      },
    );

    routes.post(
      "/v1/onboarding/messages",
      {
        schema: {
          operationId: "sendOnboardingMessage",
          tags: ["onboarding"],
          headers: mutationHeaders,
          body: {
            type: "object",
            additionalProperties: false,
            required: ["message"],
            properties: {
              message: { type: "string", minLength: 1, maxLength: 2000 },
            },
          },
          response: { 200: stateSchema, ...commonResponses },
        },
      },
      async (request) => {
        const actor = await authenticator.authenticate(
          request.headers,
          request.id,
        );
        requireOwner(actor);
        if (actor.householdId === null || options.onboarding === undefined) {
          throw new ApiError(
            404,
            "RESOURCE_NOT_FOUND",
            "Onboarding unavailable",
          );
        }
        const account = await options.accounts?.resolveByAppUser(actor.actorId);
        return options.onboarding.send({
          actorUserId: actor.actorId,
          clientMessageId: key(request),
          householdId: actor.householdId,
          locale: account?.locale === "en" ? "en" : "de-CH",
          text: (request.body as { message: string }).message,
        });
      },
    );

    routes.get(
      "/v1/coach/conversation",
      {
        schema: {
          operationId: "getCoachConversation",
          tags: ["coach"],
          headers: authHeaders,
          querystring: {
            type: "object",
            additionalProperties: false,
            required: ["dogId"],
            properties: { dogId: { type: "string", format: "uuid" } },
          },
          response: { 200: stateSchema, ...commonResponses },
        },
      },
      async (request) => {
        const actor = await authenticator.authenticate(
          request.headers,
          request.id,
        );
        if (actor.householdId === null) {
          throw new ApiError(403, "ACCESS_DENIED", "Household access denied");
        }
        const dogId = (request.query as { dogId: string }).dogId;
        const dashboard = await options.products?.dashboardByDog(
          dogId,
          actor.householdId,
        );
        const account = await options.accounts?.resolveByAppUser(actor.actorId);
        const snapshot = product.snapshot();
        if (options.products !== undefined && dashboard === null) {
          throw new ApiError(403, "ACCESS_DENIED", "Household access denied");
        }
        if (
          options.products === undefined &&
          (actor.householdId !== snapshot.household.id ||
            dogId !== snapshot.dog.id ||
            actor.identity === "unrelated")
        ) {
          throw new ApiError(403, "ACCESS_DENIED", "Household access denied");
        }
        return coach.ensure({
          actorUserId: actor.actorId,
          dogId,
          householdId: actor.householdId,
          locale: account?.locale === "en" ? "en" : "de-CH",
        });
      },
    );

    routes.post(
      "/v1/coach/messages",
      {
        schema: {
          operationId: "sendCoachMessage",
          tags: ["coach"],
          headers: mutationHeaders,
          body: {
            type: "object",
            additionalProperties: false,
            required: ["dogId", "message"],
            properties: {
              dogId: { type: "string", format: "uuid" },
              message: { type: "string", minLength: 1, maxLength: 2000 },
              contextKind: {
                type: "string",
                enum: [
                  "today",
                  "plan",
                  "session",
                  "progress",
                  "media",
                  "general",
                ],
              },
              contextSubjectId: { type: "string", format: "uuid" },
            },
          },
          response: { 200: stateSchema, ...commonResponses },
        },
      },
      async (request, reply) => {
        const actor = await authenticator.authenticate(
          request.headers,
          request.id,
        );
        requireWrite(actor);
        if (actor.householdId === null) {
          throw new ApiError(403, "ACCESS_DENIED", "Household access denied");
        }
        const body = request.body as {
          dogId: string;
          message: string;
          contextKind?:
            "today" | "plan" | "session" | "progress" | "media" | "general";
          contextSubjectId?: string;
        };
        const dashboard = await options.products?.dashboardByDog(
          body.dogId,
          actor.householdId,
        );
        const account = await options.accounts?.resolveByAppUser(actor.actorId);
        const snapshot = product.snapshot();
        if (options.products !== undefined && dashboard === null) {
          throw new ApiError(403, "ACCESS_DENIED", "Household access denied");
        }
        if (
          options.products === undefined &&
          (actor.householdId !== snapshot.household.id ||
            body.dogId !== snapshot.dog.id ||
            actor.identity === "unrelated")
        ) {
          throw new ApiError(403, "ACCESS_DENIED", "Household access denied");
        }
        const quotaExhausted =
          account !== null &&
          account !== undefined &&
          options.usage !== undefined &&
          !(await options.usage.consumeCoachingMessage({
            actorUserId: actor.actorId,
            householdId: actor.householdId,
            limit: account.capabilities.coachingMessagesPerDay,
            timezone: account.timezone,
          }));
        const locale = account?.locale === "en" ? "en" : "de-CH";
        const contextSnapshot = await compileCoachContextSnapshot({
          dashboard:
            dashboard ??
            (options.products === undefined ? product.dashboard() : null),
          dogId: body.dogId,
          fallback: product,
          householdId: actor.householdId,
          locale,
          memories,
        });
        const aiTask = aiTaskForCoachContext(body.contextKind, body.message);
        const persistedContextSnapshot = await contextSnapshots.create({
          compilerVersion: "context-compiler.1.0",
          dogId: body.dogId,
          householdId: actor.householdId,
          knowledgeReleaseId: process.env.DOGOS_KNOWLEDGE_RELEASE_ID ?? null,
          locale,
          selectedReasons: {
            dashboard: dashboard === null ? "local_fixture" : "authorized_dog",
            memory: "confirmed_relevant_memory",
          },
          excludedReasons: {
            billing: "excluded_from_model_context",
            transcript: "complete_transcript_excluded",
            unreviewedKnowledge: "not_approved_for_runtime",
          },
          snapshot: JSON.parse(JSON.stringify(contextSnapshot)) as Record<
            string,
            string
          >,
          task: aiTask,
          tokenEstimate: Math.ceil(JSON.stringify(contextSnapshot).length / 4),
          truncatedCategories: contextSnapshot.unknownFactCodes,
          version: contextSnapshot.version,
        });
        const coachInput = {
          channel: "web",
          clientMessageId: key(request),
          context: {
            ...(dashboard?.baselineSuccessRate === undefined
              ? {}
              : { baselineSuccessRate: dashboard.baselineSuccessRate }),
            ...(dashboard?.behaviorConcernDescription === undefined
              ? {}
              : {
                  behaviorConcernDescription:
                    dashboard.behaviorConcernDescription,
                }),
            currentStep: dashboard?.currentStep ?? null,
            dogName: dashboard?.dogName ?? snapshot.dog.name,
            ...(dashboard?.dogProfileSummary === undefined
              ? {}
              : { dogProfileSummary: dashboard.dogProfileSummary }),
            durationMinutes: Math.round(
              (dashboard?.currentStep?.durationSeconds ?? 240) / 60,
            ),
            evidenceCount: dashboard?.sessionCount ?? snapshot.sessions.length,
            goal: presentGoal(dashboard?.goal ?? snapshot.goal, locale),
            latestDecision:
              dashboard?.latestDecision ?? snapshot.latestDecision,
            ...(quotaExhausted ? { quotaExhausted: true } : {}),
            ...(dashboard?.requiredConsecutiveSessions === undefined
              ? {}
              : {
                  requiredConsecutiveSessions:
                    dashboard.requiredConsecutiveSessions,
                }),
            ...(dashboard?.riskDisposition === undefined
              ? {}
              : { riskDisposition: dashboard.riskDisposition }),
            ...(dashboard?.calendar === undefined
              ? {}
              : { schedule: dashboard.calendar }),
            stage: presentStage(dashboard?.currentStep?.stepCode, locale),
            ...(dashboard?.targetSuccessRate === undefined
              ? {}
              : { targetSuccessRate: dashboard.targetSuccessRate }),
            contextSnapshot,
            contextSnapshotId: persistedContextSnapshot.id,
          },
          ...(body.contextKind === undefined
            ? {}
            : { contextKind: body.contextKind }),
          ...(body.contextSubjectId === undefined
            ? {}
            : { contextSubjectId: body.contextSubjectId }),
          links: {
            billing: "/app/account/billing",
            plan: "/app/coach?space=plan",
            progress: "/app/coach?space=progress",
            session: dashboard?.todaySessionId
              ? `/app/coach?space=train&session=${dashboard.todaySessionId}`
              : "/app/coach?space=train",
            today: "/app/coach?space=train",
          },
          message: body.message,
          scope: {
            actorUserId: actor.actorId,
            dogId: body.dogId,
            householdId: actor.householdId,
            locale,
          },
          tier: account?.tier ?? "freemium",
          traceId: request.id,
          ...(quotaExhausted ? { modelEnabled: false } : {}),
        } satisfies Parameters<CoachConversationService["send"]>[0];
        const streamRequested =
          (request.query as { stream?: unknown } | undefined)?.stream === "1";
        if (streamRequested) {
          return reply
            .type("text/plain; charset=utf-8")
            .header("cache-control", "no-store")
            .send(Readable.from(coach.sendStream(coachInput)));
        }
        return coach.send(coachInput);
      },
    );

    routes.get(
      "/v1/dogs/:id/video-analyses",
      {
        schema: {
          operationId: "listVideoAnalyses",
          tags: ["video"],
          headers: authHeaders,
          params: idParams,
          response: { 200: stateSchema, ...commonResponses },
        },
      },
      async (request) => {
        const actor = await authenticator.authenticate(
          request.headers,
          request.id,
        );
        if (actor.householdId === null) {
          throw new ApiError(403, "ACCESS_DENIED", "Household access denied");
        }
        const dogId = (request.params as { id: string }).id;
        const dashboard = await options.products?.dashboardByDog(
          dogId,
          actor.householdId,
        );
        const snapshot = product.snapshot();
        if (options.products !== undefined && dashboard === null) {
          throw new ApiError(403, "ACCESS_DENIED", "Household access denied");
        }
        if (
          options.products === undefined &&
          (actor.householdId !== snapshot.household.id ||
            dogId !== snapshot.dog.id ||
            actor.identity === "unrelated")
        ) {
          throw new ApiError(403, "ACCESS_DENIED", "Household access denied");
        }
        return {
          analyses: await videos.list({
            dogId,
            householdId: actor.householdId,
          }),
        };
      },
    );

    routes.post(
      "/v1/dogs/:id/video-analyses",
      {
        schema: {
          operationId: "createVideoAnalysis",
          tags: ["video"],
          headers: mutationHeaders,
          params: idParams,
          body: {
            type: "object",
            additionalProperties: false,
            required: ["contentType", "originalFilename", "sizeBytes"],
            properties: {
              contentType: {
                type: "string",
                enum: ["video/mp4", "video/quicktime", "video/webm"],
              },
              originalFilename: {
                type: "string",
                minLength: 1,
                maxLength: 180,
              },
              sizeBytes: {
                type: "integer",
                minimum: 1,
                maximum: 262_144_000,
              },
            },
          },
          response: { 200: stateSchema, ...commonResponses },
        },
      },
      async (request) => {
        const actor = await authenticator.authenticate(
          request.headers,
          request.id,
        );
        requireWrite(actor);
        key(request);
        if (actor.householdId === null) {
          throw new ApiError(403, "ACCESS_DENIED", "Household access denied");
        }
        const dogId = (request.params as { id: string }).id;
        const dashboard = await options.products?.dashboardByDog(
          dogId,
          actor.householdId,
        );
        const account = await options.accounts?.resolveByAppUser(actor.actorId);
        const snapshot = product.snapshot();
        if (options.products !== undefined && dashboard === null) {
          throw new ApiError(403, "ACCESS_DENIED", "Household access denied");
        }
        if (
          options.products === undefined &&
          (actor.householdId !== snapshot.household.id ||
            dogId !== snapshot.dog.id ||
            actor.identity === "unrelated")
        ) {
          throw new ApiError(403, "ACCESS_DENIED", "Household access denied");
        }
        if (
          account !== null &&
          account !== undefined &&
          options.usage !== undefined &&
          !(await options.usage.consumeVideoAnalysis({
            actorUserId: actor.actorId,
            householdId: actor.householdId,
            limit: account.capabilities.videoAnalysesPerMonth,
            timezone: account.timezone,
          }))
        ) {
          throw new ApiError(
            409,
            "BILLING_UNAVAILABLE",
            "The monthly video analysis limit has been reached",
          );
        }
        const body = request.body as {
          contentType: "video/mp4" | "video/quicktime" | "video/webm";
          originalFilename: string;
          sizeBytes: number;
        };
        const analysis = await videos.create({
          actorUserId: actor.actorId,
          contentType: body.contentType,
          dogId,
          householdId: actor.householdId,
          originalFilename: body.originalFilename,
          sizeBytes: body.sizeBytes,
        });
        const upload = await videoUploads.createUpload({
          contentType: analysis.contentType,
          objectKey: analysis.storageObjectKey,
        });
        return {
          analysis,
          upload,
        };
      },
    );

    routes.get(
      "/v1/video-analyses/:id",
      {
        schema: {
          operationId: "getVideoAnalysis",
          tags: ["video"],
          headers: authHeaders,
          params: idParams,
          response: { 200: stateSchema, ...commonResponses },
        },
      },
      async (request) => {
        const actor = await authenticator.authenticate(
          request.headers,
          request.id,
        );
        if (actor.householdId === null) {
          throw new ApiError(403, "ACCESS_DENIED", "Household access denied");
        }
        const analysis = await videos.get({
          householdId: actor.householdId,
          id: (request.params as { id: string }).id,
        });
        if (analysis === null) {
          throw new ApiError(404, "RESOURCE_NOT_FOUND", "Video not found");
        }
        return { analysis };
      },
    );

    routes.post(
      "/v1/video-analyses/:id/complete-upload",
      {
        schema: {
          operationId: "completeVideoUpload",
          tags: ["video"],
          headers: mutationHeaders,
          params: idParams,
          body: { type: "object", additionalProperties: false, properties: {} },
          response: { 200: stateSchema, ...commonResponses },
        },
      },
      async (request) => {
        const actor = await authenticator.authenticate(
          request.headers,
          request.id,
        );
        requireWrite(actor);
        key(request);
        if (actor.householdId === null) {
          throw new ApiError(403, "ACCESS_DENIED", "Household access denied");
        }
        return {
          analysis: await videos.completeUpload({
            actorUserId: actor.actorId,
            householdId: actor.householdId,
            id: (request.params as { id: string }).id,
          }),
        };
      },
    );

    routes.post(
      "/v1/dogs/:id/live-sessions",
      {
        schema: {
          operationId: "createLiveCoachingSession",
          tags: ["live"],
          headers: mutationHeaders,
          params: idParams,
          body: {
            type: "object",
            additionalProperties: false,
            required: ["plannedMinutes"],
            properties: {
              plannedMinutes: { type: "integer", minimum: 1, maximum: 60 },
            },
          },
          response: { 200: stateSchema, ...commonResponses },
        },
      },
      async (request) => {
        const actor = await authenticator.authenticate(
          request.headers,
          request.id,
        );
        requireWrite(actor);
        key(request);
        if (actor.householdId === null) {
          throw new ApiError(403, "ACCESS_DENIED", "Household access denied");
        }
        if (options.liveKit === undefined) {
          throw new ApiError(
            409,
            "LIVEKIT_UNAVAILABLE",
            "LiveKit is not configured for this environment",
          );
        }
        const dogId = (request.params as { id: string }).id;
        const dashboard = await options.products?.dashboardByDog(
          dogId,
          actor.householdId,
        );
        const account = await options.accounts?.resolveByAppUser(actor.actorId);
        const snapshot = product.snapshot();
        if (options.products !== undefined && dashboard === null) {
          throw new ApiError(403, "ACCESS_DENIED", "Household access denied");
        }
        if (
          options.products === undefined &&
          (actor.householdId !== snapshot.household.id ||
            dogId !== snapshot.dog.id ||
            actor.identity === "unrelated")
        ) {
          throw new ApiError(403, "ACCESS_DENIED", "Household access denied");
        }
        const body = request.body as { plannedMinutes: number };
        if (
          account !== null &&
          account !== undefined &&
          options.usage !== undefined &&
          !(await options.usage.consumeLiveCoachingMinutes({
            actorUserId: actor.actorId,
            householdId: actor.householdId,
            limit: account.capabilities.liveCoachingMinutesPerMonth,
            minutes: body.plannedMinutes,
            timezone: account.timezone,
          }))
        ) {
          throw new ApiError(
            409,
            "BILLING_UNAVAILABLE",
            "The monthly live coaching minute limit has been reached",
          );
        }
        const session = await liveSessions.create({
          actorUserId: actor.actorId,
          dogId,
          householdId: actor.householdId,
          plannedMinutes: body.plannedMinutes,
        });
        const token = await createLiveKitJoinToken({
          config: options.liveKit,
          identity: actor.actorId,
          metadata: {
            dogId,
            householdId: actor.householdId,
            liveSessionId: session.id,
          },
          roomName: session.roomName,
        });
        return {
          liveKit: {
            token,
            url: options.liveKit.url,
          },
          session,
        };
      },
    );

    routes.get(
      "/v1/live-sessions/:id",
      {
        schema: {
          operationId: "getLiveCoachingSession",
          tags: ["live"],
          headers: authHeaders,
          params: idParams,
          response: { 200: stateSchema, ...commonResponses },
        },
      },
      async (request) => {
        const actor = await authenticator.authenticate(
          request.headers,
          request.id,
        );
        if (actor.householdId === null) {
          throw new ApiError(403, "ACCESS_DENIED", "Household access denied");
        }
        const session = await liveSessions.get({
          householdId: actor.householdId,
          id: (request.params as { id: string }).id,
        });
        if (session === null) {
          throw new ApiError(
            404,
            "RESOURCE_NOT_FOUND",
            "Live session not found",
          );
        }
        return { session };
      },
    );

    routes.post(
      "/v1/live-sessions/:id/complete",
      {
        schema: {
          operationId: "completeLiveCoachingSession",
          tags: ["live"],
          headers: mutationHeaders,
          params: idParams,
          body: {
            type: "object",
            additionalProperties: false,
            required: ["consumedMinutes", "summary"],
            properties: {
              consumedMinutes: { type: "integer", minimum: 0, maximum: 60 },
              summary: { type: "string", minLength: 1, maxLength: 1200 },
            },
          },
          response: { 200: stateSchema, ...commonResponses },
        },
      },
      async (request) => {
        const actor = await authenticator.authenticate(
          request.headers,
          request.id,
        );
        requireWrite(actor);
        key(request);
        if (actor.householdId === null) {
          throw new ApiError(403, "ACCESS_DENIED", "Household access denied");
        }
        const body = request.body as {
          consumedMinutes: number;
          summary: string;
        };
        return {
          session: await liveSessions.complete({
            consumedMinutes: body.consumedMinutes,
            householdId: actor.householdId,
            id: (request.params as { id: string }).id,
            summary: body.summary,
          }),
        };
      },
    );

    routes.get(
      "/v1/dogs/:id/partner-offers",
      {
        schema: {
          operationId: "listPartnerOffers",
          tags: ["partners"],
          headers: authHeaders,
          params: idParams,
          querystring: {
            type: "object",
            additionalProperties: false,
            properties: {
              kind: {
                type: "string",
                enum: [
                  "affiliate_equipment",
                  "affiliate_food",
                  "trainer_booking",
                  "veterinary_triage",
                ],
              },
            },
          },
          response: { 200: stateSchema, ...commonResponses },
        },
      },
      async (request) => {
        const actor = await authenticator.authenticate(
          request.headers,
          request.id,
        );
        if (actor.householdId === null) {
          throw new ApiError(403, "ACCESS_DENIED", "Household access denied");
        }
        const dogId = (request.params as { id: string }).id;
        const dashboard = await options.products?.dashboardByDog(
          dogId,
          actor.householdId,
        );
        const snapshot = product.snapshot();
        if (options.products !== undefined && dashboard === null) {
          throw new ApiError(403, "ACCESS_DENIED", "Household access denied");
        }
        if (
          options.products === undefined &&
          (actor.householdId !== snapshot.household.id ||
            dogId !== snapshot.dog.id ||
            actor.identity === "unrelated")
        ) {
          throw new ApiError(403, "ACCESS_DENIED", "Household access denied");
        }
        const query = request.query as { kind?: PartnerOfferKind };
        return {
          offers: await marketplace.listOffers({
            dogId,
            householdId: actor.householdId,
            kind: query.kind ?? null,
          }),
        };
      },
    );

    routes.post(
      "/v1/dogs/:id/partner-referrals",
      {
        schema: {
          operationId: "createPartnerReferral",
          tags: ["partners"],
          headers: mutationHeaders,
          params: idParams,
          body: {
            type: "object",
            additionalProperties: false,
            required: ["offerId"],
            properties: {
              offerId: { type: "string", format: "uuid" },
              rewardfulReferralId: {
                type: "string",
                minLength: 1,
                maxLength: 120,
              },
            },
          },
          response: { 200: stateSchema, ...commonResponses },
        },
      },
      async (request) => {
        const actor = await authenticator.authenticate(
          request.headers,
          request.id,
        );
        requireWrite(actor);
        key(request);
        if (actor.householdId === null) {
          throw new ApiError(403, "ACCESS_DENIED", "Household access denied");
        }
        const body = request.body as {
          offerId: string;
          rewardfulReferralId?: string;
        };
        return {
          referral: await marketplace.createReferral({
            actorUserId: actor.actorId,
            dogId: (request.params as { id: string }).id,
            householdId: actor.householdId,
            offerId: body.offerId,
            rewardfulReferralId: body.rewardfulReferralId ?? null,
          }),
        };
      },
    );

    routes.post(
      "/v1/dogs/:id/referrals",
      {
        schema: {
          operationId: "createReferral",
          tags: ["professional-handoff"],
          headers: mutationHeaders,
          params: idParams,
          body: {
            type: "object",
            additionalProperties: false,
            properties: {
              reason: { type: "string", minLength: 1, maxLength: 500 },
              targetProfessionalType: {
                type: "string",
                enum: ["trainer", "veterinary"],
                default: "trainer",
              },
              ttlDays: { type: "integer", minimum: 1, maximum: 30 },
            },
          },
          response: { 200: stateSchema, ...commonResponses },
        },
      },
      async (request) => {
        const actor = await authenticator.authenticate(
          request.headers,
          request.id,
        );
        requireOwner(actor);
        key(request);
        if (actor.householdId === null) {
          throw new ApiError(403, "ACCESS_DENIED", "Household access denied");
        }
        const dogId = (request.params as { id: string }).id;
        const dashboard = await options.products?.dashboardByDog(
          dogId,
          actor.householdId,
        );
        const snapshot = product.snapshot();
        if (options.products !== undefined && dashboard === null) {
          throw new ApiError(403, "ACCESS_DENIED", "Household access denied");
        }
        if (
          options.products === undefined &&
          (actor.householdId !== snapshot.household.id ||
            dogId !== snapshot.dog.id ||
            actor.identity === "unrelated")
        ) {
          throw new ApiError(403, "ACCESS_DENIED", "Household access denied");
        }
        const body = request.body as {
          reason?: string;
          targetProfessionalType?: ProfessionalHandoffTarget;
          ttlDays?: number;
        };
        const effectiveDashboard =
          dashboard ??
          (options.products === undefined ? product.dashboard() : null);
        if (effectiveDashboard === null) {
          throw new ApiError(
            404,
            "RESOURCE_NOT_FOUND",
            "Dog training context was not found",
          );
        }
        const relevantMemoryByGoal = await memories.getRelevantMemory({
          dogId,
          householdId: actor.householdId,
          query: effectiveDashboard.goalText,
        });
        const relevantMemory =
          relevantMemoryByGoal.length > 0
            ? relevantMemoryByGoal
            : await memories.getRelevantMemory({
                dogId,
                householdId: actor.householdId,
              });
        const videoAnalyses = await videos.list({
          dogId,
          householdId: actor.householdId,
        });
        const targetProfessionalType = body.targetProfessionalType ?? "trainer";
        const artifact = buildProfessionalHandoffArtifact({
          dashboard: effectiveDashboard,
          memories: relevantMemory,
          targetProfessionalType,
          videos: videoAnalyses,
          ...(body.reason === undefined ? {} : { reason: body.reason }),
        });
        const ttlDays = body.ttlDays ?? 14;
        const shareExpiresAt = new Date(
          Date.now() + ttlDays * 24 * 60 * 60 * 1000,
        ).toISOString();
        return {
          handoff: await professionalHandoffs.create({
            actorUserId: actor.actorId,
            disagreements: artifact.disagreements,
            dogId,
            evidenceRefs: artifact.evidenceRefs,
            goalId: null,
            householdId: actor.householdId,
            reasonCode: handoffReasonCode({
              targetProfessionalType,
              ...(body.reason === undefined ? {} : { reason: body.reason }),
            }),
            shareExpiresAt,
            summary: artifact.summary,
            targetProfessionalType,
          }),
        };
      },
    );

    routes.post(
      "/v1/dogs/:id/case-share-grants",
      {
        schema: {
          operationId: "createCaseShareGrant",
          tags: ["collaboration"],
          headers: mutationHeaders,
          params: idParams,
          body: {
            type: "object",
            additionalProperties: false,
            required: ["recipientRole", "scopes", "subjectType"],
            properties: {
              expiresInDays: { type: "integer", minimum: 1, maximum: 30 },
              maxViews: { type: "integer", minimum: 1, maximum: 50 },
              recipientRole: { type: "string", enum: collaboratorRoles },
              scopes: {
                type: "array",
                minItems: 1,
                maxItems: 16,
                items: { type: "string", enum: caseShareScopes },
              },
              subjectId: { type: "string", format: "uuid" },
              subjectType: {
                type: "string",
                enum: [
                  "case",
                  "feedback_request",
                  "trainer_handoff",
                  "veterinary_handoff",
                  "video_analysis",
                  "live_session",
                ],
              },
            },
          },
          response: { 200: stateSchema, ...commonResponses },
        },
      },
      async (request) => {
        const actor = await authenticator.authenticate(
          request.headers,
          request.id,
        );
        requireOwner(actor);
        key(request);
        if (actor.householdId === null) {
          throw new ApiError(403, "ACCESS_DENIED", "Household access denied");
        }
        const dogId = (request.params as { id: string }).id;
        const dashboard = await options.products?.dashboardByDog(
          dogId,
          actor.householdId,
        );
        const snapshot = product.snapshot();
        if (options.products !== undefined && dashboard === null) {
          throw new ApiError(403, "ACCESS_DENIED", "Household access denied");
        }
        if (
          options.products === undefined &&
          (actor.householdId !== snapshot.household.id ||
            dogId !== snapshot.dog.id ||
            actor.identity === "unrelated")
        ) {
          throw new ApiError(403, "ACCESS_DENIED", "Household access denied");
        }
        const body = request.body as {
          expiresInDays?: number;
          maxViews?: number;
          recipientRole: CaseShareRecipientRole;
          scopes: CaseShareScope[];
          subjectId?: string;
          subjectType: string;
        };
        return {
          grant: await collaboration.createShareGrant({
            createdBy: actor.actorId,
            dogId,
            expiresAt: new Date(
              Date.now() + (body.expiresInDays ?? 14) * 24 * 60 * 60 * 1000,
            ).toISOString(),
            householdId: actor.householdId,
            maxViews: body.maxViews ?? 5,
            recipientRole: body.recipientRole,
            scopes: body.scopes,
            subjectId: body.subjectId ?? null,
            subjectType: body.subjectType,
          }),
        };
      },
    );

    routes.post(
      "/v1/dogs/:id/case-share-grants/:grantId/revoke",
      {
        schema: {
          operationId: "revokeCaseShareGrant",
          tags: ["collaboration"],
          headers: mutationHeaders,
          params: {
            type: "object",
            additionalProperties: false,
            required: ["id", "grantId"],
            properties: {
              grantId: { type: "string", format: "uuid" },
              id: { type: "string", minLength: 1 },
            },
          },
          body: { type: "object", additionalProperties: false, properties: {} },
          response: { 200: stateSchema, ...commonResponses },
        },
      },
      async (request) => {
        const actor = await authenticator.authenticate(
          request.headers,
          request.id,
        );
        requireOwner(actor);
        key(request);
        if (actor.householdId === null) {
          throw new ApiError(403, "ACCESS_DENIED", "Household access denied");
        }
        const params = request.params as { grantId: string; id: string };
        return {
          grant: await collaboration.revokeShareGrant({
            dogId: params.id,
            householdId: actor.householdId,
            id: params.grantId,
          }),
        };
      },
    );

    routes.post(
      "/v1/dogs/:id/feedback-requests",
      {
        schema: {
          operationId: "createFeedbackRequest",
          tags: ["collaboration"],
          headers: mutationHeaders,
          params: idParams,
          body: {
            type: "object",
            additionalProperties: false,
            required: ["questions", "recipientRole"],
            properties: {
              mediaRequested: { type: "boolean", default: false },
              questions: {
                type: "array",
                minItems: 1,
                maxItems: 8,
                items: { type: "string", minLength: 1, maxLength: 300 },
              },
              recipientRole: {
                type: "string",
                enum: [
                  "caregiver",
                  "observer_guest",
                  "trainer",
                  "veterinarian",
                ],
              },
            },
          },
          response: { 200: stateSchema, ...commonResponses },
        },
      },
      async (request) => {
        const actor = await authenticator.authenticate(
          request.headers,
          request.id,
        );
        requireWrite(actor);
        key(request);
        if (actor.householdId === null) {
          throw new ApiError(403, "ACCESS_DENIED", "Household access denied");
        }
        const dogId = (request.params as { id: string }).id;
        const dashboard = await options.products?.dashboardByDog(
          dogId,
          actor.householdId,
        );
        const snapshot = product.snapshot();
        if (options.products !== undefined && dashboard === null) {
          throw new ApiError(403, "ACCESS_DENIED", "Household access denied");
        }
        if (
          options.products === undefined &&
          (actor.householdId !== snapshot.household.id ||
            dogId !== snapshot.dog.id ||
            actor.identity === "unrelated")
        ) {
          throw new ApiError(403, "ACCESS_DENIED", "Household access denied");
        }
        const body = request.body as {
          mediaRequested?: boolean;
          questions: string[];
          recipientRole: string;
        };
        const grant =
          body.recipientRole === "observer_guest" ||
          body.recipientRole === "trainer" ||
          body.recipientRole === "veterinarian"
            ? await collaboration.createShareGrant({
                createdBy: actor.actorId,
                dogId,
                expiresAt: new Date(
                  Date.now() + 14 * 24 * 60 * 60 * 1000,
                ).toISOString(),
                householdId: actor.householdId,
                maxViews: 5,
                recipientRole: body.recipientRole as CaseShareRecipientRole,
                scopes: ["feedback.submit"],
                subjectType: "feedback_request",
              })
            : null;
        const feedbackRequest = await collaboration.createFeedbackRequest({
          dogId,
          householdId: actor.householdId,
          mediaRequested: body.mediaRequested ?? false,
          questions: body.questions,
          recipientRole: body.recipientRole,
          requestedBy: actor.actorId,
          shareGrantId: grant?.id ?? null,
        });
        return { feedbackRequest, grant };
      },
    );

    routes.post(
      "/v1/feedback-requests/:id/responses",
      {
        schema: {
          operationId: "submitFeedbackResponse",
          tags: ["collaboration"],
          headers: authHeaders,
          params: idParams,
          body: {
            type: "object",
            additionalProperties: false,
            required: ["certainty", "observationSummary", "responderRole"],
            properties: {
              certainty: { type: "number", minimum: 0, maximum: 1 },
              observationSummary: {
                type: "string",
                minLength: 1,
                maxLength: 1200,
              },
              responderRole: {
                type: "string",
                enum: [
                  "owner",
                  "caregiver",
                  "observer_guest",
                  "trainer",
                  "veterinarian",
                ],
              },
              shareToken: { type: "string", minLength: 20, maxLength: 200 },
              subjectiveInterpretation: {
                type: "string",
                minLength: 1,
                maxLength: 1200,
              },
            },
          },
          response: { 200: stateSchema, ...commonResponses },
        },
      },
      async (request) => {
        const body = request.body as {
          certainty: number;
          observationSummary: string;
          responderRole: string;
          shareToken?: string;
          subjectiveInterpretation?: string;
        };
        if (body.shareToken !== undefined) {
          const grant = await collaboration.resolveShareGrant({
            requiredScope: "feedback.submit",
            token: body.shareToken,
          });
          if (grant === null) {
            throw new ApiError(403, "ACCESS_DENIED", "Share grant denied");
          }
        } else {
          const actor = await authenticator.authenticate(
            request.headers,
            request.id,
          );
          requireWrite(actor);
        }
        return {
          response: await collaboration.submitFeedbackResponse({
            certainty: body.certainty,
            feedbackRequestId: (request.params as { id: string }).id,
            observationSummary: body.observationSummary,
            responderRole: body.responderRole,
            subjectiveInterpretation: body.subjectiveInterpretation ?? null,
          }),
        };
      },
    );

    routes.post(
      "/v1/dogs/:id/professional-reviews",
      {
        schema: {
          operationId: "submitProfessionalReview",
          tags: ["collaboration"],
          headers: authHeaders,
          params: idParams,
          body: {
            type: "object",
            additionalProperties: false,
            required: [
              "correctionType",
              "professionalRole",
              "shareToken",
              "summary",
              "targetType",
            ],
            properties: {
              correctionType: {
                type: "string",
                enum: [
                  "observation_confirmed",
                  "observation_corrected",
                  "observation_not_visible",
                  "interpretation_rejected",
                  "timing_corrected",
                  "plan_step_supported",
                  "plan_step_rejected",
                  "additional_context_requested",
                  "safety_escalation_supported",
                  "safety_escalation_corrected",
                ],
              },
              professionalRole: {
                type: "string",
                enum: ["trainer", "veterinarian"],
              },
              shareToken: { type: "string", minLength: 20, maxLength: 200 },
              summary: { type: "string", minLength: 1, maxLength: 1200 },
              targetId: { type: "string", format: "uuid" },
              targetType: {
                type: "string",
                enum: [
                  "case",
                  "feedback_response",
                  "video_analysis",
                  "live_session",
                  "plan",
                  "handoff_package",
                ],
              },
            },
          },
          response: { 200: stateSchema, ...commonResponses },
        },
      },
      async (request) => {
        const body = request.body as {
          correctionType: string;
          professionalRole: "trainer" | "veterinarian";
          shareToken: string;
          summary: string;
          targetId?: string;
          targetType: string;
        };
        const requiredScope =
          body.professionalRole === "veterinarian"
            ? "veterinary_note.submit"
            : "trainer_review.submit";
        const grant = await collaboration.resolveShareGrant({
          requiredScope,
          token: body.shareToken,
        });
        if (
          grant === null ||
          grant.dogId !== (request.params as { id: string }).id
        ) {
          throw new ApiError(403, "ACCESS_DENIED", "Share grant denied");
        }
        return {
          review: await collaboration.submitProfessionalReview({
            correctionType: body.correctionType,
            dogId: grant.dogId,
            householdId: grant.householdId,
            professionalRole: body.professionalRole,
            summary: body.summary,
            targetId: body.targetId ?? null,
            targetType: body.targetType,
          }),
        };
      },
    );

    routes.post(
      "/v1/dogs/:id/handoff-packages",
      {
        schema: {
          operationId: "createHandoffPackage",
          tags: ["collaboration"],
          headers: mutationHeaders,
          params: idParams,
          body: {
            type: "object",
            additionalProperties: false,
            required: ["consentReference", "packageType"],
            properties: {
              consentReference: {
                type: "string",
                minLength: 4,
                maxLength: 200,
              },
              packageType: {
                type: "string",
                enum: ["trainer_handoff", "veterinary_handoff"],
              },
              ttlDays: { type: "integer", minimum: 1, maximum: 30 },
            },
          },
          response: { 200: stateSchema, ...commonResponses },
        },
      },
      async (request) => {
        const actor = await authenticator.authenticate(
          request.headers,
          request.id,
        );
        requireOwner(actor);
        key(request);
        if (actor.householdId === null) {
          throw new ApiError(403, "ACCESS_DENIED", "Household access denied");
        }
        const dogId = (request.params as { id: string }).id;
        const productSnapshot = product.snapshot();
        if (
          options.products === undefined &&
          (actor.householdId !== productSnapshot.household.id ||
            dogId !== productSnapshot.dog.id ||
            actor.identity === "unrelated")
        ) {
          throw new ApiError(403, "ACCESS_DENIED", "Household access denied");
        }
        const dashboard =
          (await options.products?.dashboardByDog(dogId, actor.householdId)) ??
          (options.products === undefined ? product.dashboard() : null);
        if (dashboard === null) {
          throw new ApiError(404, "RESOURCE_NOT_FOUND", "Dog not found");
        }
        const body = request.body as {
          consentReference: string;
          packageType: "trainer_handoff" | "veterinary_handoff";
          ttlDays?: number;
        };
        const videosForDog = await videos.list({
          dogId,
          householdId: actor.householdId,
        });
        const memoriesForDog = await memories.getRelevantMemory({
          dogId,
          householdId: actor.householdId,
        });
        const handoffSnapshot: Record<string, unknown> = {
          dashboard,
          limits:
            body.packageType === "veterinary_handoff"
              ? "Veterinary package excludes diagnosis and affiliate recommendations."
              : "Trainer package excludes unrelated household history and billing.",
          memories: memoriesForDog.slice(0, 8),
          videos: videosForDog
            .filter((video) => video.status === "completed")
            .slice(0, 8),
        };
        return {
          package: await collaboration.createHandoffPackage({
            consentReference: body.consentReference,
            createdBy: actor.actorId,
            dogId,
            evidenceRefs: [
              ...memoriesForDog.slice(0, 8).map((memory) => ({
                id: memory.id,
                kind: "memory",
              })),
              ...videosForDog.slice(0, 8).map((video) => ({
                id: video.id,
                kind: "video",
              })),
            ],
            expiresAt: new Date(
              Date.now() + (body.ttlDays ?? 14) * 24 * 60 * 60 * 1000,
            ).toISOString(),
            householdId: actor.householdId,
            includedArtifactRefs: [
              { id: dashboard.dogId, kind: "dog_profile" },
              ...(dashboard.planId === null
                ? []
                : [{ id: dashboard.planId, kind: "plan" }]),
            ],
            locale: "de-CH",
            packageType: body.packageType,
            snapshot: handoffSnapshot,
          }),
        };
      },
    );

    routes.post(
      "/v1/handoff-packages/:id/deliveries",
      {
        schema: {
          operationId: "createHandoffDelivery",
          tags: ["collaboration"],
          headers: mutationHeaders,
          params: idParams,
          body: {
            type: "object",
            additionalProperties: false,
            required: ["deliveryMethod", "dogId"],
            properties: {
              deliveryMethod: {
                type: "string",
                enum: ["secure_link", "pdf_download", "secure_email"],
              },
              dogId: { type: "string", minLength: 1 },
              shareGrantId: { type: "string", format: "uuid" },
            },
          },
          response: { 200: stateSchema, ...commonResponses },
        },
      },
      async (request) => {
        const actor = await authenticator.authenticate(
          request.headers,
          request.id,
        );
        requireOwner(actor);
        key(request);
        if (actor.householdId === null) {
          throw new ApiError(403, "ACCESS_DENIED", "Household access denied");
        }
        const body = request.body as {
          deliveryMethod: "secure_link" | "pdf_download" | "secure_email";
          dogId: string;
          shareGrantId?: string;
        };
        return {
          delivery: await collaboration.createHandoffDelivery({
            createdBy: actor.actorId,
            deliveryMethod: body.deliveryMethod,
            dogId: body.dogId,
            handoffPackageId: (request.params as { id: string }).id,
            householdId: actor.householdId,
            shareGrantId: body.shareGrantId ?? null,
          }),
        };
      },
    );

    routes.get(
      "/v1/privacy/export",
      {
        schema: {
          operationId: "exportPrivacyData",
          tags: ["privacy"],
          headers: authHeaders,
          response: { 200: stateSchema, ...commonResponses },
        },
      },
      async (request) => {
        const actor = await authenticator.authenticate(
          request.headers,
          request.id,
        );
        requireOwner(actor);
        if (actor.householdId === null) {
          throw new ApiError(403, "ACCESS_DENIED", "Household access denied");
        }
        return privacy.exportData({
          actorUserId: actor.actorId,
          householdId: actor.householdId,
        });
      },
    );

    routes.post(
      "/v1/privacy/deletion-requests",
      {
        schema: {
          operationId: "createPrivacyDeletionRequest",
          tags: ["privacy"],
          headers: mutationHeaders,
          body: {
            type: "object",
            additionalProperties: false,
            properties: {
              reason: { type: "string", minLength: 1, maxLength: 500 },
            },
          },
          response: { 200: stateSchema, ...commonResponses },
        },
      },
      async (request) => {
        const actor = await authenticator.authenticate(
          request.headers,
          request.id,
        );
        requireOwner(actor);
        key(request);
        if (actor.householdId === null) {
          throw new ApiError(403, "ACCESS_DENIED", "Household access denied");
        }
        const body = request.body as { reason?: string };
        return {
          request: await privacy.createDeletionRequest({
            actorUserId: actor.actorId,
            householdId: actor.householdId,
            ...(body.reason === undefined ? {} : { reason: body.reason }),
          }),
        };
      },
    );

    routes.get(
      "/v1/memory",
      {
        schema: {
          operationId: "listOwnerMemory",
          tags: ["memory"],
          headers: authHeaders,
          querystring: {
            type: "object",
            additionalProperties: false,
            properties: {
              dogId: { type: "string", format: "uuid" },
              query: { type: "string", minLength: 1, maxLength: 200 },
              relevant: { type: "string", enum: ["1"] },
            },
          },
          response: { 200: stateSchema, ...commonResponses },
        },
      },
      async (request) => {
        const actor = await authenticator.authenticate(
          request.headers,
          request.id,
        );
        requireOwner(actor);
        if (actor.householdId === null) {
          throw new ApiError(403, "ACCESS_DENIED", "Household access denied");
        }
        const query = request.query as {
          dogId?: string;
          query?: string;
          relevant?: "1";
        };
        const facts =
          query.relevant === "1"
            ? await memories.getRelevantMemory({
                dogId: query.dogId ?? null,
                householdId: actor.householdId,
                ...(query.query === undefined ? {} : { query: query.query }),
              })
            : await memories.listOwnerVisibleMemory({
                householdId: actor.householdId,
              });
        return { facts };
      },
    );

    routes.post(
      "/v1/memory/candidates",
      {
        schema: {
          operationId: "createMemoryCandidate",
          tags: ["memory"],
          headers: mutationHeaders,
          body: {
            type: "object",
            additionalProperties: false,
            required: ["category", "subject", "value"],
            properties: {
              category: {
                type: "string",
                enum: [
                  "stable_profile",
                  "episodic_event",
                  "working_state",
                  "derived_pattern",
                  "temporary_state",
                ],
              },
              confidence: { type: "number", minimum: 0, maximum: 1 },
              dogId: { type: "string", format: "uuid" },
              evidenceRefs: { type: "array", maxItems: 12 },
              sourceMessageId: { type: "string", format: "uuid" },
              subject: { type: "string", minLength: 1, maxLength: 120 },
              value: { type: "string", minLength: 1, maxLength: 1000 },
            },
          },
          response: { 201: stateSchema, ...commonResponses },
        },
      },
      async (request, reply) => {
        const actor = await authenticator.authenticate(
          request.headers,
          request.id,
        );
        requireWrite(actor);
        key(request);
        if (actor.householdId === null) {
          throw new ApiError(403, "ACCESS_DENIED", "Household access denied");
        }
        const body = request.body as {
          category:
            | "stable_profile"
            | "episodic_event"
            | "working_state"
            | "derived_pattern"
            | "temporary_state";
          confidence?: number;
          dogId?: string;
          evidenceRefs?: unknown[];
          sourceMessageId?: string;
          subject: string;
          value: string;
        };
        const fact = await memories.createMemoryCandidate({
          category: body.category,
          ...(body.confidence === undefined
            ? {}
            : { confidence: body.confidence }),
          dogId: body.dogId ?? null,
          ...(body.evidenceRefs === undefined
            ? {}
            : { evidenceRefs: body.evidenceRefs }),
          householdId: actor.householdId,
          sourceMessageId: body.sourceMessageId ?? null,
          subject: body.subject.trim(),
          value: body.value.trim(),
        });
        return reply.status(201).send({ fact });
      },
    );

    routes.post(
      "/v1/memory/:id/confirm",
      {
        schema: {
          operationId: "confirmMemoryCandidate",
          tags: ["memory"],
          headers: mutationHeaders,
          params: idParams,
          body: { type: "object", additionalProperties: false, properties: {} },
          response: { 200: stateSchema, ...commonResponses },
        },
      },
      async (request) => {
        const actor = await authenticator.authenticate(
          request.headers,
          request.id,
        );
        requireOwner(actor);
        key(request);
        if (actor.householdId === null) {
          throw new ApiError(403, "ACCESS_DENIED", "Household access denied");
        }
        return {
          fact: await memories.confirmMemoryCandidate({
            actorUserId: actor.actorId,
            householdId: actor.householdId,
            id: (request.params as { id: string }).id,
          }),
        };
      },
    );

    routes.post(
      "/v1/memory/:id/correct",
      {
        schema: {
          operationId: "correctMemory",
          tags: ["memory"],
          headers: mutationHeaders,
          params: idParams,
          body: {
            type: "object",
            additionalProperties: false,
            required: ["value"],
            properties: {
              value: { type: "string", minLength: 1, maxLength: 1000 },
            },
          },
          response: { 200: stateSchema, ...commonResponses },
        },
      },
      async (request) => {
        const actor = await authenticator.authenticate(
          request.headers,
          request.id,
        );
        requireOwner(actor);
        key(request);
        if (actor.householdId === null) {
          throw new ApiError(403, "ACCESS_DENIED", "Household access denied");
        }
        return {
          fact: await memories.correctMemory({
            actorUserId: actor.actorId,
            householdId: actor.householdId,
            id: (request.params as { id: string }).id,
            value: (request.body as { value: string }).value.trim(),
          }),
        };
      },
    );

    routes.post(
      "/v1/memory/:id/forget",
      {
        schema: {
          operationId: "forgetMemory",
          tags: ["memory"],
          headers: mutationHeaders,
          params: idParams,
          body: { type: "object", additionalProperties: false, properties: {} },
          response: { 200: stateSchema, ...commonResponses },
        },
      },
      async (request) => {
        const actor = await authenticator.authenticate(
          request.headers,
          request.id,
        );
        requireOwner(actor);
        key(request);
        if (actor.householdId === null) {
          throw new ApiError(403, "ACCESS_DENIED", "Household access denied");
        }
        return {
          fact: await memories.forgetMemory({
            actorUserId: actor.actorId,
            householdId: actor.householdId,
            id: (request.params as { id: string }).id,
          }),
        };
      },
    );

    routes.get(
      "/v1/search",
      {
        schema: {
          operationId: "searchWorkspaceHistory",
          tags: ["search"],
          headers: authHeaders,
          querystring: {
            type: "object",
            additionalProperties: false,
            required: ["query"],
            properties: {
              dogId: { type: "string", format: "uuid" },
              limit: { type: "integer", minimum: 1, maximum: 50 },
              query: { type: "string", minLength: 1, maxLength: 200 },
            },
          },
          response: { 200: stateSchema, ...commonResponses },
        },
      },
      async (request) => {
        const actor = await authenticator.authenticate(
          request.headers,
          request.id,
        );
        if (actor.householdId === null) {
          throw new ApiError(403, "ACCESS_DENIED", "Household access denied");
        }
        const query = request.query as {
          dogId?: string;
          limit?: number;
          query: string;
        };
        return {
          results: await search.search({
            dogId: query.dogId ?? null,
            householdId: actor.householdId,
            limit: query.limit ?? 20,
            query: query.query,
          }),
        };
      },
    );

    const queryRoutes = [
      ["/v1/households/:id", "getHousehold"],
      ["/v1/dogs/:id", "getDog"],
      ["/v1/dogs/:id/current-plan", "getCurrentPlan"],
      ["/v1/plans/:id/calendar", "getPlanCalendar"],
      ["/v1/plans/:id/progress", "getPlanProgress"],
      ["/v1/sessions/:id", "getSession"],
      ["/v1/referrals/:id", "getReferral"],
    ] as const;
    for (const [url, operationId] of queryRoutes)
      routes.get(
        url,
        {
          schema: {
            operationId,
            tags: ["product"],
            headers: authHeaders,
            params: idParams,
            response: { 200: stateSchema, ...commonResponses },
          },
        },
        async (request) => {
          const actor = await authenticator.authenticate(
            request.headers,
            request.id,
          );
          if (actor.householdId === null)
            throw new ApiError(403, "ACCESS_DENIED", "Household access denied");
          if (options.products === undefined) {
            if (
              actor.householdId !== product.snapshot().household.id ||
              actor.identity === "unrelated"
            ) {
              throw new ApiError(
                403,
                "ACCESS_DENIED",
                "Household access denied",
              );
            }
            return product.snapshot();
          }
          const dashboard = await options.products.findPrimaryByHousehold(
            actor.householdId,
          );
          if (dashboard === null) {
            throw new ApiError(404, "RESOURCE_NOT_FOUND", "Product not found");
          }
          const requestedId = (request.params as { id: string }).id;
          const expectedIds = new Set([
            actor.householdId,
            dashboard.dogId,
            dashboard.planId,
            dashboard.todaySessionId,
            ...dashboard.calendar.map((entry) => entry.id),
          ]);
          if (!expectedIds.has(requestedId)) {
            throw new ApiError(404, "RESOURCE_NOT_FOUND", "Product not found");
          }
          return dashboard;
        },
      );

    routes.post(
      "/v1/local/reset",
      {
        schema: {
          operationId: "resetLocalProduct",
          tags: ["local"],
          headers: mutationHeaders,
          body: {
            type: "object",
            additionalProperties: false,
            properties: { locale: { type: "string", enum: ["de-CH", "en"] } },
          },
          response: { 200: stateSchema, ...commonResponses },
        },
      },
      async (request) => {
        const actor = await authenticator.authenticate(
          request.headers,
          request.id,
        );
        requireWrite(actor);
        const body = request.body as { locale?: "de-CH" | "en" };
        const result = product.command(actor.actorId, key(request), body, () =>
          product.reset(body.locale),
        ).result;
        await coach.clearForScope({
          dogId: result.dog.id,
          householdId: result.household.id,
        });
        return result;
      },
    );

    routes.post(
      "/v1/account/locale",
      {
        schema: {
          operationId: "switchLocale",
          tags: ["account"],
          headers: mutationHeaders,
          body: {
            type: "object",
            additionalProperties: false,
            required: ["locale"],
            properties: { locale: { type: "string", enum: ["de-CH", "en"] } },
          },
          response: { 200: stateSchema, ...commonResponses },
        },
      },
      async (request) => {
        const actor = await authenticator.authenticate(
          request.headers,
          request.id,
        );
        requireWrite(actor);
        const body = request.body as { locale: "de-CH" | "en" };
        return product.command(actor.actorId, key(request), body, () =>
          product.switchLocale(body.locale, request.id),
        ).result;
      },
    );

    routes.post(
      "/v1/dogs/:id/safety-assessments",
      {
        schema: {
          operationId: "assessDogSafety",
          tags: ["safety"],
          headers: mutationHeaders,
          params: idParams,
          body: {
            type: "object",
            additionalProperties: false,
            required: ["kind"],
            properties: {
              kind: { type: "string", enum: ["low", "pain", "child_bite"] },
            },
          },
          response: { 201: stateSchema, ...commonResponses },
        },
      },
      async (request, reply) => {
        const actor = await authenticator.authenticate(
          request.headers,
          request.id,
        );
        requireWrite(actor);
        const body = request.body as { kind: "low" | "pain" | "child_bite" };
        const command = product.command(actor.actorId, key(request), body, () =>
          product.setSafety(body.kind, request.id),
        );
        reply.header("x-idempotent-replay", String(command.replayed));
        return reply.status(201).send(command.result);
      },
    );

    const sessionBody = {
      type: "object",
      additionalProperties: false,
      required: ["success", "foodAccepted"],
      properties: {
        success: { type: "number", minimum: 0, maximum: 100 },
        foodAccepted: { type: "boolean" },
        avoidance: { type: "boolean" },
        repetitions: { type: "integer", minimum: 0, maximum: 20 },
        successes: { type: "integer", minimum: 0, maximum: 20 },
        distractionLevel: { type: "integer", minimum: 0, maximum: 5 },
        difficulty: { type: "integer", minimum: 1, maximum: 5 },
        confidence: { type: "integer", minimum: 1, maximum: 5 },
        concernNotes: { type: "string", maxLength: 1_000 },
        outcome: { type: "string", enum: ["clean", "mixed", "stopped"] },
      },
    } as const;
    routes.post(
      "/v1/sessions/:id/complete",
      {
        schema: {
          operationId: "completeSession",
          tags: ["sessions"],
          headers: mutationHeaders,
          params: idParams,
          body: sessionBody,
          response: { 200: stateSchema, ...commonResponses },
        },
      },
      async (request, reply) => {
        const actor = await authenticator.authenticate(
          request.headers,
          request.id,
        );
        requireWrite(actor);
        const body = request.body as {
          success: number;
          foodAccepted: boolean;
          avoidance?: boolean;
          repetitions?: number;
          successes?: number;
          distractionLevel?: number;
          difficulty?: number;
          confidence?: number;
          concernNotes?: string;
          outcome?: "clean" | "mixed" | "stopped";
        };
        if (options.commands !== undefined) {
          if (actor.householdId === null) {
            throw new ApiError(403, "ACCESS_DENIED", "Household access denied");
          }
          const repetitions = body.repetitions ?? 0;
          const successes =
            body.successes ?? Math.round((body.success / 100) * repetitions);
          if (successes > repetitions) {
            throw new ApiError(
              400,
              "VALIDATION_FAILED",
              "Successes cannot exceed repetitions",
            );
          }
          const account = await options.accounts?.resolveByAppUser(
            actor.actorId,
          );
          const result = await options.commands.completeSession(
            {
              actorUserId: actor.actorId,
              commandCode: "command.complete_session",
              idempotencyKey: key(request),
              requestHash: requestHash(body),
              traceId: request.id,
            },
            (request.params as { id: string }).id,
            actor.householdId,
            {
              concernNotes: body.concernNotes?.trim() || null,
              confidence: body.confidence ?? null,
              difficulty: body.difficulty ?? null,
              distractionLevel: body.distractionLevel ?? null,
              foodAccepted: body.foodAccepted,
              locale: account?.locale ?? "de-CH",
              outcome:
                body.outcome ?? (body.avoidance === true ? "stopped" : "mixed"),
              repetitions,
              successes,
            },
          );
          reply.header("x-idempotent-replay", String(result.replayed));
          return result.body;
        }
        const command = product.command(actor.actorId, key(request), body, () =>
          product.completeSession(body, request.id),
        );
        reply.header("x-idempotent-replay", String(command.replayed));
        return command.result;
      },
    );

    routes.post(
      "/v1/scheduled-sessions/:id/start",
      {
        schema: {
          operationId: "startScheduledSession",
          tags: ["sessions"],
          headers: mutationHeaders,
          params: idParams,
          body: {
            type: "object",
            additionalProperties: false,
            properties: {},
          },
          response: { 200: stateSchema, ...commonResponses },
        },
      },
      async (request, reply) => {
        const actor = await authenticator.authenticate(
          request.headers,
          request.id,
        );
        requireWrite(actor);
        if (actor.householdId === null) {
          throw new ApiError(403, "ACCESS_DENIED", "Household access denied");
        }
        if (options.commands === undefined) {
          product.assertSessionStartAllowed();
          return product.snapshot();
        }
        const body = request.body as object;
        const result = await options.commands.startSession(
          {
            actorUserId: actor.actorId,
            commandCode: "command.start_session",
            idempotencyKey: key(request),
            requestHash: requestHash(body),
            traceId: request.id,
          },
          (request.params as { id: string }).id,
          actor.householdId,
        );
        reply.header("x-idempotent-replay", String(result.replayed));
        return result.body;
      },
    );

    const simpleCommands = [
      ["/v1/households", "createHousehold"],
      ["/v1/households/:id/dogs", "createDog"],
      ["/v1/dogs/:id/anamneses", "createAnamnesis"],
      ["/v1/anamneses/:id/answers", "submitAnamnesisAnswer"],
      ["/v1/dogs/:id/goals", "createGoal"],
      ["/v1/goals/:id/generate-plan", "generatePlan"],
      ["/v1/sessions/:id/check-in", "submitCheckin"],
      ["/v1/plans/:id/evaluate-progress", "evaluatePlanProgress"],
      ["/v1/plans/:id/adjust", "adjustPlan"],
    ] as const;
    for (const [url, operationId] of simpleCommands)
      routes.post(
        url,
        {
          schema: {
            operationId,
            tags: ["commands"],
            headers: mutationHeaders,
            ...(url.includes(":id") ? { params: idParams } : {}),
            body: {
              type: "object",
              additionalProperties: false,
              properties: {
                command: { type: "string", maxLength: 120 },
                expectedVersion: { type: "integer", minimum: 1 },
              },
            },
            response: { 200: stateSchema, ...commonResponses },
          },
        },
        async (request, reply) => {
          const actor = await authenticator.authenticate(
            request.headers,
            request.id,
          );
          requireWrite(actor);
          const body = request.body as object;
          if (options.products !== undefined) {
            throw new ApiError(
              400,
              "VALIDATION_FAILED",
              "This command is not available in the current product flow",
            );
          }
          if (operationId === "generatePlan")
            product.assertPlanGenerationAllowed();
          const command = product.command(
            actor.actorId,
            key(request),
            body,
            () =>
              operationId === "adjustPlan"
                ? product.activateAdjustment(request.id)
                : product.snapshot(),
          );
          reply.header("x-idempotent-replay", String(command.replayed));
          return command.result;
        },
      );

    routes.post(
      "/v1/signed-actions",
      {
        schema: {
          operationId: "createSignedAction",
          tags: ["signed-actions"],
          headers: mutationHeaders,
          body: {
            type: "object",
            additionalProperties: false,
            required: ["purpose", "householdId", "subjectId"],
            properties: {
              purpose: { type: "string", enum: signedActionPurposes },
              householdId: { type: "string" },
              subjectId: { type: "string" },
              oneTime: { type: "boolean" },
              ttlSeconds: { type: "integer", minimum: 1, maximum: 86400 },
            },
          },
          response: {
            201: {
              type: "object",
              required: ["token", "url"],
              properties: {
                token: { type: "string" },
                url: { type: "string" },
              },
            },
            ...commonResponses,
          },
        },
      },
      async (request, reply) => {
        const actor = await authenticator.authenticate(
          request.headers,
          request.id,
        );
        requireWrite(actor);
        const body = request.body as {
          purpose: SignedActionPurpose;
          householdId: string;
          subjectId: string;
          oneTime?: boolean;
          ttlSeconds?: number;
        };
        const token = await signed.issue({
          ...body,
          actorId: actor.actorId,
          ttlSeconds: body.ttlSeconds ?? 900,
        });
        return reply
          .status(201)
          .send({ token, url: `/action/${encodeURIComponent(token)}` });
      },
    );

    routes.post(
      "/v1/signed-actions/resolve",
      {
        schema: {
          operationId: "resolveSignedAction",
          tags: ["signed-actions"],
          headers: authHeaders,
          body: {
            type: "object",
            additionalProperties: false,
            required: ["token", "purpose", "householdId", "subjectId"],
            properties: {
              token: { type: "string" },
              purpose: { type: "string", enum: signedActionPurposes },
              householdId: { type: "string" },
              subjectId: { type: "string" },
              consume: { type: "boolean" },
            },
          },
          response: {
            200: {
              type: "object",
              properties: {
                valid: { type: "boolean" },
                actionId: { type: "string" },
              },
            },
            ...commonResponses,
          },
        },
      },
      async (request) => {
        const actor = await authenticator.authenticate(
          request.headers,
          request.id,
        );
        const body = request.body as {
          token: string;
          purpose: SignedActionPurpose;
          householdId: string;
          subjectId: string;
          consume?: boolean;
        };
        if (body.purpose === "link_identity" && actor.role !== "owner")
          throw new ApiError(
            403,
            "ACCESS_DENIED",
            "Identity linking requires account authentication",
          );
        const record = await signed.verify({
          ...body,
          actorId: actor.actorId,
        });
        return { valid: true, actionId: record.id };
      },
    );
  });
  return app;
}
