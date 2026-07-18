import { loadApiEnv } from "@dogos/config/api";
import {
  CoachConversationService,
  InMemoryCoachConversationStore,
  PostgresCoachConversationStore,
} from "@dogos/conversation";
import {
  AccountRepository,
  BillingRepository,
  CapabilityUsageRepository,
  ModelRunRepository,
  OnboardingRepository,
  OnboardingSessionRepository,
  PostgresRepository,
} from "@dogos/database";

import { buildApp } from "./app.js";
import { createRequestAuthenticator } from "./auth.js";
import { loadStripeBillingConfig, StripeBillingService } from "./billing.js";
import {
  loadCoachModelConfig,
  OpenAICoachReplyGenerator,
  OpenAIOnboardingInterpreter,
} from "./llm.js";
import { OnboardingService } from "./onboarding-service.js";
import { SignedActionService } from "./signed-actions.js";
import { WebOnboardingService } from "./web-onboarding-service.js";

const environment = loadApiEnv(process.env);
const accounts = environment.DATABASE_URL
  ? new AccountRepository(environment.DATABASE_URL)
  : undefined;
const onboardingRepository = environment.DATABASE_URL
  ? new OnboardingRepository(environment.DATABASE_URL)
  : undefined;
const onboardingSessions = environment.DATABASE_URL
  ? new OnboardingSessionRepository(environment.DATABASE_URL)
  : undefined;
const commands = environment.DATABASE_URL
  ? new PostgresRepository(environment.DATABASE_URL)
  : undefined;
const capabilityUsage = environment.DATABASE_URL
  ? new CapabilityUsageRepository(environment.DATABASE_URL)
  : undefined;
const stripeConfig = loadStripeBillingConfig(process.env);
const billingRepository =
  environment.DATABASE_URL && stripeConfig
    ? new BillingRepository(environment.DATABASE_URL)
    : undefined;
const billing =
  stripeConfig && billingRepository
    ? new StripeBillingService(stripeConfig, billingRepository)
    : undefined;
const coachModelConfig = loadCoachModelConfig(process.env);
if (coachModelConfig !== null && environment.DATABASE_URL === undefined) {
  throw new Error("LLM_MODEL_RUN_DATABASE_REQUIRED");
}
const modelRuns =
  coachModelConfig && environment.DATABASE_URL
    ? new ModelRunRepository(environment.DATABASE_URL)
    : undefined;
const coachGenerator =
  coachModelConfig && modelRuns
    ? new OpenAICoachReplyGenerator(coachModelConfig, modelRuns)
    : undefined;
const onboardingInterpreter =
  coachModelConfig && modelRuns
    ? new OpenAIOnboardingInterpreter(coachModelConfig, modelRuns)
    : undefined;
const onboarding =
  onboardingRepository === undefined
    ? undefined
    : new OnboardingService(onboardingRepository);
const webOnboarding =
  onboarding === undefined || onboardingSessions === undefined
    ? undefined
    : new WebOnboardingService({
        ...(onboardingInterpreter === undefined
          ? {}
          : {
              interpret: (input) => onboardingInterpreter.interpret(input),
            }),
        projector: onboarding,
        sessions: onboardingSessions,
      });
const authenticator = createRequestAuthenticator({
  ...(accounts === undefined ? {} : { accountRepository: accounts }),
  authMode: environment.DOGOS_AUTH_MODE,
  databaseUrl: environment.DATABASE_URL,
  environment: environment.DOGOS_ENV,
  publishableKey: environment.SUPABASE_PUBLISHABLE_KEY,
  supabaseUrl: environment.SUPABASE_URL,
});
const coachStore = environment.DATABASE_URL
  ? new PostgresCoachConversationStore(environment.DATABASE_URL)
  : new InMemoryCoachConversationStore();
const coach = new CoachConversationService(coachStore, coachGenerator);
const signedActions = new SignedActionService(
  {
    pilot1:
      process.env.SIGNED_LINK_SECRET ??
      "local-only-change-before-production-32-chars",
  },
  "pilot1",
);
const app = buildApp({
  ...(accounts === undefined ? {} : { accounts }),
  authenticator,
  ...(billing === undefined ? {} : { billing }),
  coach,
  ...(webOnboarding === undefined ? {} : { onboarding: webOnboarding }),
  ...(commands === undefined ? {} : { commands }),
  ...(capabilityUsage === undefined ? {} : { usage: capabilityUsage }),
  ...(onboardingRepository === undefined
    ? {}
    : { products: onboardingRepository }),
  signedActions,
});

try {
  await app.listen({ host: environment.API_HOST, port: environment.API_PORT });
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
}
