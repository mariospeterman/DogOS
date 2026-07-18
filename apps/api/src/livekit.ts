import { SignJWT } from "jose";

export interface LiveKitConfig {
  apiKey: string;
  apiSecret: string;
  url: string;
}

export function loadLiveKitConfig(
  environment: NodeJS.ProcessEnv,
): LiveKitConfig | null {
  const url = environment.LIVEKIT_URL;
  const apiKey = environment.LIVEKIT_API_KEY;
  const apiSecret = environment.LIVEKIT_API_SECRET;
  if (url === undefined && apiKey === undefined && apiSecret === undefined) {
    return null;
  }
  if (url === undefined || apiKey === undefined || apiSecret === undefined) {
    throw new Error("LIVEKIT_CONFIGURATION_INCOMPLETE");
  }
  if (!url.startsWith("wss://") && !url.startsWith("ws://")) {
    throw new Error("LIVEKIT_URL_INVALID");
  }
  if (apiKey.length < 6 || apiSecret.length < 16) {
    throw new Error("LIVEKIT_CREDENTIALS_INVALID");
  }
  return { apiKey, apiSecret, url };
}

export async function createLiveKitJoinToken(input: {
  config: LiveKitConfig;
  identity: string;
  metadata: Record<string, string>;
  roomName: string;
  ttlSeconds?: number;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    metadata: JSON.stringify(input.metadata),
    video: {
      canPublish: true,
      canPublishData: true,
      canSubscribe: true,
      room: input.roomName,
      roomJoin: true,
    },
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(input.config.apiKey)
    .setSubject(input.identity)
    .setNotBefore(now)
    .setExpirationTime(now + (input.ttlSeconds ?? 900))
    .sign(new TextEncoder().encode(input.config.apiSecret));
}
