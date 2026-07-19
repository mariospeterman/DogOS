import OpenAI from "openai";

import type {
  VideoAnalysisRecord,
  VideoAnalysisStore,
  VideoFinding,
} from "@dogos/database";

export type VideoAnalysisProviderMode =
  "deterministic" | "google_vertex" | "openai";

export interface VideoAnalysisConfig {
  googleAccessToken?: string;
  googleAuthMode?: "access_token" | "adc";
  googleLocation?: string;
  googleProject?: string;
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
    activeGoal?: string;
    activeStep?: string | null;
    dogId: string;
    frames: VideoFrameEvidence[];
    householdId: string;
    locale: "de-CH" | "en";
    ownerCaption?: string;
    previousFindings?: VideoFinding[];
  }): Promise<VideoFinding[]>;
}

export interface VideoObjectInspection {
  codec: string | null;
  durationSeconds: number;
  malwareVerdict: "clean" | "unknown" | "blocked";
  privateObjectVerified: boolean;
}

export interface VideoObjectInspector {
  extractFrames(input: {
    maxFrames: number;
    objectKey: string;
  }): Promise<VideoFrameEvidence[]>;
  inspect(input: {
    contentType: VideoAnalysisRecord["contentType"];
    objectKey: string;
    sizeBytes: number;
  }): Promise<VideoObjectInspection>;
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
  const mode =
    environment.DOGOS_VOD_PROVIDER ??
    environment.DOGOS_VIDEO_ANALYSIS_PROVIDER ??
    "disabled";
  if (mode === "disabled") return null;
  if (
    mode !== "deterministic" &&
    mode !== "openai" &&
    mode !== "google_vertex"
  ) {
    throw new Error("DOGOS_VIDEO_ANALYSIS_PROVIDER_UNSUPPORTED");
  }
  if (mode === "openai" && !environment.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY_REQUIRED");
  }
  if (mode === "google_vertex" && !environment.GOOGLE_VERTEX_PROJECT) {
    throw new Error("GOOGLE_VERTEX_PROJECT_REQUIRED");
  }
  return {
    ...(environment.GOOGLE_VERTEX_ACCESS_TOKEN === undefined
      ? {}
      : { googleAccessToken: environment.GOOGLE_VERTEX_ACCESS_TOKEN }),
    googleAuthMode:
      environment.GOOGLE_VERTEX_AUTH_MODE === "access_token"
        ? "access_token"
        : "adc",
    ...(environment.GOOGLE_VERTEX_LOCATION === undefined
      ? {}
      : { googleLocation: environment.GOOGLE_VERTEX_LOCATION }),
    ...(environment.GOOGLE_VERTEX_PROJECT === undefined
      ? {}
      : { googleProject: environment.GOOGLE_VERTEX_PROJECT }),
    maxFrames: integerSetting(
      environment.DOGOS_VOD_MAX_EVENT_WINDOWS ??
        environment.DOGOS_VIDEO_ANALYSIS_MAX_FRAMES,
      12,
      1,
      48,
      "DOGOS_VIDEO_ANALYSIS_MAX_FRAMES_INVALID",
    ),
    mode,
    model:
      environment.DOGOS_VOD_MODEL ??
      environment.DOGOS_VIDEO_ANALYSIS_MODEL ??
      (mode === "google_vertex" ? "gemini-3.5-flash" : "gpt-5.6-terra"),
    timeoutMs: integerSetting(
      environment.DOGOS_VOD_TIMEOUT_MS ??
        environment.DOGOS_VIDEO_ANALYSIS_TIMEOUT_MS,
      180_000,
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

export function createVideoAnalysisProvider(input: {
  apiKey?: string;
  baseUrl?: string;
  config: VideoAnalysisConfig;
}): VideoAnalysisProvider {
  if (input.config.mode === "deterministic") {
    return new DeterministicVideoAnalysisProvider();
  }
  if (input.config.mode === "google_vertex") {
    if (input.config.googleProject === undefined) {
      throw new Error("GOOGLE_VERTEX_PROJECT_REQUIRED");
    }
    if (
      (input.config.googleAuthMode ?? "adc") === "access_token" &&
      input.config.googleAccessToken === undefined
    ) {
      throw new Error("GOOGLE_VERTEX_ACCESS_TOKEN_REQUIRED");
    }
    return new VertexGeminiVideoAnalysisProvider(input.config);
  }
  if (input.apiKey === undefined || input.apiKey.trim().length === 0) {
    throw new Error("OPENAI_API_KEY_REQUIRED");
  }
  return new OpenAIVideoAnalysisProvider({
    apiKey: input.apiKey,
    ...(input.baseUrl === undefined ? {} : { baseUrl: input.baseUrl }),
    config: input.config,
  });
}

interface VertexGenerateResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
}

export class VertexGeminiVideoAnalysisProvider implements VideoAnalysisProvider {
  readonly #config: VideoAnalysisConfig;

  constructor(config: VideoAnalysisConfig) {
    this.#config = config;
  }

  async analyze(input: {
    activeGoal?: string;
    activeStep?: string | null;
    frames: VideoFrameEvidence[];
    locale: "de-CH" | "en";
    ownerCaption?: string;
    previousFindings?: VideoFinding[];
  }): Promise<VideoFinding[]> {
    if (input.frames.length === 0) {
      throw new Error("VIDEO_ANALYSIS_FRAMES_REQUIRED");
    }
    const project = this.#config.googleProject;
    const token = await this.#accessToken();
    const location = this.#config.googleLocation ?? "europe-west4";
    const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/${this.#config.model}:generateContent`;
    const frames = input.frames.slice(0, this.#config.maxFrames);
    const response = await fetch(url, {
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: [
                  "You review sampled frames from a dog training video.",
                  "Return strict JSON only: an array of findings with label, evidence, recommendation, confidence.",
                  "Never diagnose, identify people, infer protected traits, infer breed certainty, or convert candidate observations into medical conclusions.",
                  "Only report visible training setup, handler timing, reinforcement delivery, leash/body-position mechanics, and immediate safety stop conditions.",
                  `Locale: ${input.locale}.`,
                  `Owner caption: ${input.ownerCaption ?? "not supplied"}.`,
                  `Active goal: ${input.activeGoal ?? "not supplied"}.`,
                  `Active step: ${input.activeStep ?? "not supplied"}.`,
                  `Previous findings: ${JSON.stringify(input.previousFindings ?? [])}.`,
                ].join(" "),
              },
              ...frames.flatMap((frame) => [
                { text: `Frame timestamp: ${frame.timestampMs} ms.` },
                {
                  inlineData: {
                    data: frame.data,
                    mimeType: frame.contentType,
                  },
                },
              ]),
            ],
          },
        ],
        generationConfig: {
          maxOutputTokens: 1200,
          responseMimeType: "application/json",
          temperature: 0.1,
        },
      }),
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      method: "POST",
      signal: AbortSignal.timeout(this.#config.timeoutMs),
    });
    if (!response.ok) {
      throw new Error("VIDEO_ANALYSIS_PROVIDER_FAILED");
    }
    const body = (await response.json()) as VertexGenerateResponse;
    const text =
      body.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? "")
        .join("")
        .trim() ?? "";
    if (text.length === 0) throw new Error("VIDEO_ANALYSIS_EMPTY");
    return validateVideoFindings(JSON.parse(text));
  }

  async #accessToken(): Promise<string> {
    if (this.#config.googleAccessToken !== undefined) {
      return this.#config.googleAccessToken;
    }
    try {
      const { GoogleAuth } = await import("google-auth-library");
      const auth = new GoogleAuth({
        scopes: ["https://www.googleapis.com/auth/cloud-platform"],
      });
      const client = await auth.getClient();
      const token = await client.getAccessToken();
      if (typeof token.token !== "string" || token.token.length === 0) {
        throw new Error("GOOGLE_VERTEX_ADC_TOKEN_EMPTY");
      }
      return token.token;
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "GOOGLE_VERTEX_ADC_TOKEN_EMPTY"
      ) {
        throw error;
      }
      throw new Error("GOOGLE_VERTEX_ADC_AUTH_REQUIRED");
    }
  }
}

