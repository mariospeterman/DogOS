import { describe, expect, it } from "vitest";
import { whatsappCoachUrl } from "./whatsapp";

describe("WhatsApp coaching links", () => {
  it("prefills contextual coaching requests", () => {
    expect(whatsappCoachUrl("Explain Rex's plan")).toContain(
      "text=Explain+Rex%27s+plan",
    );
  });
});
