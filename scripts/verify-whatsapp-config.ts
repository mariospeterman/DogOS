import { loadMetaWhatsAppConfig } from "@dogos/whatsapp";

try {
  const config = loadMetaWhatsAppConfig(process.env);
  const result =
    config === null
      ? { mode: "simulator", ready: true }
      : {
          mode: config.mode,
          ready: true,
          graphVersion: config.graphVersion,
          phoneNumberIdConfigured: config.phoneNumberId.length > 0,
          allowlistedContacts: config.allowlistedContacts.size,
          publicWebhook: process.env.WHATSAPP_PUBLIC_WEBHOOK_URL ?? null,
        };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : "WHATSAPP_CONFIG_INVALID"}\n`,
  );
  process.exitCode = 1;
}
