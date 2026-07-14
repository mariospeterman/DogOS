import { loadApiEnv } from "@dogos/config/api";

import { buildApp } from "./app.js";

const environment = loadApiEnv(process.env);
const app = buildApp();

try {
  await app.listen({ host: environment.API_HOST, port: environment.API_PORT });
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
}
