export interface AudioAsset {
  contentType: string;
  objectKey: string;
}

export interface TimestampedTranscript {
  language: "de-CH" | "en" | "unknown";
  segments: Array<{
    endMs: number;
    speaker: "handler" | "unknown";
    startMs: number;
    text: string;
  }>;
}

export interface AsrProvider {
  transcribe(input: AudioAsset): Promise<TimestampedTranscript>;
}
