export interface CvVodRequest {
  assetId: string;
  dogId: string;
  fps: number;
  householdId: string;
}

export interface CvEvidenceBundle {
  confidence: number;
  events: Array<{
    confidence: number;
    endMs: number;
    label: string;
    startMs: number;
  }>;
  runtime: string;
}

export interface LiveCvConfiguration {
  dogId: string;
  householdId: string;
  serverFps: number;
  sessionId: string;
}

export interface LiveCvSession {
  sessionId: string;
  status: "open";
}

export interface CvPipeline {
  analyzeVod(input: CvVodRequest): Promise<CvEvidenceBundle>;
  openLiveSession(input: LiveCvConfiguration): Promise<LiveCvSession>;
}
