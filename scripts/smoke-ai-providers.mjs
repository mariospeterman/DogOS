#!/usr/bin/env node

const required = process.argv.includes("--require");

function optionalEnv(name) {
  const value = process.env[name];
  return value === undefined || value.trim().length === 0 ? undefined : value;
}

async function postJson(url, input) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs);
  try {
    const response = await fetch(url, {
      body: JSON.stringify(input.body),
      headers: input.headers,
      method: "POST",
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(
        `${input.name}_HTTP_${response.status}: ${text.slice(0, 500)}`,
      );
    }
    return text.length === 0 ? null : JSON.parse(text);
  } finally {
    clearTimeout(timeout);
  }
}

async function smokeOpenAI() {
  const apiKey = optionalEnv("OPENAI_API_KEY");
  if (apiKey === undefined) {
    if (required) throw new Error("OPENAI_API_KEY_REQUIRED");
    return { provider: "openai", status: "skipped" };
  }
  const baseUrl =
    optionalEnv("OPENAI_BASE_URL") ??
    (process.env.OPENAI_DATA_REGION === "eu"
      ? "https://eu.api.openai.com/v1"
      : "https://api.openai.com/v1");
  const model = optionalEnv("DOGOS_TEXT_FAST_MODEL") ?? "gpt-5.6-luna";
  const output = await postJson(`${baseUrl}/responses`, {
    body: {
      input: "Return exactly: DOGOS_AI_SMOKE_OK",
      max_output_tokens: 32,
      model,
      store: false,
    },
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    name: "OPENAI_RESPONSES",
    timeoutMs: Number(optionalEnv("DOGOS_PROVIDER_SMOKE_TIMEOUT_MS") ?? 20000),
  });
  return {
    model,
    provider: "openai",
    responseId: output?.id ?? null,
    status: output?.status ?? "unknown",
  };
}

async function vertexAccessToken() {
  const explicit = optionalEnv("GOOGLE_VERTEX_ACCESS_TOKEN");
  if (
    explicit !== undefined &&
    (optionalEnv("GOOGLE_VERTEX_AUTH_MODE") ?? "adc") === "access_token"
  ) {
    return explicit;
  }
  try {
    const { GoogleAuth } = await import("google-auth-library");
    const auth = new GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });
    const client = await auth.getClient();
    const token = await client.getAccessToken();
    return typeof token.token === "string" && token.token.length > 0
      ? token.token
      : undefined;
  } catch {
    return explicit;
  }
}

async function smokeVertex() {
  const project = optionalEnv("GOOGLE_VERTEX_PROJECT");
  if (project === undefined) {
    if (required) throw new Error("GOOGLE_VERTEX_PROJECT_REQUIRED");
    return { provider: "google_vertex", status: "skipped" };
  }
  const token = await vertexAccessToken();
  if (token === undefined) {
    if (required) throw new Error("GOOGLE_VERTEX_CREDENTIALS_REQUIRED");
    return { provider: "google_vertex", status: "skipped" };
  }
  const location = optionalEnv("GOOGLE_VERTEX_LOCATION") ?? "europe-west4";
  const model = optionalEnv("DOGOS_VOD_MODEL") ?? "gemini-3.5-flash";
  const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/${model}:generateContent`;
  const output = await postJson(endpoint, {
    body: {
      contents: [
        {
          parts: [{ text: "Return exactly: DOGOS_VERTEX_SMOKE_OK" }],
          role: "user",
        },
      ],
      generationConfig: {
        maxOutputTokens: 32,
        temperature: 0,
      },
    },
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    name: "VERTEX_GENERATE_CONTENT",
    timeoutMs: Number(optionalEnv("DOGOS_PROVIDER_SMOKE_TIMEOUT_MS") ?? 20000),
  });
  return {
    candidateCount: Array.isArray(output?.candidates)
      ? output.candidates.length
      : 0,
    location,
    model,
    provider: "google_vertex",
    status: "completed",
  };
}

const results = [];
for (const smoke of [smokeOpenAI, smokeVertex]) {
  try {
    results.push(await smoke());
  } catch (error) {
    results.push({
      error: error instanceof Error ? error.message : String(error),
      provider: smoke.name.replace(/^smoke/, "").toLowerCase(),
      status: "failed",
    });
  }
}

console.log(JSON.stringify({ results }, null, 2));

if (results.some((result) => result.status === "failed")) {
  process.exitCode = 1;
}
