# Responsible AI Readiness

- Status: engineering control baseline; legal classification pending
- Last reviewed: 2026-07-16

This document is evidence of engineering intent, not a legal opinion or a claim
that DogOS is certified under the EU AI Act or NIST.

## Product position

DogOS is intended as an AI-assisted dog-training and tracking product. It does
not diagnose animals, provide emergency services, make decisions about humans in
regulated high-risk areas, or replace a veterinarian or qualified trainer.
Production classification must be reviewed again when video, live coaching,
trainer marketplace, insurance, employment/working-dog assessment, or veterinary
features materially change the intended purpose.

## User transparency

- Tell a person at the start of WhatsApp onboarding that they are interacting
  with an AI-assisted DogOS coach.
- Keep the disclosure accessible in account and conversation information.
- Identify research-backed claims with user-visible source links.
- Distinguish owner reports, measurements, model suggestions, and confirmed
  system actions in storage and audit traces.
- Avoid claims of diagnosis, guaranteed outcomes, professional approval, or
  causal proof when the evidence is observational.

Article 50 of Regulation (EU) 2024/1689 requires providers of systems intended
to interact directly with natural persons to inform those persons that they are
interacting with AI unless that is obvious in context. The transparency rules
become applicable on 2 August 2026. DogOS implements the disclosure regardless
of whether an exception might later be argued because it is low-friction and
clear.

## NIST-style control record

### Govern

- named owner for each model, prompt, knowledge source, and protocol version;
- AI literacy and incident-response procedures before production access;
- supplier, data-processing, retention, and subprocessor review;
- change approval for model snapshots and decision-bearing knowledge.

### Map

- document intended use, users, affected dogs and people, foreseeable misuse,
  data categories, jurisdictions, and provider dependencies;
- keep an inventory of model-assisted features and authoritative tools;
- reassess scope before video, realtime, marketplace, or insurance releases.

### Measure

- run bilingual DogOS evals for accuracy, citation precision, hallucination,
  household isolation, injection resistance, latency, and cost;
- measure outcomes by goal dimension rather than a universal dog score;
- retain model snapshot, prompt version, context version, source IDs, token
  counts, latency, disclosure state, tool calls, and trace ID.

### Manage

- release only pinned model snapshots that pass the eval gate;
- roll back model or prompt versions independently;
- provide correction, deletion, account export, and professional handoff paths;
- investigate incidents without feeding personal case data into collective
  knowledge automatically.

## Minimal user-facing disclosures

Normal coaching should remain natural and concise. Show a persistent lightweight
AI identity once, citations when research claims are made, and a short contextual
note only when an observed issue materially affects the proposed exercise. Do
not repeat legal boilerplate in routine training messages.

## Records required before production model activation

1. Intended-purpose and AI Act classification memo reviewed by EU counsel.
2. Data protection assessment, retention schedule, and processor inventory.
3. Model card with benchmark cases, failure analysis, and approved snapshot.
4. Source and protocol review record from qualified dog professionals.
5. Incident, user correction, deletion, and rollback runbooks.
6. Real-phone acceptance evidence for disclosure and citation rendering.

## References

- [Regulation (EU) 2024/1689](https://eur-lex.europa.eu/eli/reg/2024/1689/oj?locale=en)
- [European Commission AI Act overview and timeline](https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai)
- [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework)
- [NIST Generative AI Profile, NIST AI 600-1](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf)
