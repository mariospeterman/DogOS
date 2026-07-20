import { z } from "zod";

import {
  canonicalCodeSchema,
  confidenceSchema,
  entityIdSchema,
  isoTimestampSchema,
  semanticVersionSchema,
} from "./common.js";

const artifactRefSchema = z.strictObject({
  id: entityIdSchema,
  kind: z.string().min(1).max(80),
  version: z.number().int().positive().nullable(),
});

const sourceRefSchema = z.strictObject({
  id: z.string().min(1).max(120),
  label: z.string().min(1).max(160),
  href: z.url().nullable(),
  kind: z.enum([
    "protocol",
    "research",
    "memory",
    "session",
    "video",
    "handoff",
  ]),
});

const dogosActionSchema = z.strictObject({
  confirmationRequired: z.boolean().default(false),
  href: z.string().min(1).max(500).nullable(),
  id: z.string().min(1).max(120),
  label: z.string().min(1).max(80),
  method: z.enum(["GET", "POST"]).default("GET"),
});

const basePartSchema = z.strictObject({
  accessibilityLabel: z.string().min(1).max(240),
  actions: z.array(dogosActionSchema).max(6).default([]),
  artifact: artifactRefSchema.nullable().default(null),
  canonicalCode: canonicalCodeSchema.nullable().default(null),
  evidenceRefs: z.array(sourceRefSchema).max(12).default([]),
  id: z.string().min(1).max(120),
  schemaVersion: semanticVersionSchema.default("1.0.0"),
  state: z
    .enum(["proposed", "confirmed", "active", "completed", "failed"])
    .default("active"),
});

export const dogosWorkspaceSchema = z.enum([
  "setup",
  "coach",
  "plan",
  "train",
  "progress",
  "media",
  "team",
]);

export type DogOSWorkspace = z.infer<typeof dogosWorkspaceSchema>;

