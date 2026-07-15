# Engine Test Matrix

## Focused Suite

Run `pnpm test:engines`. The Slice 2.3 focused suite currently contains 66 tests across seven files.

| Area                    | Evidence                                                                                                                                        |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Contracts               | 14 tests for strict inputs, measurement unknown/zero/unit/range rules, provider isolation, mappers, and discriminated results                   |
| Development knowledge   | 7 tests covering all six protocol families and unapproved development metadata                                                                  |
| Safety                  | 12 tests covering every required development signal, fail-closed information, precedence, evidence, and determinism                             |
| Training                | 8 tests for prerequisites, exclusions, production gates, exact rules, deterministic schedules, unsupported/tied goals, and safety blocking      |
| Progress/adjustment     | 10 tests for ten dimensions, confidence, thresholds, food/recovery/trend regression, conflict, recency, and safety-first adjustment             |
| Observation/correlation | 5 tests for bounded observations, diagnostic rejection, group thresholds, evidence quality, caveats, and determinism                            |
| Cross-engine testing    | 10 tests for multilingual equivalence, locale/currency/jurisdiction invariance, breed safeguards, repeated runs, and fail-closed vertical flows |

## Required Cases

| Requirement                            | Covered by                                                  |
| -------------------------------------- | ----------------------------------------------------------- |
| Suspected pain and sudden change       | `safety.test.ts` veterinary routing                         |
| Child-involved bite                    | safety disposition and cross-engine plan block              |
| Missing bite history                   | safety and cross-engine fail-closed cases                   |
| Low-risk loose leash                   | multilingual vertical fixture                               |
| Known/mixed/unknown breed              | breed variant equivalence                                   |
| Breed does not create risk             | identical safety output across breed variants               |
| Explicit breed physical constraint     | eligibility block only through sourced constraint code      |
| Missing prerequisite                   | capability/baseline/equipment eligibility test              |
| Production rejects development content | production release-gate test                                |
| Unknown is not zero                    | contract measurement tests                                  |
| Three sessions below threshold         | stable progress plus repeat adjustment                      |
| Exact progression boundary             | 80 percent for exactly three sessions increases difficulty  |
| Food refusal and long recovery         | regression boundary tests at false and exactly 120 seconds  |
| Conflict and insufficient data         | low confidence/review and unavailable confidence cases      |
| Correlation minimum and causation      | suppressed small group and mandatory caveat tests           |
| Safety overrides progression           | progress and cross-engine adjustment tests                  |
| German/English equivalence             | paired `de-CH` and `en` fixtures produce equal full outputs |
| Locale/currency/jurisdiction           | 30 deterministic development permutations                   |
| Invalid canonical input                | Zod rejection tests across contract and observation suites  |

## Property and Mutation-Equivalent Coverage

No additional property or mutation framework was introduced. The risk did not justify another dependency for this slice. Equivalent targeted coverage includes:

- repeated execution of one complete canonical input 50 times;
- 30 locale, currency, and jurisdiction permutations;
- exact threshold mutations at 79/80 percent and 119/120 seconds;
- known zero versus explicit unknown contract cases;
- sorted evidence assertions and repeated correlation/plan evaluations;
- valid and invalid value/unit/percentage combinations;
- known, mixed, and unknown breed variants.

## Full Verification

```bash
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
pnpm demo:engines
```

The integration suite requires the local Supabase services configured in the repository. The demo report is generated at `test-results/slice-2.3/engine-demo.html` and its full canonical output at `test-results/slice-2.3/engine-demo.json`.

## Known Test Gaps

- Protocol content is structurally tested but not professionally validated.
- Correlation analysis supports canonical boolean exposure factors in this slice; richer continuous/categorical factor bucketing is deferred.
- No persistence round-trip test exists for engine decisions because the reason-code storage mismatch requires an approved Slice 2.4 schema decision.
- No localized safety wording is tested because presentation content is intentionally outside these engines.
- Mutation tooling is deferred; threshold-adjacent tests cover the highest-risk mutations without adding tooling.
