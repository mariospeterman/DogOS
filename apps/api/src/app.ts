import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from "fastify";
import rawBody from "fastify-raw-body";
import type { WhatsAppWebhookService } from "@dogos/whatsapp";
import {
  ProductService,
  localIdentities,
  type LocalIdentity,
} from "./product-service.js";
import {
  SignedActionError,
  SignedActionService,
  signedActionPurposes,
  type SignedActionPurpose,
} from "./signed-actions.js";

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
};
const mutationHeaders = {
  type: "object",
  required: ["x-dogos-user", "idempotency-key"],
  properties: {
    "x-dogos-user": { type: "string", enum: Object.keys(localIdentities) },
    "idempotency-key": { type: "string", minLength: 4, maxLength: 120 },
    "x-request-id": { type: "string" },
  },
} as const;
const authHeaders = {
  type: "object",
  required: ["x-dogos-user"],
  properties: {
    "x-dogos-user": { type: "string", enum: Object.keys(localIdentities) },
  },
} as const;
const idParams = {
  type: "object",
  additionalProperties: false,
  required: ["id"],
  properties: { id: { type: "string", minLength: 1 } },
} as const;

function identity(request: FastifyRequest): LocalIdentity {
  const value = request.headers["x-dogos-user"];
  if (typeof value !== "string" || !(value in localIdentities))
    throw new ApiError(401, "AUTH_REQUIRED", "Authentication is required");
  return value as LocalIdentity;
}
function requireWrite(user: LocalIdentity): void {
  if (!["owner", "caregiver"].includes(user))
    throw new ApiError(
      403,
      "ACCESS_DENIED",
      "This role cannot change the household",
    );
}
function key(request: FastifyRequest): string {
  const value = request.headers["idempotency-key"];
  if (typeof value !== "string")
    throw new ApiError(400, "VALIDATION_FAILED", "Idempotency-Key is required");
  return value;
}