export const dogosDataPartSchema = z.discriminatedUnion("type", [
  basePartSchema.extend({
    type: z.literal("data-memory-confirmation"),
    value: z.string().min(1).max(1000),
  }),
  basePartSchema.extend({
    type: z.literal("data-goal"),
    goalText: z.string().min(1).max(240),
  }),
  basePartSchema.extend({
    type: z.literal("data-plan"),
    durationMinutes: z.number().int().positive(),
    summary: z.string().min(1).max(1000),
  }),
  basePartSchema.extend({
    type: z.literal("data-calendar"),
    entries: z
      .array(
        z.strictObject({
          durationSeconds: z.number().int().positive(),
          plannedStart: isoTimestampSchema,
          status: z.string().min(1).max(80),
        }),
      )
      .max(31),
  }),
  basePartSchema.extend({
    type: z.literal("data-session"),
    durationSeconds: z.number().int().positive(),
    repetitions: z.number().int().nonnegative(),
    stepCode: z.string().min(1).max(120),
  }),
  basePartSchema.extend({
    type: z.literal("data-progress"),
    baselineSuccessRate: z.number().min(0).max(100),
    targetSuccessRate: z.number().min(0).max(100).nullable(),
  }),
  basePartSchema.extend({
    type: z.literal("data-correlation"),
    confidence: confidenceSchema,
    summary: z.string().min(1).max(1000),
  }),
  basePartSchema.extend({
    type: z.literal("data-video-upload"),
    filename: z.string().min(1).max(180),
    status: z.enum([
      "upload_requested",
      "uploaded",
      "processing",
      "completed",
      "failed",
    ]),
  }),
  basePartSchema.extend({
    type: z.literal("data-video-analysis"),
    filename: z.string().min(1).max(180),
    findingsCount: z.number().int().nonnegative(),
    status: z.enum([
      "upload_requested",
      "uploaded",
      "processing",
      "completed",
      "failed",
    ]),
  }),
  basePartSchema.extend({
    type: z.literal("data-live-session"),
    plannedMinutes: z.number().int().positive().max(60),
    status: z.enum(["created", "active", "completed", "failed"]),
  }),
  basePartSchema.extend({
    type: z.literal("data-professional-handoff"),
    disagreementCount: z.number().int().nonnegative().default(0),
    evidenceCount: z.number().int().nonnegative().default(0),
    handoffId: z.string().min(1).max(120).nullable().default(null),
    summary: z.string().min(1).max(1200),
    targetProfessionalType: z
      .enum(["trainer", "veterinary"])
      .default("trainer"),
  }),
  basePartSchema.extend({
    type: z.literal("data-feedback-request"),
    dueAt: isoTimestampSchema.nullable().default(null),
    prompt: z.string().min(1).max(600),
    recipientRole: z.enum([
      "caregiver",
      "observer_guest",
      "trainer",
      "veterinarian",
    ]),
    scopeCount: z.number().int().nonnegative().default(0),
  }),
  basePartSchema.extend({
    type: z.literal("data-feedback-response"),
    certainty: confidenceSchema,
    observationSummary: z.string().min(1).max(800),
    responderRole: z.enum([
      "owner",
      "caregiver",
      "observer_guest",
      "trainer",
      "veterinarian",
    ]),
    subjectiveInterpretation: z.string().max(800).nullable().default(null),
  }),
  basePartSchema.extend({
    type: z.literal("data-perspective-summary"),
    agreements: z.array(z.string().min(1).max(240)).max(8).default([]),
    conflicts: z.array(z.string().min(1).max(300)).max(8).default([]),
    missingInformation: z.array(z.string().min(1).max(240)).max(8).default([]),
    nextObservation: z.string().min(1).max(300).nullable().default(null),
  }),
  basePartSchema.extend({
    type: z.literal("data-perspective-conflict"),
    conflict: z.string().min(1).max(600),
    sourceLabels: z.array(z.string().min(1).max(80)).min(2).max(8),
  }),
  basePartSchema.extend({
    type: z.literal("data-professional-review"),
    outcome: z
      .enum([
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
      ])
      .nullable(),
    professionalRole: z.enum(["trainer", "veterinarian"]),
    summary: z.string().min(1).max(1000),
  }),
  basePartSchema.extend({
    type: z.literal("data-plan-proposal"),
    proposedBy: z.enum(["trainer", "veterinarian", "dogos"]),
    requiresOwnerApproval: z.boolean().default(true),
    status: z.enum(["draft", "reviewed", "accepted", "rejected"]),
    summary: z.string().min(1).max(1000),
  }),
  basePartSchema.extend({
    type: z.literal("data-handoff-preview"),
    excludedCount: z.number().int().nonnegative().default(0),
    includedCount: z.number().int().nonnegative(),
    mediaIncluded: z.boolean().default(false),
    targetProfessionalType: z.enum(["trainer", "veterinary"]),
  }),
  basePartSchema.extend({
    type: z.literal("data-handoff-delivery"),
    deliveryMethod: z.enum(["secure_link", "pdf_download", "secure_email"]),
    expiresAt: isoTimestampSchema,
    status: z.enum(["created", "claimed", "revoked", "expired"]),
  }),
  basePartSchema.extend({
    type: z.literal("data-collaborator"),
    accessExpiresAt: isoTimestampSchema.nullable().default(null),
    displayName: z.string().min(1).max(160),
    role: z.enum([
      "owner",
      "caregiver",
      "viewer",
      "observer_guest",
      "trainer",
      "veterinarian",
      "professional_assistant",
    ]),
    status: z.enum(["invited", "active", "revoked", "expired"]),
  }),
  basePartSchema.extend({
    type: z.literal("data-sources"),
    sources: z.array(sourceRefSchema).min(1).max(12),
  }),
  basePartSchema.extend({
    type: z.literal("data-pdf-export"),
    status: z.enum(["requested", "ready", "failed"]),
  }),
  basePartSchema.extend({
    type: z.literal("data-upgrade"),
    tier: z.enum(["plus", "pro", "ultra"]),
  }),
  basePartSchema.extend({
    type: z.literal("data-notification"),
    message: z.string().min(1).max(300),
  }),
  basePartSchema.extend({
    type: z.literal("data-error"),
    code: z.string().min(1).max(120),
    message: z.string().min(1).max(500),
  }),
]);

export type DogOSDataPart = z.infer<typeof dogosDataPartSchema>;

export type DogOSMessageMetadata = z.infer<typeof dogosUiMessageMetadataSchema>;

export type DogOSTools = Record<string, unknown>;

export type DogOSUIMessage = {
  id: string;
  metadata: DogOSMessageMetadata;
  parts: DogOSDataPart[];
  role: "assistant" | "system" | "user";
};

export const dogosUiMessageMetadataSchema = z.strictObject({
  artifactRefs: z.array(artifactRefSchema).max(12).default([]),
  createdAt: isoTimestampSchema,
  generationStatus: z
    .enum(["pending", "streaming", "completed", "failed", "superseded"])
    .default("completed"),
  secondaryTags: z.array(z.string().min(1).max(80)).max(12).default([]),
  workspace: dogosWorkspaceSchema.default("coach"),
});

export type DogOSUIMessageMetadata = z.infer<
  typeof dogosUiMessageMetadataSchema
>;
