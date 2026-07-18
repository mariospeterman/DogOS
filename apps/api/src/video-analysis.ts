import OpenAI from "openai";

import type { VideoFinding } from "@dogos/database";

export type VideoAnalysisProviderMode = "deterministic" | "openai";

export interface VideoAnalysisConfig {
  maxFrames: number;
  mode: VideoAnalysisProviderMode;
  model: string;
  timeoutMs: number;
}

export interface VideoFrameEvidence {
  contentType: "image/jpeg" | "image/png" | "image/webp";
  data: string;
  timestampMs: number;
}

export interface VideoAnalysisProvider {
  analyze(input: {
    dogId: string;
    frames: VideoFrameEvidence[];
    householdId: string;
    locale: "de-CH" | "en";
  }): Promise<VideoFinding[]>;
}

function integerSetting(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
  errorCode: string,
): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(errorCode);
  }
  return parsed;
}

export function loadVideoAnalysisConfig(
  environment: NodeJS.ProcessEnv,
): VideoAnalysisConfig | null {
  const mode = environment.DOGOS_VIDEO_ANALYSIS_PROVIDER ?? "disabled";
  if (mode === "disabled") return null;
  if (mode !== "deterministic" && mode !== "openai") {
    throw new Error("DOGOS_VIDEO_ANALYSIS_PROVIDER_UNSUPPORTED");
  }
  if (mode === "openai" && !environment.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY_REQUIRED");
  }
  return {
    maxFrames: integerSetting(
      environment.DOGOS_VIDEO_ANALYSIS_MAX_FRAMES,
      6,
      1,
      24,
      "DOGOS_VIDEO_ANALYSIS_MAX_FRAMES_INVALID",
    ),
    mode,
    model: environment.DOGOS_VIDEO_ANALYSIS_MODEL ?? "gpt-5.6-terra",
    timeoutMs: integerSetting(
      environment.DOGOS_VIDEO_ANALYSIS_TIMEOUT_MS,
      45_000,
      5_000,
      180_000,
      "DOGOS_VIDEO_ANALYSIS_TIMEOUT_MS_INVALID",
    ),
  };
}

export function validateVideoFindings(value: unknown): VideoFinding[] {
  if (!Array.isArray(value)) throw new Error("VIDEO_FINDINGS_INVALID");
  return value.map((item) => {
    if (typeof item !== "object" || item === null) {
      throw new Error("VIDEO_FINDINGS_INVALID");
    }
    const candidate = item as Partial<VideoFinding>;
    if (
      typeof candidate.label !== "string" ||
      candidate.label.trim().length < 3 ||
      candidate.label.length > 90 ||
      typeof candidate.evidence !== "string" ||
      candidate.evidence.trim().length < 3 ||
      candidate.evidence.length > 260 ||
      typeof candidate.recommendation !== "string" ||
      candidate.recommendation.trim().length < 3 ||
      candidate.recommendation.length > 360 ||
      typeof candidate.confidence !== "number" ||
      candidate.confidence < 0 ||
      candidate.confidence > 1
    ) {
      throw new Error("VIDEO_FINDINGS_INVALID");
    }
    return {
      confidence: Math.round(candidate.confidence * 100) / 100,
      evidence: candidate.evidence.trim(),
      label: candidate.label.trim(),
      recommendation: candidate.recommendation.trim(),
    };
  });
}

export class DeterministicVideoAnalysisProvider implements VideoAnalysisProvider {
  async analyze(input: {
    dogId: string;
    frames: VideoFrameEvidence[];
    householdId: string;
    locale: "de-CH" | "en";
  }): Promise<VideoFinding[]> {
    if (input.frames.length === 0) {
      throw new Error("VIDEO_ANALYSIS_FRAMES_REQUIRED");
    }
    return [
      {
        confidence: 0.72,
        evidence:
          input.locale === "de-CH"
            ? "Deterministische Testauswertung mit überprüften Frame-Zeitpunkten."
            : "Deterministic test analysis with verified frame timestamps.",
        label:
          input.locale === "de-CH" ? "Testbeobachtung" : "Test observation",
        recommendation:
          input.locale === "de-CH"
            ? "Nur in Tests verwenden; echte Umgebungen müssen den OpenAI-Adapter aktivieren."
            : "Use only in tests; real environments must enable the OpenAI adapter.",
      },
    ];
  }
}

export class OpenAIVideoAnalysisProvider implements VideoAnalysisProvider {
  readonly #client: OpenAI;
  readonly #config: VideoAnalysisConfig;

  constructor(input: {
    apiKey: string;
    baseUrl?: string;
    config: VideoAnalysisConfig;
  }) {
    this.#config = input.config;
    this.#client = new OpenAI({
      apiKey: input.apiKey,
      ...(input.baseUrl === undefined ? {} : { baseURL: input.baseUrl }),
    });
  }

  async analyze(input: {
    frames: VideoFrameEvidence[];
    locale: "de-CH" | "en";
  }): Promise<VideoFinding[]> {
    if (input.frames.length === 0) {
      throw new Error("VIDEO_ANALYSIS_FRAMES_REQUIRED");
    }
    const frames = input.frames.slice(0, this.#config.maxFrames);
    const response = await this.#client.responses.create(
      {
        input: [
          {
            content: [
              {
                text: [
                  "You review sampled frames from a dog training video.",
                  "Return JSON only: an array of findings with label, evidence, recommendation, confidence.",
                  "Do not diagnose, infer pain, trauma, anxiety, aggression, identity, breed certainty, or human biometrics.",
                  "Only describe visible, evidence-backed training setup, handler timing, leash/body-position cues, reinforcement delivery, and immediate safety stop conditions.",
                  `Locale: ${input.locale}.`,
                ].join(" "),
                type: "input_text",
              },
              ...frames.map((frame) => ({
                detail: "low" as const,
                image_url: `data:${frame.contentType};base64,${frame.data}`,
                type: "input_image" as const,
              })),
            ],
            role: "user" as const,
          },
        ],
        max_output_tokens: 1200,
        model: this.#config.model,
        store: false,
      },
      { timeout: this.#config.timeoutMs },
    );
    if (response.status !== "completed" || response.output_text.trim() === "") {
      throw new Error(
        `VIDEO_ANALYSIS_${(response.status ?? "incomplete").toUpperCase()}`,
      );
    }
    return validateVideoFindings(JSON.parse(response.output_text));
  }
}
