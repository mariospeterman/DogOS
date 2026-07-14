import {
  SpanStatusCode,
  trace,
  type Attributes,
  type Span,
} from "@opentelemetry/api";

export interface ErrorReporter {
  capture(error: unknown, context?: Readonly<Record<string, string>>): void;
}

export interface ProductAnalytics {
  capture(event: string, properties?: Readonly<Record<string, unknown>>): void;
}

export const noopErrorReporter: ErrorReporter = { capture: () => undefined };
export const noopProductAnalytics: ProductAnalytics = {
  capture: () => undefined,
};

export async function withSpan<T>(
  name: string,
  operation: (span: Span) => Promise<T>,
  attributes?: Attributes,
): Promise<T> {
  const options = attributes === undefined ? {} : { attributes };
  const span = trace.getTracer("@dogos/telemetry").startSpan(name, options);

  try {
    return await operation(span);
  } catch (error) {
    span.recordException(error instanceof Error ? error : String(error));
    span.setStatus({ code: SpanStatusCode.ERROR });
    throw error;
  } finally {
    span.end();
  }
}
