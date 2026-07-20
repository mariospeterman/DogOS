export interface ModerationRequest {
  content: string;
  locale: "de-CH" | "en";
  traceId: string;
}

export interface ModerationResult {
  categories: string[];
  disposition: "allow" | "block" | "manual_review";
}

export interface ModerationProvider {
  moderate(input: ModerationRequest): Promise<ModerationResult>;
}
