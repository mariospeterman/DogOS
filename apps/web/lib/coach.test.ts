import { describe, expect, it } from "vitest";
import { coachHref } from "./coach.js";

describe("coachHref", () => {
  it("creates an internal bounded contextual link", () => {
    const href = coachHref(`Explain the plan. ${"x".repeat(600)}`);
    const url = new URL(href, "https://dogos.test");
    expect(url.pathname).toBe("/app/coach");
    expect(url.searchParams.get("prompt")).toHaveLength(500);
    expect(href).not.toContain("http");
  });
});
