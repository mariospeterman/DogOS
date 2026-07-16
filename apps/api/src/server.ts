import type { AgentActorContext } from "@dogos/agent-auth";
import { DogosApiTransport, DogosToolRuntime } from "@dogos/agent-tools";
import { loadApiEnv } from "@dogos/config/api";
import {
  InMemoryWhatsAppStateStore,
  loadMetaWhatsAppConfig,
  loadTwilioSandboxWhatsAppConfig,
  LocalWhatsAppSimulator,
  MetaCloudWhatsAppProvider,
  PostgresWhatsAppStateStore,
  TwilioSandboxWhatsAppProvider,
  WhatsAppWebhookService,
} from "@dogos/whatsapp";

import { buildApp } from "./app.js";
import { createRequestAuthenticator } from "./auth.js";
import { ProductService } from "./product-service.js";
import { SignedActionService } from "./signed-actions.js";

const environment = loadApiEnv(process.env);
const authenticator = createRequestAuthenticator({
  authMode: environment.DOGOS_AUTH_MODE,
  databaseUrl: environment.DATABASE_URL,
  environment: environment.DOGOS_ENV,
  publishableKey: environment.SUPABASE_PUBLISHABLE_KEY,
  supabaseUrl: environment.SUPABASE_URL,
});
const metaConfig = loadMetaWhatsAppConfig(process.env);
const twilioConfig = loadTwilioSandboxWhatsAppConfig(process.env);
const whatsappStore =
  metaConfig === null && twilioConfig === null
    ? new InMemoryWhatsAppStateStore()
    : new PostgresWhatsAppStateStore(
        process.env.DATABASE_URL ??
          "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
        twilioConfig === null ? "meta_cloud" : "twilio_sandbox",
      );
const whatsappProvider =
  twilioConfig !== null
    ? new TwilioSandboxWhatsAppProvider(twilioConfig)
    : metaConfig === null
      ? new LocalWhatsAppSimulator(
          process.env.WHATSAPP_VERIFY_TOKEN ?? "local-whatsapp-secret",
        )
      : new MetaCloudWhatsAppProvider(metaConfig);
const product = new ProductService();
const signedActions = new SignedActionService(
  {
    pilot1:
      process.env.SIGNED_LINK_SECRET ??
      "local-only-change-before-production-32-chars",
  },
  "pilot1",
);
const toolRuntime = new DogosToolRuntime(
  new DogosApiTransport(
    `http://${environment.API_HOST}:${String(environment.API_PORT)}`,
  ),
);
const whatsapp = new WhatsAppWebhookService(
  whatsappProvider,
  whatsappStore,
  process.env.WHATSAPP_ACCOUNT_LINK_URL ??
    "http://127.0.0.1:3000/app/account/link",
  async ({ contact, text }, traceId) => {
    const actor: AgentActorContext = {
      actorId: contact.userId!,
      authMode: "development",
      householdId: contact.householdId,
      identity: "owner",
      role: "owner",
      traceId,
    };
    const normalized = text.trim().toLowerCase();
    if (["progress", "fortschritt", "choice.3"].includes(normalized)) {
      const result = await toolRuntime.call(
        "dogos_get_progress",
        { planId: "plan-1" },
        actor,
      );
      const outbound = await whatsappProvider.sendText(
        contact.externalId,
        `DogOS progress: ${JSON.stringify(result.data).slice(0, 1200)}\nAssociation does not establish causation.`,
      );
      await whatsappStore.saveOutbound(outbound, traceId);
      return;
    }
    const result = await toolRuntime.call(
      "dogos_get_today",
      { dogId: "30000000-0000-0000-0000-000000000001" },
      actor,
    );
    const session = normalized === "choice.2";
    const token = await signedActions.issue({
      actorId: actor.actorId,
      householdId: actor.householdId!,
      purpose: session ? "open_session" : "open_today",
      subjectId: "30000000-0000-0000-0000-000000000001",
      ttlSeconds: 900,
    });
    const path = session ? "/app/session/session-1" : "/app/today";
    const webBase = process.env.WEB_ORIGIN ?? "http://127.0.0.1:3000";
    const outbound = await whatsappProvider.sendInteractive(
      contact.externalId,
      `Milo's approved training is ready. ${webBase}${path}?action=${encodeURIComponent(token)} (${result.status})`,
      ["Plan öffnen", "Training starten", "Fortschritt"],
    );
    await whatsappStore.saveOutbound(outbound, traceId);
  },
);
const app = buildApp({
  authenticator,
  product,
  signedActions,
  whatsapp,
  ...(twilioConfig === null
    ? {}
    : {
        twilio: {
          inboundWebhookUrl: twilioConfig.inboundWebhookUrl,
          service: whatsapp,
          statusCallbackUrl: twilioConfig.statusCallbackUrl,
        },
      }),
});

try {
  await app.listen({ host: environment.API_HOST, port: environment.API_PORT });
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
}
