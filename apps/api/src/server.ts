import { loadApiEnv } from "@dogos/config/api";
import {
  InMemoryWhatsAppStateStore,
  loadMetaWhatsAppConfig,
  loadTwilioSandboxWhatsAppConfig,
  LocalWhatsAppSimulator,
  MetaCloudWhatsAppProvider,
  PostgresWhatsAppStateStore,
  TwilioSandboxWhatsAppProvider,
  WhatsAppConversationOrchestrator,
  WhatsAppWebhookService,
} from "@dogos/whatsapp";
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
import { presentStage } from "./training-presentation.js";

const environment = loadApiEnv(process.env);
const accounts = environment.DATABASE_URL
  ? new AccountRepository(environment.DATABASE_URL)
  : undefined;
const onboardingRepository = environment.DATABASE_URL
  ? new OnboardingRepository(environment.DATABASE_URL)
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
const authenticator = createRequestAuthenticator({
  ...(accounts === undefined ? {} : { accountRepository: accounts }),
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
const webBase = process.env.WEB_ORIGIN ?? "http://127.0.0.1:3000";
const conversation = new WhatsAppConversationOrchestrator({
  ...(onboardingInterpreter === undefined
    ? {}
    : {
        interpretOnboarding: (input) => onboardingInterpreter.interpret(input),
      }),
  links: async (contact) => {
    const actorId = contact.userId!;
    const householdId = contact.householdId!;
    const context = await onboarding?.findByContact(contact.id);
    if (context === null || context === undefined) {
      throw new Error("ONBOARDING_PRODUCT_CONTEXT_REQUIRED");
    }
    const issue = async (
      purpose: "open_plan" | "open_progress" | "open_today" | "open_trainers",
      path: string,
    ) => {
      const token = await signedActions.issue({
        actorId,
        householdId,
        purpose,
        subjectId: context.dogId,
        ttlSeconds: 900,
      });
      return `${webBase}${path}?action=${encodeURIComponent(token)}`;
    };
    const [today, plan, progress, referral] = await Promise.all([
      issue("open_today", "/app/today"),
      issue("open_plan", "/app/plan"),
      issue("open_progress", "/app/progress"),
      issue("open_trainers", "/app/trainers"),
    ]);
    return {
      account: `${webBase}/app/account`,
      plan,
      progress,
      referral,
      today,
    };
  },
  ...(onboarding === undefined
    ? {}
    : {
        productContext: async (contact) => {
          const context = await onboarding.findByContact(contact.id);
          if (context === null || contact.householdId === null) return context;
          const dashboard =
            (await onboardingRepository?.dashboardByDog(
              context.dogId,
              contact.householdId,
            )) ?? context;
          const currentStep =
            "currentStep" in dashboard ? dashboard.currentStep : null;
          const stepCode =
            currentStep !== null &&
            typeof currentStep === "object" &&
            "stepCode" in currentStep &&
            typeof currentStep.stepCode === "string"
              ? currentStep.stepCode
              : undefined;
          return {
            ...dashboard,
            stage: presentStage(stepCode, contact.locale),
          };
        },
        projectOnboarding: (contact, snapshot) =>
          onboarding.project(contact, snapshot),
      }),
  provider: whatsappProvider,
  ...(coachGenerator === undefined || accounts === undefined
    ? {}
    : {
        rewriteCoachReply: async ({
          contact,
          context,
          contextKind,
          draft,
          message,
        }) => {
          if (contact.userId === null) return draft.text;
          const account = await accounts.resolveByAppUser(contact.userId);
          if (account === null) return draft.text;
          return coachGenerator.generate({
            context,
            ...(contextKind === undefined ? {} : { contextKind }),
            draft,
            message,
            tier: account.tier,
            traceId: `whatsapp:${contact.id}`,
          });
        },
      }),
  store: whatsappStore,
  ...(accounts === undefined
    ? {}
    : {
        capabilitiesForContact: async (contact) => {
          if (contact.userId === null) {
            return { coachingMessagesPerDay: 12 };
          }
          const account = await accounts.resolveByAppUser(contact.userId);
          if (account === null) throw new Error("ACCOUNT_NOT_FOUND");
          return {
            coachingMessagesPerDay: account.capabilities.coachingMessagesPerDay,
          };
        },
      }),
  ...(accounts === undefined
    ? {}
    : {
        tierForContact: async (contact) => {
          if (contact.userId === null) return "freemium" as const;
          const account = await accounts.resolveByAppUser(contact.userId);
          if (account === null) throw new Error("ACCOUNT_NOT_FOUND");
          return account.tier;
        },
      }),
  ...(accounts === undefined || capabilityUsage === undefined
    ? {}
    : {
        consumeCoachingMessage: async (contact, limit) => {
          if (contact.userId === null || contact.householdId === null) {
            return whatsappStore.consumeDailyMessage(contact.id, limit);
          }
          const account = await accounts.resolveByAppUser(contact.userId);
          if (account === null) throw new Error("ACCOUNT_NOT_FOUND");
          return capabilityUsage.consumeCoachingMessage({
            actorUserId: contact.userId,
            householdId: contact.householdId,
            limit,
            timezone: account.timezone,
          });
        },
      }),
});
const whatsapp = new WhatsAppWebhookService(
  whatsappProvider,
  whatsappStore,
  process.env.WHATSAPP_ACCOUNT_LINK_URL ??
    "http://127.0.0.1:3000/app/account/link",
  async ({ contact, id, text }, traceId) => {
    const outbound = await conversation.handle(contact, text);
    await whatsappStore.saveOutbound(outbound, traceId);
    const context = await onboarding?.findByContact(contact.id);
    if (context === null || context === undefined) return;
    await coach.recordWhatsAppExchange({
      contactId: contact.id,
      inboundId: id,
      inboundText: text,
      outboundId: outbound.id,
      outboundText: outbound.text,
      scope: {
        actorUserId: contact.userId!,
        dogId: context.dogId,
        householdId: contact.householdId!,
        locale: contact.locale,
      },
      traceId,
    });
  },
);
const app = buildApp({
  ...(accounts === undefined ? {} : { accounts }),
  authenticator,
  ...(billing === undefined ? {} : { billing }),
  coach,
  ...(commands === undefined ? {} : { commands }),
  ...(capabilityUsage === undefined ? {} : { usage: capabilityUsage }),
  ...(onboardingRepository === undefined
    ? {}
    : { products: onboardingRepository }),
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
