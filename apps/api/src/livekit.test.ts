import { decodeJwt } from "jose";
import { describe, expect, it } from "vitest";
import { createLiveKitJoinToken, loadLiveKitConfig } from "./livekit.js";

describe("LiveKit configuration", () => {
  it("loads only complete websocket configuration", () => {
    expect(loadLiveKitConfig({})).toBeNull();
    expect(() =>
      loadLiveKitConfig({
        LIVEKIT_API_KEY: "devkey",
        LIVEKIT_API_SECRET: "a-livekit-secret-for-tests",
      }),
    ).toThrow("LIVEKIT_CONFIGURATION_INCOMPLETE");
    expect(() =>
      loadLiveKitConfig({
        LIVEKIT_API_KEY: "devkey",
        LIVEKIT_API_SECRET: "a-livekit-secret-for-tests",
        LIVEKIT_URL: "https://livekit.test",
      }),
    ).toThrow("LIVEKIT_URL_INVALID");
  });

  it("creates a room-scoped participant token", async () => {
    const token = await createLiveKitJoinToken({
      config: {
        apiKey: "devkey",
        apiSecret: "a-livekit-secret-for-tests",
        url: "wss://livekit.test",
      },
      identity: "owner-1",
      metadata: { dogId: "dog-1", liveSessionId: "session-1" },
      roomName: "dogos-room-1",
      ttlSeconds: 60,
    });
    const claims = decodeJwt(token) as {
      iss?: string;
      sub?: string;
      video?: { room?: string; roomJoin?: boolean };
    };
    expect(claims).toMatchObject({
      iss: "devkey",
      sub: "owner-1",
      video: { room: "dogos-room-1", roomJoin: true },
    });
  });
});
