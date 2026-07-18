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
    ]);
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
