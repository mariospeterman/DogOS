import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessage,
  validateUIMessages,
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

export async function POST(request: Request) {
  try {
    const raw = (await request.json()) as {
      contextKind?:
        "general" | "media" | "plan" | "progress" | "session" | "today";
      dogId?: string;
      messages?: unknown;
    };
    const messages = await validateUIMessages({ messages: raw.messages });
    const message = latestUserText(messages);
    if (message === null) {
      return new Response("Invalid chat request", { status: 400 });
    }
    const hasDog = typeof raw.dogId === "string";
    if (
      hasDog &&
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
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
    const apiBase =
      process.env.DOGOS_API_URL ??
      process.env.NEXT_PUBLIC_API_URL ??
      "http://127.0.0.1:4000";
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
        originalMessages: messages,
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
      originalMessages: messages,
    });
    return createUIMessageStreamResponse({ stream });
  } catch {
    return new Response("Invalid chat request", { status: 400 });
  }
}
