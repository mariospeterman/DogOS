import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import type {
  VideoFrameEvidence,
  VideoObjectInspection,
  VideoObjectInspector,
} from "./video-analysis.js";

export interface VideoUploadTicket {
  expiresInSeconds: number;
  method: "PUT";
  url: string;
}

export interface VideoUploadSigner {
  createUpload(input: {
    contentType: "video/mp4" | "video/quicktime" | "video/webm";
    objectKey: string;
  }): Promise<VideoUploadTicket>;
}

export class DeterministicVideoUploadSigner implements VideoUploadSigner {
  async createUpload(input: {
    contentType: "video/mp4" | "video/quicktime" | "video/webm";
    objectKey: string;
  }): Promise<VideoUploadTicket> {
    return {
      expiresInSeconds: 900,
      method: "PUT",
      url: `dogos://video-uploads/${input.objectKey}`,
    };
  }
}

export interface SupabaseStorageConfig {
  bucket: string;
  secretKey: string;
  supabaseUrl: string;
}

export function loadSupabaseStorageConfig(
  environment: NodeJS.ProcessEnv,
): SupabaseStorageConfig | null {
  const supabaseUrl = environment.SUPABASE_URL;
  const secretKey = environment.SUPABASE_SECRET_KEY;
  const bucket = environment.SUPABASE_STORAGE_BUCKET ?? "dog-media";
  const values = [supabaseUrl, secretKey];

  if (values.every((value) => value === undefined || value === "")) {
    return null;
  }
  if (supabaseUrl === undefined || supabaseUrl === "") {
    throw new Error("SUPABASE_STORAGE_CONFIGURATION_INCOMPLETE");
  }
  if (secretKey === undefined || secretKey === "") {
    throw new Error("SUPABASE_STORAGE_CONFIGURATION_INCOMPLETE");
  }
  if (bucket.trim() === "") {
    throw new Error("SUPABASE_STORAGE_BUCKET_INVALID");
  }

  return { bucket, secretKey, supabaseUrl };
}

export class SupabaseVideoUploadSigner implements VideoUploadSigner {
  readonly #bucket: string;
  readonly #client: ReturnType<typeof createClient>;

  constructor(config: SupabaseStorageConfig) {
    this.#bucket = config.bucket;
    this.#client = createClient(config.supabaseUrl, config.secretKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    });
  }

  async createUpload(input: {
    contentType: "video/mp4" | "video/quicktime" | "video/webm";
    objectKey: string;
  }): Promise<VideoUploadTicket> {
    const { data, error } = await this.#client.storage
      .from(this.#bucket)
      .createSignedUploadUrl(input.objectKey);

    if (error !== null) {
      throw new Error("SUPABASE_STORAGE_SIGNED_UPLOAD_FAILED");
    }

    return {
      expiresInSeconds: 7200,
      method: "PUT",
      url: data.signedUrl,
    };
  }
}

function run(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { maxBuffer: 1024 * 1024 }, (error, stdout) => {
      if (error !== null) {
        reject(new Error(`${command.toUpperCase()}_FAILED`));
        return;
      }
      resolve(stdout);
    });
  });
}

interface ProbePayload {
  format?: { duration?: string };
  streams?: Array<{
    codec_name?: string;
    codec_type?: string;
  }>;
}

export class SupabaseFfmpegVideoObjectInspector
  implements VideoObjectInspector
{
  readonly #bucket: string;
  readonly #client: ReturnType<typeof createClient>;
  readonly #ffmpegPath: string;
  readonly #ffprobePath: string;

  constructor(
    config: SupabaseStorageConfig,
    options: { ffmpegPath?: string; ffprobePath?: string } = {},
  ) {
    this.#bucket = config.bucket;
    this.#client = createClient(config.supabaseUrl, config.secretKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    });
    this.#ffmpegPath = options.ffmpegPath ?? "ffmpeg";
    this.#ffprobePath = options.ffprobePath ?? "ffprobe";
  }

  async inspect(input: {
    contentType: "video/mp4" | "video/quicktime" | "video/webm";
    objectKey: string;
    sizeBytes: number;
  }): Promise<VideoObjectInspection> {
    const directory = await mkdtemp(join(tmpdir(), "dogos-video-"));
    try {
      const file = await this.#download(input.objectKey, directory);
      const probe = JSON.parse(
        await run(this.#ffprobePath, [
          "-v",
          "error",
          "-show_entries",
          "format=duration:stream=codec_type,codec_name",
          "-of",
          "json",
          file,
        ]),
      ) as ProbePayload;
      const durationSeconds = Number(probe.format?.duration ?? 0);
      const codec =
        probe.streams?.find((stream) => stream.codec_type === "video")
          ?.codec_name ?? null;
      return {
        codec,
        durationSeconds,
        malwareVerdict: "unknown",
        privateObjectVerified: true,
      };
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  }

  async extractFrames(input: {
    maxFrames: number;
    objectKey: string;
  }): Promise<VideoFrameEvidence[]> {
    const directory = await mkdtemp(join(tmpdir(), "dogos-frames-"));
    try {
      const file = await this.#download(input.objectKey, directory);
      const pattern = join(directory, "frame-%03d.jpg");
      await run(this.#ffmpegPath, [
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        file,
        "-vf",
        `fps=${Math.max(1, Math.min(input.maxFrames, 12))}/60,scale='min(960,iw)':-2`,
        "-frames:v",
        String(input.maxFrames),
        "-q:v",
        "4",
        pattern,
      ]);
      const frames: VideoFrameEvidence[] = [];
      for (let index = 1; index <= input.maxFrames; index += 1) {
        const path = join(directory, `frame-${String(index).padStart(3, "0")}.jpg`);
        try {
          const data = await readFile(path);
          frames.push({
            contentType: "image/jpeg",
            data: data.toString("base64"),
            timestampMs: Math.round(((index - 1) * 60_000) / Math.max(1, input.maxFrames)),
          });
        } catch {
          break;
        }
      }
      if (frames.length === 0) throw new Error("VIDEO_ANALYSIS_FRAMES_REQUIRED");
      return frames;
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  }

  async #download(objectKey: string, directory: string): Promise<string> {
    const { data, error } = await this.#client.storage
      .from(this.#bucket)
      .download(objectKey);
    if (error !== null || data === null) {
      throw new Error("VIDEO_OBJECT_DOWNLOAD_FAILED");
    }
    const buffer = Buffer.from(await data.arrayBuffer());
    const file = join(directory, "source-video");
    await writeFile(file, buffer);
    return file;
  }
}
