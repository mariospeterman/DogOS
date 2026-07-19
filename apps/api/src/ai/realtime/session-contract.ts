export interface RealtimeSessionConfiguration {
  dogId: string;
  householdId: string;
  locale: "de-CH" | "en";
  maxCuesPerMinute: number;
  mode: "silent_measurement" | "conservative_cues";
  ringBufferSeconds: number;
  sessionId: string;
}

export interface RealtimeSessionDescriptor {
  expiresAt: string;
  provider: "google_vertex" | "openai";
  providerSessionId: string;
  region: "eu" | "global";
}

export interface RealtimeDialogueProvider {
  createSession(
    input: RealtimeSessionConfiguration,
  ): Promise<RealtimeSessionDescriptor>;
}
