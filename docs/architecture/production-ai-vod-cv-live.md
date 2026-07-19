# Production AI, VOD, CV, And Live Coaching

- Status: provider-neutral policy and persistence foundation implemented; real
  Vertex VOD, local CV workers, and realtime dialogue providers remain gated
- Last reviewed: 2026-07-19

DogOS uses separate replaceable capabilities behind deterministic product
authority:

```text
ContextSnapshot
  -> task policy
  -> provider candidate output
  -> DogOS validation
  -> EvidenceItem / InterpretationCandidate / UIArtifact
  -> deterministic safety, plan, progress, and entitlement services
```

Models do not directly mutate canonical plans, safety state, measurements,
entitlements, retention, or professional escalation.

## Provider Roles

The active text path remains OpenAI Responses with structured outputs and
`store: false`. The policy registry maps tasks by purpose:

- fast extraction/routing: `gpt-5.6-luna`;
- owner coaching, plan/progress explanations and reports: `gpt-5.6-terra`;
- hard evaluation/escalation candidates: `gpt-5.6-sol`.

This follows OpenAI guidance to migrate GPT-5.6 by role instead of replacing
every route with Sol. The current OpenAI guide also notes that GPT-5.6 defaults
to medium reasoning, so DogOS does not enable extra reasoning, persisted
reasoning, explicit prompt caching, Pro mode, programmatic tool calling, or
multi-agent behavior until representative evals justify those changes.

VOD uses a two-level target architecture:

1. Global semantic pass: Gemini 3.5 Flash on Vertex AI is the evaluation target
   because it accepts video, audio, image, text and structured output with a
   large context window.
2. Precision pass: local CV over extracted event windows handles timing,
   geometry, handler posture and tracking evidence. Candidate stack:
   `ffprobe`/`ffmpeg`, MediaPipe Pose Landmarker, RTMDet, RTMPose, ByteTrack,
   and later a DogOS-specific dog model.

Live coaching stays conservative:

- LiveKit remains media transport.
- Gemini Live on Vertex is the production candidate for native audio/vision.
- OpenAI realtime remains a fallback/challenger.
- Live output is limited by cue rate, cooldown and post-session VOD review.

## Implemented Runtime Contracts

- `apps/api/src/ai/model-policy` defines task policies, model roles,
  release-manifest gates, preview-model blocking, and capability readiness.
- `apps/api/src/ai/*/provider.ts` defines DogOS-owned ports for text, VOD,
  realtime, ASR, moderation and CV.
- `/health/capabilities` reports `text`, `vod`, `live`, `cv`, `asr`,
  `moderation`, `embedding`, `knowledgeRelease`, and `policyVersion`.
- Coach requests persist a private immutable context snapshot before provider
  generation and model runs link to that snapshot.
- VOD configuration supports the new `DOGOS_VOD_*` env group. `google_vertex`
  is recognized as the target provider but remains not worker-ready until the
  Vertex adapter and media worker are implemented.
- `private.media_assets`, `private.media_analysis_runs`,
  `private.media_job_attempts`, `private.context_snapshots`,
  `private.evidence_items`, `private.interpretations`,
  `private.analysis_reports`, `private.live_events`, and
  `private.confidence_calibrations` provide the durable media/evidence model.

## Fail-Closed Rules

- Production-like environments require approved release manifests for configured
  provider capabilities.
- No in-repository synthetic fixture can satisfy production activation.
- Preview model IDs are rejected unless `DOGOS_AI_ALLOW_PREVIEW_MODELS=true`.
- Missing or unimplemented VOD/live/CV providers disable those capabilities
  without disabling normal Coach chat, plans, sessions or progress.
- Provider names, regions and credentials are validated by capability group.

## Official Documentation Used

- OpenAI GPT-5.6 migration and prompting guidance:
  `https://developers.openai.com/api/docs/guides/upgrading-to-gpt-5p6-sol.md`
  and `https://developers.openai.com/api/docs/guides/prompt-guidance-gpt-5p6.md`.
- OpenAI Responses and data controls:
  `https://developers.openai.com/api/reference/resources/responses/methods/create`
  and `https://developers.openai.com/api/docs/guides/your-data`.
- Gemini 3.5 Flash:
  `https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash`.
- Gemini Live / Vertex:
  `https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/live-api`.
- LiveKit Agents and realtime plugins:
  `https://docs.livekit.io/agents/`.
- Vercel AI SDK `ToolLoopAgent` and `UIMessage`:
  `https://ai-sdk.dev/docs/reference/ai-sdk-core/tool-loop-agent` and
  `https://ai-sdk.dev/docs/reference/ai-sdk-core/ui-message`.
- Supabase RLS, pgvector and hybrid search:
  `https://supabase.com/docs/guides/ai/rag-with-permissions`,
  `https://supabase.com/docs/guides/ai/hybrid-search`, and
  `https://supabase.com/docs/guides/database/extensions/pgvector`.
- CV/media stack:
  `https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker`,
  `https://ffmpeg.org/ffprobe.html`, `https://ffmpeg.org/ffmpeg.html`,
  `https://mmpose.readthedocs.io/`, and
  `https://github.com/open-mmlab/mmdetection`.
