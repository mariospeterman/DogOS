import { decodeJwt } from "jose";
import { describe, expect, it } from "vitest";

import { SignedActionService } from "./signed-actions.js";

const secret = "development-test-secret-at-least-32-characters";
const base = {
  purpose: "open_session" as const,
  householdId: "household-a",
  subjectId: "session-a",
  actorId: "owner-a",
  ttlSeconds: 60,
  now: 1_000,
};

describe("signed actions", () => {
  it("keeps bindings out of browser-visible claims", async () => {
    const service = new SignedActionService({ key1: secret }, "key1");
    const token = await service.issue(base);

    expect(decodeJwt(token)).toMatchObject({ iat: 1_000, exp: 1_060 });
    expect(JSON.stringify(decodeJwt(token))).not.toContain("household-a");
    expect(JSON.stringify(decodeJwt(token))).not.toContain("session-a");
  });

  it.each([
    ["purpose", { purpose: "open_plan" as const }],
    ["household", { householdId: "household-b" }],
    ["subject", { subjectId: "session-b" }],
    ["actor", { actorId: "owner-b" }],
  ])("rejects a wrong %s binding", async (_name, override) => {
    const service = new SignedActionService({ key1: secret }, "key1");
    const token = await service.issue(base);

    await expect(
      service.verify({ ...base, ...override, token }),
    ).rejects.toMatchObject({ code: "SIGNED_ACTION_INVALID" });
  });

  it("rejects tampering and malformed tokens", async () => {
    const service = new SignedActionService({ key1: secret }, "key1");
    const token = await service.issue(base);

    await expect(
      service.verify({ ...base, token: `${token.slice(0, -1)}x` }),
    ).rejects.toMatchObject({ code: "SIGNED_ACTION_INVALID" });
    await expect(
      service.verify({ ...base, token: "not-a-token" }),
    ).rejects.toMatchObject({ code: "SIGNED_ACTION_INVALID" });
  });

  it("rejects expiry, replay, and revocation", async () => {
    const service = new SignedActionService({ key1: secret }, "key1");
    const expired = await service.issue({ ...base, ttlSeconds: 1 });
    await expect(
      service.verify({ ...base, token: expired, now: 1_001 }),
    ).rejects.toMatchObject({ code: "SIGNED_ACTION_EXPIRED" });

    const once = await service.issue({ ...base, oneTime: true });
    await service.verify({ ...base, token: once, consume: true });
    await expect(
      service.verify({ ...base, token: once, consume: true }),
    ).rejects.toMatchObject({ code: "SIGNED_ACTION_REPLAYED" });

    const revoked = await service.issue(base);
    service.revoke(revoked);
    await expect(
      service.verify({ ...base, token: revoked }),
    ).rejects.toMatchObject({ code: "SIGNED_ACTION_INVALID" });
    expect(service.audit().map(({ event }) => event)).toContain("revoked");
  });

  it("retains old verification keys after rotation", async () => {
    const service = new SignedActionService({ key1: secret }, "key1");
    const oldToken = await service.issue(base);
    service.rotate("key2", "second-development-secret-at-least-32-characters");
    const newToken = await service.issue(base);

    await expect(
      service.verify({ ...base, token: oldToken }),
    ).resolves.toBeTruthy();
    await expect(
      service.verify({ ...base, token: newToken }),
    ).resolves.toBeTruthy();
  });
});
