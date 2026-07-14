# Knowledge Governance

- Status: proposed
- Last reviewed: 2026-07-14

DogOS stores reviewable claims, not an uncontrolled retrieval chatbot. A source
can inform a claim; a reviewed claim can inform a protocol; only an approved
protocol version can drive a production plan.

## 1. Source hierarchy

1. Veterinary behavior organizations and clinical guidelines.
2. Peer-reviewed studies, systematic reviews, and recognized ontologies.
3. Established animal-welfare organizations and official breed registries.
4. Qualified named professional reviewers with documented credentials.
5. Commercial/manufacturer material only as supplemental product information.

SEO pages, affiliate content, anonymous advice, and AI-generated breed/training
profiles cannot enter the decision-bearing knowledge base.

## 2. Claim lifecycle

```text
source discovered -> metadata/licence captured -> atomic claim extracted
-> evidence level assigned -> technical review -> professional review
-> approved for a defined use -> consumed by protocol version
-> periodic review -> reaffirmed, superseded, restricted, or withdrawn
```

An updated source never silently changes an active plan. A changed claim receives
a new version. Affected protocols are reviewed and versioned; existing plans
remain pinned until a migration is explicitly approved.

### Required claim fields

```json
{
  "claim_id": "reward_timing_001",
  "version": 1,
  "claim": "The reinforcer should follow the marked target behaviour promptly.",
  "source_type": "professional_guideline",
  "source_id": "avsab_humane_training_2021",
  "jurisdiction": "international",
  "evidence_level": "professional_consensus",
  "review_status": "pending_professional_review",
  "valid_from": "2026-07-14",
  "review_due": "2027-01-14",
  "allowed_uses": ["protocol_authoring"],
  "prohibited_uses": ["medical_diagnosis"]
}
```

## 3. Breed Knowledge Layer

Breed data is optional context. It never overrides individual history, health,
observed behavior, current environment, or actual training results.

### Canonical identity

- Use VBO as the machine-readable breed ID/synonym spine.
- Link FCI and national kennel-club references where applicable.
- Store recognition status and source version; do not imply that every dog or
  user-reported mix maps cleanly to a registry breed.
- Fully support `mixed`, `unknown`, and free-text pending normalization.
- Keep user certainty separate from canonical matching confidence.

### Allowed breed facts

- official names and aliases;
- broad size/body-build categories;
- historical working function as registry context;
- activity or management considerations supported by reviewed sources;
- physical constraints relevant to safe exercise, expressed as cautious context;
- development/maturation notes with evidence and review status.

### Prohibited breed inferences

- aggression, dominance, guilt, anxiety, trainability, or dangerousness labels;
- medical diagnosis or disease prediction for an individual;
- automatic protocol selection, exclusion, difficulty, or escalation based only
  on breed;
- invented facts for mixed or unknown breeds.

### Personalization precedence

```text
1 individual observed history
2 health and safety context
3 previous training results
4 current behavior and environment
5 age and development
6 motivation and available reinforcers
7 handler experience and feasibility
8 body build and reviewed physical constraints
9 breed context, with low decision weight
```

## 4. Training Knowledge Base

The initial product basis is reward-based, welfare-oriented training. AVSAB's
current public position recommends reward-based methods and rejects aversive
methods. DogOS adopts this as a product safety policy pending DACH professional
and legal review.

The product does not autonomously recommend shock/electronic collars, prong or
choke collars, physical punishment, flooding, alpha rolls, dominance
corrections, intentional strong fear exposure, or leash corrections as a
training standard.

Training knowledge is separated into:

- `source`: bibliographic and licensing truth;
- `claim`: one reviewable proposition;
- `protocol`: an executable training sequence using approved claims;
- `rule`: deterministic eligibility/progression/safety logic;
- `localized explanation`: user-facing wording with no new instruction.

Vector search may help an internal reviewer find sources. Retrieved text never
becomes an instruction or protocol automatically.

## 5. Protocol schema

Every protocol version must define:

