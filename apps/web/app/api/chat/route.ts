import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  safeValidateUIMessages,
  type UIMessage,
} from "ai";

interface CoachApiResponse {
  reply: { text: string };
}

interface OnboardingApiResponse {
  messages: Array<{ content: string; role: "assistant" | "user" }>;
}

function latestUserText(messages: UIMessage[]): string | null {
  const message = messages.findLast((entry) => entry.role === "user");
  if (message === undefined) return null;
  const text = message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();
  return text.length > 0 && text.length <= 2_000 ? text : null;
}

function isUiMessageArray(value: unknown): value is UIMessage[] {
  return Array.isArray(value);
}

function latestUserTextFromUnknown(messages: unknown): string | null {
  if (!Array.isArray(messages)) return null;
  const message = messages.findLast(
    (entry): entry is { parts: unknown[]; role: "user" } =>
      typeof entry === "object" &&
      entry !== null &&
      (entry as { role?: unknown }).role === "user" &&
      Array.isArray((entry as { parts?: unknown }).parts),
  );
  if (message === undefined) return null;
  const text = message.parts
    .filter(
      (part): part is { text: string; type: "text" } =>
        typeof part === "object" &&
        part !== null &&
        (part as { type?: unknown }).type === "text" &&
        typeof (part as { text?: unknown }).text === "string",
    )
    .map((part) => part.text)
    .join("\n")
    .trim();
  return text.length > 0 && text.length <= 2_000 ? text : null;
}

function dogosServerApiBase(): string {
  const configured =
    process.env.DOGOS_INTERNAL_API_URL ??
    process.env.DOGOS_API_URL ??
    process.env.NEXT_PUBLIC_API_URL;
  const local = (process.env.NEXT_PUBLIC_DOGOS_ENV ?? "local") === "local";
  if (
    local &&
    (configured === undefined ||
      configured.startsWith("http://127.0.0.1") ||
      configured.startsWith("http://localhost"))
  ) {
    return "http://127.0.0.1:4000";
  }
  return configured ?? "http://127.0.0.1:4000";
}

export async function POST(request: Request) {
  try {
    const raw = (await request.json()) as {
      contextKind?:
        "general" | "media" | "plan" | "progress" | "session" | "today";
      dogId?: string;
      messages?: unknown;
    };
    const validation = await safeValidateUIMessages({ messages: raw.messages });
    const messages =
      validation.success && isUiMessageArray(validation.data)
        ? validation.data
        : [];
    const message =
      messages.length === 0
        ? latestUserTextFromUnknown(raw.messages)
        : latestUserText(messages);
    if (message === null) {
      return new Response("Invalid chat request", { status: 400 });
    }
    const hasDog = typeof raw.dogId === "string";
    if (
      hasDog &&
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        raw.dogId!,
      )
    )
      return new Response("Invalid chat request", { status: 400 });

    const upstreamHeaders: Record<string, string> = {
      "content-type": "application/json",
      "idempotency-key":
        request.headers.get("idempotency-key") ?? crypto.randomUUID(),
    };
    for (const name of ["authorization", "x-dogos-user"] as const) {
      const value = request.headers.get(name);
      if (value !== null) upstreamHeaders[name] = value;
    }
    const apiBase = dogosServerApiBase();
    const response = await fetch(
      `${apiBase}${
        hasDog ? "/v1/coach/messages?stream=1" : "/v1/onboarding/messages"
      }`,
      {
        body: JSON.stringify(
          hasDog
            ? {
                contextKind: raw.contextKind ?? "general",
                dogId: raw.dogId,
                message,
              }
            : { message },
        ),
        headers: upstreamHeaders,
        method: "POST",
      },
    );
    if (!response.ok) {
      return new Response(
        response.status === 401
          ? "Authentication required"
          : "DogOS could not answer right now",
        { status: response.status },
      );
    }
    if (hasDog) {
      if (response.body === null) {
        return new Response("Invalid DogOS response", { status: 502 });
      }
      const stream = createUIMessageStream({
        async execute({ writer }) {
          const id = crypto.randomUUID();
          const reader = response.body!.getReader();
          const decoder = new TextDecoder();
          writer.write({ id, type: "text-start" });
          try {
            for (;;) {
              const { done, value } = await reader.read();
              if (done) break;
              const delta = decoder.decode(value, { stream: true });
              if (delta.length > 0) {
                writer.write({ delta, id, type: "text-delta" });
              }
            }
            const final = decoder.decode();
            if (final.length > 0) {
              writer.write({ delta: final, id, type: "text-delta" });
            }
          } finally {
            writer.write({ id, type: "text-end" });
            reader.releaseLock();
          }
        },
        onError: () => "DogOS could not answer right now.",
        ...(messages.length === 0 ? {} : { originalMessages: messages }),
      });
      return createUIMessageStreamResponse({ stream });
    }
    const result = (await response.json()) as
      CoachApiResponse | OnboardingApiResponse;
    const reply = hasDog
      ? (result as CoachApiResponse).reply?.text
      : (result as OnboardingApiResponse).messages.findLast(
          (entry) => entry.role === "assistant",
        )?.content;
    if (typeof reply !== "string") {
      return new Response("Invalid DogOS response", { status: 502 });
    }
    const stream = createUIMessageStream({
      execute({ writer }) {
        const id = crypto.randomUUID();
        writer.write({ id, type: "text-start" });
        writer.write({ delta: reply, id, type: "text-delta" });
        writer.write({ id, type: "text-end" });
      },
      onError: () => "DogOS could not answer right now.",
      ...(messages.length === 0 ? {} : { originalMessages: messages }),
    });
    return createUIMessageStreamResponse({ stream });
  } catch (caught) {
    const local = (process.env.NEXT_PUBLIC_DOGOS_ENV ?? "local") === "local";
    return new Response(
      local && caught instanceof Error
        ? `Invalid chat request: ${caught.message}`
        : "Invalid chat request",
      { status: 400 },
    );
  }
}
