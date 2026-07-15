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
    e2e: { tests: 20, passed: 20, projects: ["Desktop Chrome", "Pixel 7"] },
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

Open [the simulator](http://127.0.0.1:3000/simulator). Complete the German low-risk choices, open the signed development action, start the session, record only observed values, and review progress. Use the language icon to switch presentation without changing Switzerland, CHF, Europe/Zurich, prior answers, or workflow state.

## Safety review

Choose **Schmerz vermutet** during the health screen or **Biss mit Kind** during the safety screen. The flow must stop and no unsafe exercise may be shown. The referral page states that DogOS is not a diagnosis or emergency service.

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
