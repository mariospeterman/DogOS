import { spawn } from "node:child_process";
import { loadMetaWhatsAppConfig } from "@dogos/whatsapp";

const config = loadMetaWhatsAppConfig(process.env);
if (config === null || config.mode !== "meta_test") {
  throw new Error("WHATSAPP_MODE must be meta_test for the restricted pilot");
}
const webhook = process.env.WHATSAPP_PUBLIC_WEBHOOK_URL;
if (webhook === undefined || !webhook.startsWith("https://")) {
  throw new Error("WHATSAPP_PUBLIC_WEBHOOK_URL must be a public HTTPS URL");
}
process.stdout.write(
  `Restricted Meta pilot ready for ${config.allowlistedContacts.size} contact(s).\nWebhook: ${webhook}\n`,
);
const child = spawn("pnpm", ["--filter", "@dogos/api", "dev"], {
  env: process.env,
  stdio: "inherit",
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
