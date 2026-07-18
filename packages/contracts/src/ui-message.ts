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
  kind: z.enum(["protocol", "research", "memory", "session", "video"]),
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
    summary: z.string().min(1).max(1200),
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
