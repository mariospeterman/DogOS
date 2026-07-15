import { describe, expect, it } from "vitest";

import { protocolVersionSchema } from "@dogos/contracts";

import { developmentProtocols } from "./development-protocols.js";

describe("development protocol fixtures", () => {
  it("contains the six approved development goal families", () => {
    expect(developmentProtocols.map((protocol) => protocol.goalFamily)).toEqual(
      [
        "goal.marker_timing",
        "goal.sit",
        "goal.down",
        "goal.loose_leash_walking",
        "goal.calm_engagement",
        "goal.recall",
      ],
    );
  });

  it.each(developmentProtocols)(
    "$protocolCode is valid and never claims approval",
    (protocol) => {
      expect(protocolVersionSchema.parse(protocol)).toEqual(protocol);
      expect(protocol.developmentOnly).toBe(true);
      expect(protocol.approval.status).toBe("unapproved");
      expect(protocol.sourcePlaceholders).not.toHaveLength(0);
    },
  );
});
