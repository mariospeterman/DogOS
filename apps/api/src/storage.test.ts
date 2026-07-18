import { describe, expect, it } from "vitest";

import {
  DeterministicVideoUploadSigner,
  loadSupabaseStorageConfig,
} from "./storage.js";

describe("Supabase storage upload configuration", () => {
  it("is disabled when no Supabase storage credentials are configured", () => {
    expect(loadSupabaseStorageConfig({})).toBeNull();
  });

  it("loads hosted Supabase storage with the dog media bucket by default", () => {
    expect(
      loadSupabaseStorageConfig({
        SUPABASE_SECRET_KEY: "sb_secret_real_provider_key",
        SUPABASE_URL: "https://project-ref.supabase.co",
      }),
    ).toEqual({
      bucket: "dog-media",
      secretKey: "sb_secret_real_provider_key",
      supabaseUrl: "https://project-ref.supabase.co",
    });
  });

  it("rejects partial Supabase storage configuration", () => {
    expect(() =>
      loadSupabaseStorageConfig({
        SUPABASE_URL: "https://project-ref.supabase.co",
      }),
    ).toThrow("SUPABASE_STORAGE_CONFIGURATION_INCOMPLETE");
  });

  it("keeps deterministic uploads for local product demos", async () => {
    await expect(
      new DeterministicVideoUploadSigner().createUpload({
        contentType: "video/mp4",
        objectKey: "household/dog/video",
      }),
    ).resolves.toEqual({
      expiresInSeconds: 900,
      method: "PUT",
      url: "dogos://video-uploads/household/dog/video",
    });
  });
});
