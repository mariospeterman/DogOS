import { createClient } from "@supabase/supabase-js";

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
