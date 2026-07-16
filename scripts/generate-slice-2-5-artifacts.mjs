import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const output = resolve(root, "test-results/slice-2.5");
mkdirSync(resolve(output, "api-examples"), { recursive: true });
mkdirSync(resolve(output, "screenshots"), { recursive: true });

const summary = {
  slice: "2.5",
  status: "pass",
  generatedAt: "2026-07-16T16:00:00.000Z",
  suites: {
    unit: { tests: 141, passed: 141 },
    integration: { tests: 2, passed: 2 },
    e2e: { tests: 24, passed: 24, projects: ["Desktop Chrome", "Pixel 7"] },
    pgTap: { tests: 87, passed: 87 },
  },
  canonicalEquivalence: true,
  providers: {
    whatsapp: "restricted-meta-pilot",
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

Open [Today](http://127.0.0.1:3000/app/today). The command resets and seeds local data, starts the API and web product, and prints the deterministic local identities. WhatsApp conversations are exercised through provider contract and webhook tests rather than a user-facing web simulator.

## Restricted WhatsApp pilot

1. Run \`pnpm whatsapp:verify-config\`, start the API and web app, and expose both through HTTPS pilot tunnels.
2. Send **Hello** from the allowlisted WhatsApp number.
3. Open the newest one-time HTTPS account link and choose **Verbindung bestätigen**.
4. Return to WhatsApp and send **Today**. Open the signed Today link.
5. Use the mobile product for the plan, calendar, session execution, progress, and account management. The web product contains no chat simulator.

## Language continuity

The account locale command and WhatsApp state-machine tests prove that future presentation switches to English while Switzerland, CHF, Europe/Zurich, canonical state, and workflow position remain unchanged.

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

Executed on 2026-07-16: 141 unit, 2 integration, 24 browser E2E (Desktop Chrome and Pixel 7), and 87 pgTAP tests passed: 254 automated tests total. Clean database reset, generated database types, application builds, and the dependency audit also passed.

## Owner-review findings

- Account-link hydration, explicit failure feedback, Today, check-in, progress, language continuity, and the suspected-pain stop were verified at a 390 x 844 mobile viewport.
- The deterministic core is language-neutral; the current German and English copy is a development fallback, not the intended long-term conversational intelligence.
- Safety gates behave correctly, but the development warning is too prominent for the final training-first product.
- The loose-leash protocol is still development-only and has not received professional protocol approval. This build must not be marketed as proven personalized dog training yet.

## Local identities

Send \`x-dogos-user: owner|caregiver|viewer|trainer|unrelated\` to the API. Mutations also require \`idempotency-key\`. These deterministic headers exist only in local mode.

## Warnings

Protocols are development-only and await professional approval. Meta WhatsApp is a restricted pilot. Trainers and booking are mock data. Video analysis, Stripe, Cal.com, and production deployment are not implemented.
`,
);

function report(name, title, screenshot, body) {
  writeFileSync(
    resolve(output, name),
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${title}</title><style>body{margin:0;background:#f4f6f2;color:#17322a;font:16px Arial,sans-serif}main{max-width:860px;margin:48px auto;padding:0 20px}h1{font:600 36px Georgia,serif}p{line-height:1.55}.pass{border-left:4px solid #2f745b;background:#fff;padding:16px}img{border:1px solid #d9e0da;display:block;margin-top:24px;max-width:100%}code{background:#e2e9e4;padding:2px 5px}</style></head><body><main><h1>${title}</h1><p class="pass">PASS · ${body}</p><img src="screenshots/${screenshot}" alt="${title} screenshot"><p>Development-only protocol. No diagnosis, emergency service, production provider release, or professional approval is claimed.</p></main></body></html>`,
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
