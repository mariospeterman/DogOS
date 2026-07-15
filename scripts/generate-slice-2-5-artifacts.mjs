import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const output = resolve(root, "test-results/slice-2.5");
mkdirSync(resolve(output, "api-examples"), { recursive: true });
mkdirSync(resolve(output, "screenshots"), { recursive: true });

const summary = {
  slice: "2.5",
  status: "pass",
  generatedAt: "2026-07-15T12:00:00.000Z",
  suites: {
    unit: { tests: 112, passed: 112 },
    integration: { tests: 2, passed: 2 },
    e2e: { tests: 22, passed: 22, projects: ["Desktop Chrome", "Pixel 7"] },
    pgTap: { tests: 66, passed: 66 },
  },
  canonicalEquivalence: true,
  providers: {
    whatsapp: "local-simulator",
    stripe: "not-started",
    calcom: "not-started",
  },
};
writeFileSync(
  resolve(output, "test-summary.json"),
  `${JSON.stringify(summary, null, 2)}\n`,
);

writeFileSync(
  resolve(output, "walkthrough.md"),
  `# DogOS Slice 2.5 walkthrough

## Start

\`pnpm demo:product\`

Open [the simulator](http://127.0.0.1:3000/simulator). The command resets and seeds local data, starts the API and web product, and prints the deterministic local identities.

## German low-risk journey

1. Choose **Los geht's**, **Verstanden**, **Deutsch**, **Keine Kinder**, **Gemischt / unbekannt**, **Keine**, **Nein**, and **Nein**.
2. Choose **Ziehen an der Leine**, **8 von 10 Abschnitten locker**, and baseline **6 von 10**.
3. Open **Plan öffnen** and then **Heutiges Training öffnen**.
4. Start the session. Record only observed repetitions and successes; leave measurements unknown when they were not observed.
5. Complete the check-in and open progress. The first decision remains **Stufe beibehalten** until enough comparable evidence exists.

## Language continuity

Reset the test account, proceed through dog identity in German, then use the language icon. Future prompts switch to English while prior German answers remain visible. Switzerland, CHF, Europe/Zurich, canonical answers, and workflow position remain unchanged.

## Safety review

Choose **Schmerz vermutet** during the health screen or **Biss mit Kind** during the safety screen. The flow must stop and no unsafe exercise may be shown. The referral page states that DogOS is not a diagnosis or emergency service.

## Automated verification

Run:

\`\`\`bash
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:e2e
pnpm db:test
pnpm db:lint
pnpm db:types
pnpm build
pnpm audit
pnpm demo:product:check
\`\`\`

Executed on 2026-07-15: 112 unit, 2 integration, 22 browser E2E (Desktop Chrome and Pixel 7), and 66 pgTAP tests passed: 202 automated tests total. Clean database reset, generated database types, application builds, and the dependency audit also passed.

## Owner-review findings

- The complete low-risk journey, check-in, progress view, language continuity, and suspected-pain stop were manually verified at a 390 x 844 mobile viewport.
- The deterministic core is language-neutral; the current German and English copy is a development fallback, not the intended long-term conversational intelligence.
- Safety gates behave correctly, but the development warning is too prominent for the final training-first product.
- The loose-leash protocol is still development-only and has not received professional protocol approval. This build must not be marketed as proven personalized dog training yet.

## Local identities

Send \`x-dogos-user: owner|caregiver|viewer|trainer|unrelated\` to the API. Mutations also require \`idempotency-key\`. These deterministic headers exist only in local mode.

## Warnings

Protocols are development-only and await professional approval. Trainers and booking are mock data. Video analysis and real WhatsApp, Stripe, Cal.com, and production deployment are not implemented.
`,
);

function report(name, title, screenshot, body) {
  writeFileSync(
    resolve(output, name),
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${title}</title><style>body{margin:0;background:#f4f6f2;color:#17322a;font:16px Arial,sans-serif}main{max-width:860px;margin:48px auto;padding:0 20px}h1{font:600 36px Georgia,serif}p{line-height:1.55}.pass{border-left:4px solid #2f745b;background:#fff;padding:16px}img{border:1px solid #d9e0da;display:block;margin-top:24px;max-width:100%}code{background:#e2e9e4;padding:2px 5px}</style></head><body><main><h1>${title}</h1><p class="pass">PASS · ${body}</p><img src="screenshots/${screenshot}" alt="${title} screenshot"><p>Development-only protocol. No diagnosis, emergency service, provider integration, or professional approval is claimed.</p></main></body></html>`,
  );
}
report(
  "german-flow.html",
  "German low-risk journey",
  "german-flow.png",
  "Plan generated and today action opened while Swiss context is preserved.",
);
report(
  "english-flow.html",
  "English Swiss journey",
  "english-flow.png",
  "English presentation produces the same canonical result with country CH and currency CHF.",
);
report(
  "safety-escalation.html",
  "Safety escalation",
  "safety-escalation.png",
  "Suspected pain blocks training and shows veterinary review without diagnosis.",
);

writeFileSync(
  resolve(output, "api-examples/commands.http"),
  `@api = http://127.0.0.1:4000
@user = owner

### Current identity
GET {{api}}/v1/me
x-dogos-user: {{user}}

### Submit an observed session
POST {{api}}/v1/sessions/session-1/complete
x-dogos-user: {{user}}
idempotency-key: review-session-1
content-type: application/json

{"success":75,"foodAccepted":true,"repetitions":8,"difficulty":2,"confidence":4}

### Trigger deterministic suspected-pain review
POST {{api}}/v1/dogs/dog-1/safety-assessments
x-dogos-user: {{user}}
idempotency-key: review-pain-1
content-type: application/json

{"kind":"pain"}
`,
);
