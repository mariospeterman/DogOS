import { describe, expect, it } from "vitest";

import { DeterministicConversationLanguageResolver } from "./language.js";

const resolver = new DeterministicConversationLanguageResolver();

describe("conversation language resolution", () => {
  it("detects supported language from normal conversation", async () => {
    await expect(
      resolver.resolve({
        currentLocale: "de-CH",
        text: "Hello, my dog has pain",
      }),
    ).resolves.toMatchObject({ locale: "en", source: "message_text" });
    await expect(
      resolver.resolve({
        currentLocale: "en",
        text: "Hoi, mein Hund lahmt heute",
      }),
    ).resolves.toMatchObject({ locale: "de-CH", source: "message_text" });
  });

  it("supports a natural language request without a selector", async () => {
    await expect(
      resolver.resolve({
        currentLocale: "de-CH",
        text: "Please reply in English",
      }),
    ).resolves.toEqual({
      confidence: 1,
      locale: "en",
      source: "explicit_request",
    });
    await expect(
      resolver.resolve({
        currentLocale: "en",
        text: "Bitte antworte auf Deutsch",
      }),
    ).resolves.toMatchObject({
      locale: "de-CH",
      source: "explicit_request",
    });
  });

  it("preserves the active language for choices, names, and mixed text", async () => {
    for (const text of ["choice.1", "Milo", "Deutsch or English"]) {
      await expect(
        resolver.resolve({ currentLocale: "en", text }),
      ).resolves.toEqual({
        confidence: 0,
        locale: "en",
        source: "preserved",
      });
    }
  });

  it("does not confuse a breed name with a language request", async () => {
    await expect(
      resolver.resolve({
        currentLocale: "de-CH",
        text: "My dog is a German Shepherd",
      }),
    ).resolves.toMatchObject({
      locale: "en",
      source: "message_text",
    });
  });
});
