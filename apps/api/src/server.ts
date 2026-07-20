import { loadApiEnv } from "@dogos/config/api";
import { loadDogosReleaseConfig } from "@dogos/config/features";
import {
  CoachConversationService,
  InMemoryCoachConversationStore,
  PostgresCoachConversationStore,
} from "@dogos/conversation";
import {
  AccountRepository,
  BillingRepository,
  CapabilityUsageRepository,
  CollaborationRepository,
  ContextSnapshotRepository,
  LiveCoachingRepository,
  MemoryRepository,
  ModelRunRepository,
  OnboardingRepository,
  OnboardingSessionRepository,
  PartnerMarketplaceRepository,
  PostgresRepository,
  ProfessionalHandoffRepository,
  PrivacyRepository,
  SearchRepository,
  VideoAnalysisRepository,
} from "@dogos/database";

import { loadDogosAiConfig } from "./ai/model-policy/config.js";
import { buildApp } from "./app.js";
import { createRequestAuthenticator } from "./auth.js";
import { loadStripeBillingConfig, StripeBillingService } from "./billing.js";
import {
  loadCoachModelConfig,
  OpenAICoachReplyGenerator,
  OpenAIOnboardingInterpreter,
} from "./llm.js";
import { loadLiveKitConfig } from "./livekit.js";
import { OnboardingService } from "./onboarding-service.js";
import { SignedActionService } from "./signed-actions.js";
import {
  loadSupabaseStorageConfig,
  SupabaseFfmpegVideoObjectInspector,
  SupabaseVideoUploadSigner,
} from "./storage.js";
import {
  createVideoAnalysisProvider,
  loadVideoAnalysisConfig,
  VideoAnalysisWorker,
} from "./video-analysis.js";
import { WebOnboardingService } from "./web-onboarding-service.js";

const environment = loadApiEnv(process.env);
const release = loadDogosReleaseConfig(process.env);
const aiConfig = loadDogosAiConfig(process.env);
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
const collaboration = environment.DATABASE_URL
  ? new CollaborationRepository(environment.DATABASE_URL)
  : undefined;
const videos = environment.DATABASE_URL
  ? new VideoAnalysisRepository(environment.DATABASE_URL)
  : undefined;
const liveSessions = environment.DATABASE_URL
  ? new LiveCoachingRepository(environment.DATABASE_URL)
  : undefined;
const memories = environment.DATABASE_URL
  ? new MemoryRepository(environment.DATABASE_URL)
  : undefined;
const privacy = environment.DATABASE_URL
  ? new PrivacyRepository(environment.DATABASE_URL)
  : undefined;
const marketplace = environment.DATABASE_URL
  ? new PartnerMarketplaceRepository(environment.DATABASE_URL)
  : undefined;
const professionalHandoffs = environment.DATABASE_URL
  ? new ProfessionalHandoffRepository(environment.DATABASE_URL)
  : undefined;
const search = environment.DATABASE_URL
  ? new SearchRepository(environment.DATABASE_URL)
  : undefined;
const liveKit = release.features.live ? loadLiveKitConfig(process.env) : null;
const storageConfig = loadSupabaseStorageConfig(process.env);
const videoUploads =
  storageConfig === null
    ? undefined
    : new SupabaseVideoUploadSigner(storageConfig);
const videoAnalysisConfig = loadVideoAnalysisConfig(process.env);
const videoAnalysisProvider =
  videoAnalysisConfig === null
    ? undefined
    : createVideoAnalysisProvider({
        ...(process.env.OPENAI_API_KEY === undefined
          ? {}
          : { apiKey: process.env.OPENAI_API_KEY }),
        ...(process.env.OPENAI_BASE_URL === undefined
          ? {}
          : { baseUrl: process.env.OPENAI_BASE_URL }),
        config: videoAnalysisConfig,
      });
const videoAnalysisWorker =
  videos !== undefined &&
  storageConfig !== null &&
  videoAnalysisConfig !== null &&
  videoAnalysisProvider !== undefined &&
  process.env.DOGOS_VIDEO_WORKER_ENABLED === "1" &&
  process.env.DOGOS_VIDEO_OBJECT_READER === "supabase" &&
  process.env.DOGOS_VIDEO_FRAME_EXTRACTOR === "ffmpeg"
    ? new VideoAnalysisWorker({
        config: videoAnalysisConfig,
        inspector: new SupabaseFfmpegVideoObjectInspector(storageConfig, {
          ...(process.env.FFMPEG_PATH === undefined
            ? {}
            : { ffmpegPath: process.env.FFMPEG_PATH }),
          ...(process.env.FFPROBE_PATH === undefined
            ? {}
            : { ffprobePath: process.env.FFPROBE_PATH }),
        }),
        provider: videoAnalysisProvider,
        store: videos,
      })
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
const contextSnapshots = environment.DATABASE_URL
  ? new ContextSnapshotRepository(environment.DATABASE_URL)
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
    : new OnboardingService(onboardingRepository, release.pilotGoalFamily);
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
const webOnboarding =
  onboarding === undefined || onboardingSessions === undefined
    ? undefined
    : new WebOnboardingService({
        activateConversation: async (input) => {
          await coach.importHistory({
            messages: input.messages,
            scope: {
              actorUserId: input.actorUserId,
              dogId: input.dogId,
              householdId: input.householdId,
              locale: input.locale,
            },
            traceId: `onboarding:${input.actorUserId}`,
          });
        },
        ...(onboardingInterpreter === undefined
          ? {}
          : {
              interpret: (input) => onboardingInterpreter.interpret(input),
            }),
        projector: onboarding,
        sessions: onboardingSessions,
      });
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
  ...(contextSnapshots === undefined ? {} : { contextSnapshots }),
  ...(capabilityUsage === undefined ? {} : { usage: capabilityUsage }),
  ...(collaboration === undefined ? {} : { collaboration }),
  ...(videos === undefined ? {} : { videos }),
  ...(videoAnalysisWorker === undefined ? {} : { videoAnalysisWorker }),
  ...(videoUploads === undefined ? {} : { videoUploads }),
  ...(liveSessions === undefined ? {} : { liveSessions }),
  ...(memories === undefined ? {} : { memories }),
  ...(marketplace === undefined ? {} : { marketplace }),
  features: release.features,
  ...(professionalHandoffs === undefined ? {} : { professionalHandoffs }),
  ...(privacy === undefined ? {} : { privacy }),
  ...(search === undefined ? {} : { search }),
  ...(liveKit === null ? {} : { liveKit }),
  ...(onboardingRepository === undefined
    ? {}
    : { products: onboardingRepository }),
  readiness: {
    ai: aiConfig.readiness,
    database: environment.DATABASE_URL !== undefined,
    liveKit: liveKit !== null,
    openAI: coachModelConfig !== null,
    stripe: stripeConfig !== null,
    supabaseStorage: storageConfig !== null,
    workers: videoAnalysisWorker !== undefined,
  },
  signedActions,
});

try {
  await app.listen({ host: environment.API_HOST, port: environment.API_PORT });
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
}
