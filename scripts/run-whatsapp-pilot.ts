import { spawn } from "node:child_process";
import {
  loadMetaWhatsAppConfig,
  loadTwilioSandboxWhatsAppConfig,
} from "@dogos/whatsapp";

const config = loadMetaWhatsAppConfig(process.env);
const twilio = loadTwilioSandboxWhatsAppConfig(process.env);
if (config === null && twilio === null) {
  throw new Error(
    "WHATSAPP_MODE must be meta_test or twilio_sandbox for the restricted pilot",
  );
}
const webhook =
  twilio?.inboundWebhookUrl ?? process.env.WHATSAPP_PUBLIC_WEBHOOK_URL;
if (webhook === undefined || !webhook.startsWith("https://")) {
  throw new Error("The provider webhook must be a public HTTPS URL");
}
process.stdout.write(
  `Restricted ${twilio === null ? "Meta" : "Twilio Sandbox"} pilot ready for ${String(
    (twilio ?? config)!.allowlistedContacts.size,
  )} contact(s).\nWebhook: ${webhook}\n`,
);
const child = spawn("pnpm", ["--filter", "@dogos/api", "dev"], {
  env: process.env,
  stdio: "inherit",
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
