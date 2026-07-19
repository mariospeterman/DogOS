import { describe, expect, it } from "vitest";

import {
  dogosDataPartSchema,
  dogosUiMessageMetadataSchema,
  dogosWorkspaceSchema,
} from "./ui-message.js";

describe("DogOS UI message contracts", () => {
  it("accepts the chat-native video analysis part without fake findings", () => {
    const part = dogosDataPartSchema.parse({
      accessibilityLabel: "Video analysis queued",
      evidenceRefs: [],
      filename: "recall.mp4",
      findingsCount: 0,
      id: "video-part-1",
      schemaVersion: "1.0.0",
      state: "active",
      status: "uploaded",
      type: "data-video-analysis",
    });

    if (part.type !== "data-video-analysis") {
      throw new Error("Unexpected part type");
    }
    expect(part.status).toBe("uploaded");
    expect(part.findingsCount).toBe(0);
  });

  it("keeps workspaces constrained to the primary DogOS chat spaces", () => {
    expect(dogosWorkspaceSchema.options).toEqual([
      "setup",
      "coach",
      "plan",
      "train",
      "progress",
      "media",
      "team",
    ]);
  });

  it("accepts persisted collaboration and 360 analysis parts", () => {
    expect(
      dogosDataPartSchema.parse({
        accessibilityLabel: "360 case summary",
        agreements: ["Owner and video both show food refusal near the trigger."],
        conflicts: [
          "Owner reports cue failure; video shows handler movement before cue.",
        ],
        id: "perspective-summary-1",
        missingInformation: ["Starting distance is still unknown."],
        nextObservation: "Record the first four repetitions from the side.",
        type: "data-perspective-summary",
      }),
    ).toMatchObject({
      conflicts: expect.arrayContaining([
        expect.stringMatching(/handler movement/),
      ]),
      type: "data-perspective-summary",
    });

    expect(
      dogosDataPartSchema.parse({
        accessibilityLabel: "Trainer handoff preview",
        excludedCount: 4,
        includedCount: 8,
        mediaIncluded: true,
        id: "handoff-preview-1",
        targetProfessionalType: "trainer",
        type: "data-handoff-preview",
      }),
    ).toMatchObject({
      mediaIncluded: true,
      targetProfessionalType: "trainer",
      type: "data-handoff-preview",
    });
  });

  it("records safe metadata defaults for persisted UI messages", () => {
    expect(
      dogosUiMessageMetadataSchema.parse({
        createdAt: "2026-07-18T12:00:00.000Z",
      }),
    ).toMatchObject({
      artifactRefs: [],
      generationStatus: "completed",
      secondaryTags: [],
      workspace: "coach",
    });
  });
});
