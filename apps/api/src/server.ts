import { loadApiEnv } from "@dogos/config/api";
import {
  InMemoryWhatsAppStateStore,
  loadMetaWhatsAppConfig,
  LocalWhatsAppSimulator,
  MetaCloudWhatsAppProvider,
  PostgresWhatsAppStateStore,
  WhatsAppWebhookService,
} from "@dogos/whatsapp";

import { buildApp } from "./app.js";

const environment = loadApiEnv(process.env);
const metaConfig = loadMetaWhatsAppConfig(process.env);
const whatsappStore =
  metaConfig === null
    ? new InMemoryWhatsAppStateStore()
    : new PostgresWhatsAppStateStore(
        process.env.DATABASE_URL ??
          "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
      );
const whatsappProvider =
  metaConfig === null
    ? new LocalWhatsAppSimulator(
        process.env.WHATSAPP_VERIFY_TOKEN ?? "local-whatsapp-secret",
      )
    : new MetaCloudWhatsAppProvider(metaConfig);
const whatsapp = new WhatsAppWebhookService(
  whatsappProvider,
  whatsappStore,
  process.env.WHATSAPP_ACCOUNT_LINK_URL ??
    "http://127.0.0.1:3000/app/account/link",
);
const app = buildApp({ whatsapp });

try {
  await app.listen({ host: environment.API_HOST, port: environment.API_PORT });
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
}
