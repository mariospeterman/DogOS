import { describe, expect, it } from "vitest";
import { presentGoal, presentStage } from "./training-presentation.js";

describe("training presentation", () => {
  it("presents canonical codes without exposing them", () => {
    expect(presentGoal("goal.loose_leash_walking", "de-CH")).toBe(
      "lockerer Leine auf Alltagswegen",
    );
    expect(presentStage("step.low_distraction_baseline", "en")).toBe(
      "orientation under low distraction",
    );
    expect(presentStage("step.recall_short_distance", "de-CH")).toBe(
      "Rückruf auf kurzer Distanz bei niedriger Ablenkung",
    );
  });

  it("uses safe owner-facing fallbacks for unknown codes", () => {
    expect(presentGoal("goal.future", "en")).toBe("the current training goal");
    expect(presentStage("step.future", "de-CH")).toBe(
      "dem aktuellen Trainingsblock",
    );
  });
});
