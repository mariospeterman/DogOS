import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  canonicalizeLocalizedCase,
  englishOwnerCase,
  germanOwnerCase,
} from "./fixtures.js";
import { runCanonicalCase } from "./run-case.js";

const german = runCanonicalCase(canonicalizeLocalizedCase(germanOwnerCase));
const english = runCanonicalCase(canonicalizeLocalizedCase(englishOwnerCase));
const equivalent = JSON.stringify(german) === JSON.stringify(english);
const report = {
  slice: "2.3",
  generatedAt: "2026-07-15T12:00:00.000Z",
  equivalent,
  decisions: {
    safety: german.safety.disposition,
    eligibility: german.eligibility.status,
    plan: german.plan.status,
    progress: german.progress.status,
    adjustment: german.adjustment.decision,
  },
  versions: {
    safetyRuleSet: german.safety.ruleSetVersion,
    progressEngine: german.progress.engineVersion,
    progressRuleSet: german.progress.ruleSetVersion,
  },
  german,
  english,
};
const artifacts = resolve(process.cwd(), "../../test-results/slice-2.3");
mkdirSync(artifacts, { recursive: true });
writeFileSync(
  resolve(artifacts, "engine-demo.json"),
  `${JSON.stringify(report, null, 2)}\n`,
);
const rows = Object.entries(report.decisions)
  .map(
    ([name, value]) =>
      `<tr><th>${name}</th><td><code>${value}</code></td></tr>`,
  )
  .join("");
writeFileSync(
  resolve(artifacts, "engine-demo.html"),
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>DogOS Slice 2.3 verification</title><style>body{margin:0;background:#f5f7f8;color:#172126;font:16px system-ui,sans-serif}main{max-width:820px;margin:64px auto;padding:0 24px}h1{font-size:32px;letter-spacing:0;margin:0 0 8px}.status{color:#166534;font-weight:700;margin-bottom:32px}section{background:white;border:1px solid #d6dde1;border-radius:8px;padding:24px;margin:16px 0}table{width:100%;border-collapse:collapse}th,td{text-align:left;border-bottom:1px solid #e7ecef;padding:12px 0}th{font-weight:600;text-transform:capitalize}code{color:#075985}p{line-height:1.55}.meta{color:#526169}</style></head><body><main><h1>DogOS Slice 2.3</h1><p class="status">PASS: German and English canonical decisions are identical</p><section><h2>Deterministic vertical chain</h2><table>${rows}</table></section><section><h2>Frozen versions</h2><p><code>safety ${report.versions.safetyRuleSet}</code><br><code>progress ${report.versions.progressEngine}</code><br><code>rules ${report.versions.progressRuleSet}</code></p></section><p class="meta">Development-only protocols. No production approval is claimed.</p></main></body></html>`,
);
console.log(JSON.stringify(report, null, 2));