export interface BuildAppOptions {
  product?: ProductService;
  signedActions?: SignedActionService;
  twilio?: {
    inboundWebhookUrl: string;
    service: WhatsAppWebhookService;
    statusCallbackUrl: string;
  };
  webOrigin?: string;
  whatsapp?: WhatsAppWebhookService;
}

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const app = Fastify({
    logger: process.env.NODE_ENV !== "test",
    requestIdHeader: "x-request-id",
  });
  const product = options.product ?? new ProductService();
  const signed =
    options.signedActions ??
    new SignedActionService(
      { local1: "local-only-change-before-production-32-chars" },
      "local1",
    );
  app.register(swagger, {
    openapi: {
      openapi: "3.1.0",
      info: { title: "DogOS API", version: "0.2.5" },
      components: {
        securitySchemes: {
          localIdentity: { type: "apiKey", in: "header", name: "x-dogos-user" },
        },
      },
    },
  });
  app.register(cors, {
    allowedHeaders: [
      "content-type",
      "idempotency-key",
      "x-dogos-user",
      "x-request-id",
    ],
    maxAge: 600,
    methods: ["GET", "POST", "OPTIONS"],
    origin:
      options.webOrigin ?? process.env.WEB_ORIGIN ?? "http://localhost:3000",
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
    const authHeaderMissing = hasValidation && message.includes("x-dogos-user");
    const apiError =
      error instanceof ApiError
        ? error
        : error instanceof SignedActionError
          ? new ApiError(
              error.code === "SIGNED_ACTION_REPLAYED" ? 409 : 400,
              error.code,
              "The signed action is not valid",
            )
          : authHeaderMissing
            ? new ApiError(401, "AUTH_REQUIRED", "Authentication is required")
            : message === "IDEMPOTENCY_CONFLICT"
              ? new ApiError(
                  409,
                  "IDEMPOTENCY_CONFLICT",
                  "The key was already used for another command",
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
      checks: { api: "ready" as const },
      status: "ready" as const,
    }));
    routes.get("/openapi.json", { schema: { hide: true } }, async () =>
      routes.swagger(),
    );

    if (options.whatsapp !== undefined && options.twilio === undefined) {
      routes.get(
        "/webhooks/whatsapp",
        { schema: { hide: true } },
        async (request, reply) => {
          const query = request.query as Record<string, unknown>;
          const challenge = await options.whatsapp!.verifySubscription({
            challenge: String(query["hub.challenge"] ?? ""),
            mode: String(query["hub.mode"] ?? ""),
            verifyToken: String(query["hub.verify_token"] ?? ""),
          });
          if (challenge === null) return reply.status(403).send();
          return reply.type("text/plain").send(challenge);
        },
      );
      routes.post(
        "/webhooks/whatsapp",
        {
          config: { rawBody: true },
          schema: {
            hide: true,
            headers: {
              type: "object",
              required: ["x-hub-signature-256"],
              properties: { "x-hub-signature-256": { type: "string" } },
            },
          },
        },
        async (request, reply) => {
          const raw = (request as FastifyRequest & { rawBody?: string })
            .rawBody;
          if (raw === undefined)
            throw new ApiError(400, "VALIDATION_FAILED", "Raw body required");
          const signature = request.headers["x-hub-signature-256"];
          if (typeof signature !== "string")
            throw new ApiError(400, "VALIDATION_FAILED", "Signature required");
          try {
            await options.whatsapp!.process(raw, signature);
          } catch (error) {
            if (
              error instanceof Error &&
              error.message === "WHATSAPP_SIGNATURE_INVALID"
            ) {
              return reply.status(401).send();
            }
            throw error;
          }
          return reply.status(200).send({ received: true });
        },
      );
    }

    if (options.twilio !== undefined) {
      const twilioHeaders = {
        type: "object",
        required: ["x-twilio-signature"],
        properties: { "x-twilio-signature": { type: "string" } },
      } as const;
      const processTwilioWebhook = async (
        request: FastifyRequest,
        reply: FastifyReply,
        kind: "inbound" | "status",
      ) => {
        const raw = (request as FastifyRequest & { rawBody?: string }).rawBody;
        const signature = request.headers["x-twilio-signature"];
        if (raw === undefined || typeof signature !== "string") {
          return reply.status(400).send();
        }
        try {
          if (kind === "inbound") {
            await options.twilio!.service.process(raw, signature, {
              url: options.twilio!.inboundWebhookUrl,
            });
          } else {
            await options.twilio!.service.processDeliveryStatuses(
              raw,
              signature,
              { url: options.twilio!.statusCallbackUrl },
            );
          }
        } catch (error) {
          if (
            error instanceof Error &&
            error.message === "WHATSAPP_SIGNATURE_INVALID"
          ) {
            return reply.status(403).send();
          }
          throw error;
        }
        return kind === "inbound"
          ? reply.type("text/xml").send("<Response></Response>")
          : reply.status(204).send();
      };
      routes.post(
        "/webhooks/whatsapp/twilio",
        {
          config: { rawBody: true },
          schema: { hide: true, headers: twilioHeaders },
        },
        async (request, reply) =>
          processTwilioWebhook(request, reply, "inbound"),
      );
      routes.post(
        "/webhooks/whatsapp/twilio/status",
        {
          config: { rawBody: true },
          schema: { hide: true, headers: twilioHeaders },
        },
        async (request, reply) =>
          processTwilioWebhook(request, reply, "status"),
      );
    }

    if (options.whatsapp !== undefined) {
      routes.post(
        "/v1/whatsapp/link/confirm",
        {
          schema: {
            operationId: "confirmWhatsAppIdentity",
            tags: ["account"],
            headers: authHeaders,
            body: {
              type: "object",
              additionalProperties: false,
              required: ["token"],
              properties: {
                token: { type: "string", minLength: 20, maxLength: 200 },
              },
            },
            response: { 200: stateSchema, ...commonResponses },
          },
        },
        async (request) => {
          const user = identity(request);
          if (user !== "owner")
            throw new ApiError(
              403,
              "ACCESS_DENIED",
              "Owner authentication required",
            );
          const actor = localIdentities[user];
          return options.whatsapp!.confirmIdentity(
            (request.body as { token: string }).token,
            actor.id,
            actor.householdId!,
          );
        },
      );
      routes.post(
        "/v1/whatsapp/unlink",
        {
          schema: {
            operationId: "unlinkWhatsAppIdentity",
            tags: ["account"],
            headers: mutationHeaders,
            body: {
              type: "object",
              additionalProperties: false,
              required: ["contactId"],
              properties: {
                contactId: { type: "string", minLength: 1, maxLength: 120 },
              },
            },
            response: { 200: stateSchema, ...commonResponses },
          },
        },
        async (request) => {
          const user = identity(request);
          if (user !== "owner")
            throw new ApiError(
              403,
              "ACCESS_DENIED",
              "Owner authentication required",
            );
          await options.whatsapp!.unlink(
            (request.body as { contactId: string }).contactId,
          );
          return { unlinked: true, traceId: request.id };
        },
      );
      routes.post(
        "/v1/whatsapp/delete-data",
        {
          schema: {
            operationId: "deleteWhatsAppData",
            tags: ["account"],
            headers: mutationHeaders,
            body: {
              type: "object",
              additionalProperties: false,
              required: ["contactId"],
              properties: {
                contactId: { type: "string", minLength: 1, maxLength: 120 },
              },
            },
            response: { 200: stateSchema, ...commonResponses },
          },
        },
        async (request) => {
          const user = identity(request);
          if (user !== "owner")
            throw new ApiError(
              403,
              "ACCESS_DENIED",
              "Owner authentication required",
            );
          await options.whatsapp!.deleteContact(
            (request.body as { contactId: string }).contactId,
          );
          return { deleted: true, traceId: request.id };
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
        const user = identity(request);
        return {
          identity: user,
          ...localIdentities[user],
          locale: product.snapshot().locale,
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
          const user = identity(request);
          if (user === "unrelated")
            throw new ApiError(403, "ACCESS_DENIED", "Household access denied");
          return product.snapshot();
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
        const user = identity(request);
        requireWrite(user);
        const body = request.body as { locale?: "de-CH" | "en" };
        return product.command(user, key(request), body, () =>
          product.reset(body.locale),
        ).result;
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
        const user = identity(request);
        requireWrite(user);
        const body = request.body as { locale: "de-CH" | "en" };
        return product.command(user, key(request), body, () =>
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
        const user = identity(request);
        requireWrite(user);
        const body = request.body as { kind: "low" | "pain" | "child_bite" };
        const command = product.command(user, key(request), body, () =>
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
        distractionLevel: { type: "integer", minimum: 0, maximum: 5 },
        difficulty: { type: "integer", minimum: 1, maximum: 5 },
        confidence: { type: "integer", minimum: 1, maximum: 5 },
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
        const user = identity(request);
        requireWrite(user);
        const body = request.body as {
          success: number;
          foodAccepted: boolean;
          avoidance?: boolean;
        };
        const command = product.command(user, key(request), body, () =>
          product.completeSession(body, request.id),
        );
        reply.header("x-idempotent-replay", String(command.replayed));
        return command.result;
      },
    );

    const simpleCommands = [
      ["/v1/households", "createHousehold"],
      ["/v1/households/:id/dogs", "createDog"],
      ["/v1/dogs/:id/anamneses", "createAnamnesis"],
      ["/v1/anamneses/:id/answers", "submitAnamnesisAnswer"],
      ["/v1/dogs/:id/goals", "createGoal"],
      ["/v1/goals/:id/generate-plan", "generatePlan"],
      ["/v1/sessions/:id/start", "startSession"],
      ["/v1/sessions/:id/check-in", "submitCheckin"],
      ["/v1/plans/:id/evaluate-progress", "evaluatePlanProgress"],
      ["/v1/plans/:id/adjust", "adjustPlan"],
      ["/v1/dogs/:id/referrals", "createReferral"],
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
          const user = identity(request);
          requireWrite(user);
          const body = request.body as object;
          if (operationId === "startSession")
            product.assertSessionStartAllowed();
          if (operationId === "generatePlan")
            product.assertPlanGenerationAllowed();
          const command = product.command(user, key(request), body, () =>
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
        const user = identity(request);
        requireWrite(user);
        const body = request.body as {
          purpose: SignedActionPurpose;
          householdId: string;
          subjectId: string;
          oneTime?: boolean;
          ttlSeconds?: number;
        };
        const token = await signed.issue({
          ...body,
          actorId: localIdentities[user].id,
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
        const user = identity(request);
        const body = request.body as {
          token: string;
          purpose: SignedActionPurpose;
          householdId: string;
          subjectId: string;
          consume?: boolean;
        };
        if (body.purpose === "link_identity" && user !== "owner")
          throw new ApiError(
            403,
            "ACCESS_DENIED",
            "Identity linking requires account authentication",
          );
        const record = await signed.verify({
          ...body,
          actorId: localIdentities[user].id,
        });
        return { valid: true, actionId: record.id };
      },
    );
  });
  return app;
}