export class VideoAnalysisWorker {
  constructor(
    private readonly input: {
      config: VideoAnalysisConfig;
      inspector: VideoObjectInspector;
      provider: VideoAnalysisProvider;
      store: VideoAnalysisStore;
    },
  ) {}

  async processUploadedAnalysis(input: {
    activeGoal?: string;
    activeStep?: string | null;
    householdId: string;
    id: string;
    locale: "de-CH" | "en";
    ownerCaption?: string;
  }): Promise<VideoAnalysisRecord> {
    const existing = await this.input.store.get({
      householdId: input.householdId,
      id: input.id,
    });
    if (existing === null) throw new Error("RESOURCE_NOT_FOUND");
    if (existing.status === "completed" || existing.status === "failed") {
      return existing;
    }
    if (existing.status !== "uploaded" && existing.status !== "processing") {
      throw new Error("VIDEO_ANALYSIS_NOT_READY");
    }
    try {
      const processing =
        existing.status === "processing" ||
        this.input.store.markProcessing === undefined
          ? existing
          : await this.input.store.markProcessing({
              householdId: input.householdId,
              id: input.id,
            });
      const inspection = await this.input.inspector.inspect({
        contentType: processing.contentType,
        objectKey: processing.storageObjectKey,
        sizeBytes: processing.sizeBytes,
      });
      if (!inspection.privateObjectVerified) {
        throw new Error("VIDEO_OBJECT_NOT_PRIVATE");
      }
      if (inspection.malwareVerdict === "blocked") {
        throw new Error("VIDEO_OBJECT_BLOCKED");
      }
      if (
        !Number.isFinite(inspection.durationSeconds) ||
        inspection.durationSeconds <= 0 ||
        inspection.durationSeconds > 900
      ) {
        throw new Error("VIDEO_DURATION_UNSUPPORTED");
      }
      const frames = await this.input.inspector.extractFrames({
        maxFrames: this.input.config.maxFrames,
        objectKey: processing.storageObjectKey,
      });
      const findings = await this.input.provider.analyze({
        ...(input.activeGoal === undefined
          ? {}
          : { activeGoal: input.activeGoal }),
        ...(input.activeStep === undefined
          ? {}
          : { activeStep: input.activeStep }),
        dogId: processing.dogId,
        frames,
        householdId: processing.householdId,
        locale: input.locale,
        ...(input.ownerCaption === undefined
          ? {}
          : { ownerCaption: input.ownerCaption }),
        previousFindings: processing.findings,
      });
      return this.input.store.completeAnalysis({
        findings: validateVideoFindings(findings),
        householdId: input.householdId,
        id: input.id,
      });
    } catch (error) {
      const failureCode =
        error instanceof Error && error.message.startsWith("VIDEO_")
          ? error.message
          : "VIDEO_ANALYSIS_FAILED";
      return this.input.store.failAnalysis({
        failureCode,
        householdId: input.householdId,
        id: input.id,
      });
    }
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
    activeGoal?: string;
    activeStep?: string | null;
    frames: VideoFrameEvidence[];
    locale: "de-CH" | "en";
    ownerCaption?: string;
    previousFindings?: VideoFinding[];
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
                  "Return strict JSON only: an array of findings with label, evidence, recommendation, confidence.",
                  "Do not diagnose, infer pain, trauma, anxiety, aggression, identity, breed certainty, or human biometrics.",
                  "Only describe visible, evidence-backed training setup, handler timing, leash/body-position cues, reinforcement delivery, and immediate safety stop conditions.",
                  `Locale: ${input.locale}.`,
                  `Owner caption: ${input.ownerCaption ?? "not supplied"}.`,
                  `Active goal: ${input.activeGoal ?? "not supplied"}.`,
                  `Active step: ${input.activeStep ?? "not supplied"}.`,
                  `Previous findings: ${JSON.stringify(input.previousFindings ?? [])}.`,
                ].join(" "),
                type: "input_text",
              },
              ...frames.flatMap((frame) => [
                {
                  text: `Frame timestamp: ${frame.timestampMs} ms.`,
                  type: "input_text" as const,
                },
                {
                  detail: "low" as const,
                  image_url: `data:${frame.contentType};base64,${frame.data}`,
                  type: "input_image" as const,
                },
              ]),
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