| Section     | Required content                                                      |
| ----------- | --------------------------------------------------------------------- |
| Identity    | Stable ID, semantic version, title, goal family, risk class.          |
| Governance  | Author, reviewers, status, approval scope/date, review due, sources.  |
| Population  | Suitable users/dogs, prerequisites, exclusions, equipment.            |
| Baseline    | Metric, method, environment, minimum data quality.                    |
| Steps       | Ordered instructions, duration, repetitions, reinforcement and setup. |
| Difficulty  | Named parameters with allowed bounds and one-step change limits.      |
| Success     | Per-session and consecutive-session thresholds.                       |
| Progression | Exact predicates and allowed next action.                             |
| Regression  | Exact predicates and reduced-difficulty action.                       |
| Pause/stop  | Immediate and post-session conditions.                                |
| Escalation  | Trainer, veterinary, emergency, and unsupported-case routes.          |
| Claims      | Claim IDs used by each decision-bearing section.                      |

### Status model

```text
draft -> technical_review -> professional_review -> approved_development
-> approved_production -> suspended -> retired
```

Only `approved_production` plus non-expired jurisdiction approval is eligible in
production. The Phase 1 examples are `approved_development` at most.

## 6. Review roles

| Role                                    | May do                                               | May not do alone                                     |
| --------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------- |
| Content author                          | Draft claims and protocols                           | Approve own protocol for production.                 |
| Technical reviewer                      | Validate schema, determinism, citations, testability | Judge clinical/behavioral correctness.               |
| Qualified trainer/behavior professional | Review training content and escalation               | Change production code or evidence records silently. |
| Veterinary reviewer                     | Review pain/illness/medical escalation boundaries    | Convert observations into remote diagnoses.          |
| Product approver                        | Activate a fully reviewed version                    | Waive missing professional approval.                 |

## 7. Recurring review

- Sources and claims: review at least annually, sooner when source dates or legal
  changes require it.
- Safety rules and protocols: six-month default review window during MVP.
- Immediate review after a safety incident, material professional correction,
  provider policy change, or evidence contradiction.
- A scheduled job flags due items; it never auto-reapproves them.
- Every approval, rejection, supersession, suspension, and migration is audited.

## 8. Initial source register

Retrieved on 2026-07-14. `Reviewed` below means source metadata was technically
reviewed for architecture; it does not mean DogOS training content received
professional approval.

| Source                                                                                                                                            | Type                                      | Intended use                                        | Evidence/status                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------- |
| [AVSAB Humane Dog Training](https://avsab.org/resources/position-statements/)                                                                     | Veterinary behavior organization          | Reward-based policy and prohibited aversive methods | Professional consensus; professional localization review pending. |
| [AVSAB position PDF](https://avsab.org/wp-content/uploads/2021/08/AVSAB-Humane-Dog-Training-Position-Statement-2021.pdf)                          | Position statement with literature review | Claim extraction and bibliography discovery         | Professional consensus; claims not yet imported.                  |
| [AAHA behavior guidelines](https://www.aaha.org/resources/2015-aaha-canine-and-feline-behavior-management-guidelines/behavior-management-home-2/) | Veterinary clinical guideline             | Behavioral assessment and veterinary boundary       | Verified source; applicability review pending.                    |
| [AAHA pain guidance](https://www.aaha.org/resources/pain-management-for-pets/)                                                                    | Veterinary guidance                       | Sudden behavior/pain escalation                     | Verified source; not diagnostic logic.                            |
| [FCI breed nomenclature](https://fci.be/en/nomenclature/Default.aspx)                                                                             | Official registry                         | Breed names, groups, standards references           | Verified fact source; reuse rights pending.                       |
| [EMBL-EBI VBO](https://www.ebi.ac.uk/ols4/ontologies/vbo)                                                                                         | Scientific ontology, CC BY 4.0            | Canonical breed IDs and aliases                     | Verified fact source; attribution required.                       |
| [VBO publication](https://doi.org/10.1111/jvim.70133)                                                                                             | Peer-reviewed research                    | Ontology rationale and limitations                  | Scientific evidence.                                              |

## Related documents

- [Domain model](../architecture/domain-model.md)
- [Safety and escalation](../safety/safety-escalation.md)
- [Worked protocol and plan](../product/worked-plan.md)
