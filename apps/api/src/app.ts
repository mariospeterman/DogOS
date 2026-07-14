import Fastify, { type FastifyInstance } from "fastify";

export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger: process.env.NODE_ENV !== "test",
    requestIdHeader: "x-request-id",
  });

  app.get("/health/live", async () => ({ status: "ok" as const }));
  app.get("/health/ready", async () => ({
    checks: { api: "ready" as const },
    status: "ready" as const,
  }));

  return app;
}
