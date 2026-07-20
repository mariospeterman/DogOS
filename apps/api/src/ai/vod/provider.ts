import type { VideoFinding } from "@dogos/database";

export interface VodFrameReference {
  contentType: "image/jpeg" | "image/png" | "image/webp";
  data: string;
  timestampMs: number;
}

export interface VodAnalysisRequest {
  activeGoal?: string;
  activeStep?: string | null;
  dogId: string;
  frames: VodFrameReference[];
  householdId: string;
  locale: "de-CH" | "en";
  ownerCaption?: string;
  previousFindings: VideoFinding[];
  traceId: string;
}

export interface ValidatedVodResult {
  findings: VideoFinding[];
  model: string;
  provider: string;
}

export interface VodModelProvider {
  analyze(input: VodAnalysisRequest): Promise<ValidatedVodResult>;
}
