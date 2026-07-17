import postgres, { type Sql } from "postgres";
import type { Plan, RiskAssessment } from "@dogos/contracts";
import { riskAssessmentToPersistenceDTO } from "./mappers.js";

export interface OnboardingFacts {
  ageBand: "adult" | "puppy" | "senior" | "unknown";
  baselineSuccessRate: number;
  behaviorConcernCode: string;
  behaviorConcernDescription: string | null;
  dogName: string;
  dogProfileSummary: string | null;
  equipmentCodes: string[];
  goalCode: string;
  goalText: string;
  householdSize: "multiple" | "single" | "unknown";
  locale: string;
  safetyEvent: "bite_child" | "none" | "snap";
  suspectedPain: boolean;
}

export interface OnboardingIds {
  anamnesisId: string;
  baselineMeasurementId: string;
  behaviorConcernId: string;
  dogId: string;
  goalId: string;
  goalVersionId: string;
  healthContextId: string;
  planId: string;
  riskAssessmentId: string;
  safetyEventId: string | null;
}

export interface PersistOnboardingInput {
  actorUserId: string;
  contactId: string;
  facts: OnboardingFacts;
  householdId: string;
  ids: OnboardingIds;
  plan: Plan | null;
  riskAssessment: RiskAssessment;
  snapshotHash: string;
}

export interface DogProductContext {
  baselineSuccessRate: number;
  behaviorConcernDescription?: string;
  dogId: string;
  dogName: string;
  dogProfileSummary?: string;
  goal: string;
  latestDecision: string;
  planId: string | null;
  planStatus: "active" | "blocked" | "setup_required";
  riskDisposition: RiskAssessment["disposition"];
  sessionCount: number;
  targetSuccessRate?: number;
  requiredConsecutiveSessions?: number;
  todaySessionId: string | null;
}

export interface ProductScheduleEntry {
  durationSeconds: number;
  id: string;
  isRecovery: boolean;
  plannedStart: string;
  purposeCode: string;
  status: string;
}

export interface ProductDashboard extends DogProductContext {
  calendar: ProductScheduleEntry[];
  currentStep: {
    difficulty: number;
    durationSeconds: number;
    repetitions: number;
    stepCode: string;
    stopConditionCodes: string[];
  } | null;
  goalText: string;
}

interface TransactionQuery {
  (
    template: TemplateStringsArray,
    ...parameters: unknown[]
  ): Promise<Array<Record<string, unknown>>>;
  json(value: unknown): unknown;
}

async function persistPlan(
  tx: TransactionQuery,
  plan: Plan,
  planId: string,
  dogId: string,
  goalVersionId: string,
): Promise<void> {
  const version = plan.activeVersion;
  await tx`
    insert into api.plans (id, dog_id, goal_version_id, status)
    values (${planId}, ${dogId}, ${goalVersionId}, 'draft')
  `;
  const [planVersion] = await tx`
    insert into api.plan_versions
      (plan_id, version, protocol_version_id, rule_set_id,
       generation_reason_codes, generation_mode, status)
    values (${planId}, ${version.version}, ${version.protocolVersionId},
      ${version.ruleSetId}, ${version.generationReasonCodes},
      ${version.generationMode}, 'prepared')
    returning id
  `;
  const planVersionId = String(planVersion!.id);
  const stepIds = new Map<string, string>();
  for (const step of version.steps) {
    const [storedStep] = await tx`
      insert into api.plan_steps
        (plan_version_id, protocol_step_code, sequence_number,
         difficulty_parameters, repetitions, duration_seconds,
         stop_condition_codes)
      values (${planVersionId}, ${step.stepCode}, ${step.sequence},
        ${tx.json({ level: step.difficulty })}, ${step.repetitions},
        ${step.durationSeconds}, ${step.stopConditionCodes})
      returning id
    `;
    stepIds.set(step.stepCode, String(storedStep!.id));
  }
  for (const session of version.scheduledSessions) {
    await tx`
      insert into api.scheduled_sessions
        (plan_step_id, planned_start, duration_seconds, purpose_code,
         is_recovery, is_review, status)
      values (${stepIds.get(session.stepCode)!}, ${session.plannedStart},
        ${session.durationSeconds}, ${session.purposeCode},
        ${session.recoveryDay}, ${session.observationOnly}, 'planned')
    `;
  }
  await tx`select private.activate_plan_version(${planId}, ${planVersionId}, null)`;
}

const questionCodes = [
  "question.household_composition",
  "question.dog_name",
  "question.dog_age_band",
  "question.health_change",
  "question.recent_safety_event",
  "question.behavior_concern",
  "question.training_goal",
  "question.training_setup",
  "question.baseline_success",
] as const;

export class OnboardingRepository {
  readonly #sql: Sql;

  constructor(connectionString: string) {
    this.#sql = postgres(connectionString, { max: 5, prepare: false });
  }

  async close(): Promise<void> {
    await this.#sql.end();
  }

  async findByContact(contactId: string): Promise<DogProductContext | null> {
    const rows = await this.#sql`
      select op.dog_id::text
      from private.onboarding_projections op
      where op.contact_id = ${contactId}::uuid
    `;
    const dogId = rows[0]?.dog_id;
    return typeof dogId === "string" ? this.findByDog(dogId) : null;
  }

  async findPrimaryByHousehold(
    householdId: string,
  ): Promise<ProductDashboard | null> {
    const [projection] = await this.#sql`
      select op.dog_id::text
      from private.onboarding_projections op
      join private.whatsapp_provider_contacts contact on contact.id = op.contact_id
      where contact.household_id = ${householdId}::uuid
      order by op.updated_at desc
      limit 1
    `;
    return typeof projection?.dog_id === "string"
      ? this.dashboardByDog(String(projection.dog_id), householdId)
      : null;
  }

  async dashboardByDog(
    dogId: string,
    householdId: string,
  ): Promise<ProductDashboard | null> {
    const context = await this.findByDog(dogId, householdId);
    if (context === null) return null;
    const [goal] = await this.#sql`
      select g.owner_goal_text
      from private.onboarding_projections op
      join api.goals g on g.id = op.goal_id
      where op.dog_id = ${dogId}::uuid
    `;
    const steps = await this.#sql`
      select
        ps.protocol_step_code::text,
        ps.duration_seconds,
        ps.repetitions,
        ps.difficulty_parameters,
        ps.stop_condition_codes::text[]
      from api.plans p
      join api.plan_versions pv on pv.id = p.active_plan_version_id
      join api.plan_steps ps on ps.plan_version_id = pv.id
      where p.dog_id = ${dogId}::uuid
      order by ps.sequence_number
      limit 1
    `;
    const schedule = await this.#sql`
      select
        ss.id::text,
        ss.planned_start::text,
        ss.duration_seconds,
        ss.purpose_code::text,
        ss.is_recovery,
        ss.status
      from api.plans p
      join api.plan_versions pv on pv.id = p.active_plan_version_id
      join api.plan_steps ps on ps.plan_version_id = pv.id
      join api.scheduled_sessions ss on ss.plan_step_id = ps.id
      where p.dog_id = ${dogId}::uuid
      order by ss.planned_start
    `;
    const step = steps[0];
    const difficultyParameters = step?.difficulty_parameters;
    return {
      ...context,
      calendar: schedule.map((entry) => ({
        durationSeconds: Number(entry.duration_seconds),
        id: String(entry.id),
        isRecovery: Boolean(entry.is_recovery),
        plannedStart: String(entry.planned_start),
        purposeCode: String(entry.purpose_code),
        status: String(entry.status),
      })),
      currentStep:
        step === undefined
          ? null
          : {
              difficulty:
                typeof difficultyParameters === "object" &&
                difficultyParameters !== null &&
                "level" in difficultyParameters
                  ? Number(
                      (difficultyParameters as Record<string, unknown>).level,
                    )
                  : 1,
              durationSeconds: Number(step.duration_seconds),
              repetitions: Number(step.repetitions),
              stepCode: String(step.protocol_step_code),
              stopConditionCodes: Array.isArray(step.stop_condition_codes)
                ? step.stop_condition_codes.map(String)
                : [],
            },
      goalText: String(goal?.owner_goal_text ?? context.goal),
    };
  }

  async findByDog(
    dogId: string,
    householdId?: string,
  ): Promise<DogProductContext | null> {
    const rows = await this.#sql`
      select
        d.id::text as dog_id,
        d.name as dog_name,
        g.canonical_goal_type::text as goal,
        (
          select dh.training_history->0->>'ownerSummary'
          from api.dog_history dh
          where dh.dog_id = d.id
          order by dh.created_at desc
          limit 1
        ) as dog_profile_summary,
        (
          select bc.context->>'ownerDescription'
          from api.behavior_concerns bc
          where bc.dog_id = d.id
          order by bc.created_at desc
          limit 1
        ) as behavior_concern_description,
        gm.value_numeric::float8 as baseline_success_rate,
        gv.target_definition,
        gv.success_criteria,
        p.id::text as plan_id,
        coalesce(p.status, 'draft') as plan_status,
        ra.disposition_code::text as disposition,
        (select count(*)::integer from api.sessions s where s.dog_id = d.id) as session_count,
        (
          select ss.id::text
          from api.scheduled_sessions ss
          join api.plan_steps ps on ps.id = ss.plan_step_id
          join api.plan_versions pv on pv.id = ps.plan_version_id
          where pv.id = p.active_plan_version_id
            and ss.status = 'planned'
          order by ss.planned_start
          limit 1
        ) as today_session_id
      from private.onboarding_projections op
      join api.dogs d on d.id = op.dog_id
      join api.goals g on g.id = op.goal_id
      join api.goal_versions gv on gv.goal_id = g.id and gv.version = 1
      join api.goal_measurements gm on gm.goal_version_id = gv.id
        and gm.metric_code = 'metric.success_rate'
      join api.risk_assessments ra on ra.id = op.risk_assessment_id
      left join api.plans p on p.id = op.plan_id
      where d.id = ${dogId}::uuid
        ${
          householdId === undefined
            ? this.#sql``
            : this.#sql`and d.household_id = ${householdId}::uuid`
        }
      limit 1
    `;
    const row = rows[0];
    if (row === undefined) return null;
    const disposition = String(row.disposition).replace(
      "disposition.",
      "",
    ) as RiskAssessment["disposition"];
    const target = row.target_definition as Record<string, unknown>;
    const successCriteria = row.success_criteria as Record<string, unknown>;
    return {
      baselineSuccessRate: Number(row.baseline_success_rate),
      ...(typeof row.behavior_concern_description === "string" &&
      row.behavior_concern_description.length > 0
        ? { behaviorConcernDescription: row.behavior_concern_description }
        : {}),
      dogId: String(row.dog_id),
      dogName: String(row.dog_name),
      ...(typeof row.dog_profile_summary === "string" &&
      row.dog_profile_summary.length > 0
        ? { dogProfileSummary: row.dog_profile_summary }
        : {}),
      goal: String(row.goal),
      latestDecision: "repeat_step",
      planId: row.plan_id === null ? null : String(row.plan_id),
      planStatus:
        row.plan_id !== null
          ? "active"
          : disposition === "continue_low_risk_training"
            ? "setup_required"
            : "blocked",
      riskDisposition: disposition,
      requiredConsecutiveSessions: Number(
        successCriteria.consecutiveSessions ?? 3,
      ),
      sessionCount: Number(row.session_count),
      targetSuccessRate: Number(target.successRate ?? 80),
      todaySessionId:
        row.today_session_id === null ? null : String(row.today_session_id),
    };
  }

  async persist(input: PersistOnboardingInput): Promise<DogProductContext> {
    let projectedDogId = input.ids.dogId;
    await this.#sql.begin(
      "isolation level serializable",
      async (transaction) => {
        const tx = transaction as unknown as TransactionQuery;
        const existing = await tx`
        select dog_id, anamnesis_id, goal_id, plan_id
        from private.onboarding_projections
        where contact_id = ${input.contactId}::uuid
        for update
      `;
        const projection = existing[0];
        if (projection !== undefined) {
          projectedDogId = String(projection.dog_id);
          if (projection.plan_id !== null || input.plan === null) return;
          const [goalVersion] = await tx`
            select id::text
            from api.goal_versions
            where goal_id = ${projection.goal_id}::uuid and version = 1
          `;
          if (goalVersion === undefined) {
            throw new Error("ONBOARDING_GOAL_VERSION_MISSING");
          }
          await persistPlan(
            tx,
            input.plan,
            input.ids.planId,
            projectedDogId,
            String(goalVersion.id),
          );
          await tx`
            update api.anamnesis_answers aa
            set answer_value = ${tx.json(input.facts.equipmentCodes)}
            from api.question_definitions qd
            where aa.question_definition_id = qd.id
              and aa.anamnesis_id = ${projection.anamnesis_id}::uuid
              and qd.question_code = 'question.training_setup'
          `;
          await tx`
            update private.onboarding_projections
            set plan_id = ${input.ids.planId}, snapshot_hash = ${input.snapshotHash},
                updated_at = now()
            where contact_id = ${input.contactId}::uuid
          `;
          await tx`
            insert into private.audit_events
              (actor_user_id, actor_type, action, target_type, target_id,
               trace_id, metadata)
            values (${input.actorUserId}, 'user', 'onboarding.plan_reconciled',
              'dog', ${projectedDogId}, ${input.snapshotHash},
              ${tx.json({ channel: "whatsapp", reason: "setup_reconciled" })})
          `;
          return;
        }
        const questions = await tx`
        select id::text, question_code::text
        from api.question_definitions
        where question_code = any(${questionCodes}::api.canonical_code[])
          and version = 1 and validity_state = 'valid'
      `;
        const questionIds = new Map(
          questions.map((row) => [String(row.question_code), String(row.id)]),
        );
        if (questionIds.size !== questionCodes.length) {
          throw new Error("ONBOARDING_QUESTIONS_INCOMPLETE");
        }

        await tx`
        insert into api.dogs
          (id, household_id, name, size_category, breed_status, created_by)
        values (${input.ids.dogId}, ${input.householdId}, ${input.facts.dogName},
          'unknown', 'unknown', ${input.actorUserId})
      `;
        await tx`
        insert into api.dog_health_context
          (id, dog_id, suspected_pain, sudden_behavior_change, source)
        values (${input.ids.healthContextId}, ${input.ids.dogId},
          ${input.facts.suspectedPain}, ${input.facts.suspectedPain}, 'owner_report')
      `;
        await tx`
        insert into api.dog_history
          (dog_id, training_history, source)
        values (${input.ids.dogId}, ${tx.json(
          input.facts.dogProfileSummary === null
            ? []
            : [{ ownerSummary: input.facts.dogProfileSummary }],
        )}, 'owner_report')
      `;
        await tx`
        insert into api.household_context (household_id, adults_count)
        values (${input.householdId}, ${
          input.facts.householdSize === "single"
            ? 1
            : input.facts.householdSize === "multiple"
              ? 2
              : null
        })
        on conflict (household_id) do nothing
      `;
        await tx`
        insert into api.anamneses
          (id, dog_id, version, status, completeness, quality_status, completed_at, created_by)
        values (${input.ids.anamnesisId}, ${input.ids.dogId}, 1, 'completed', 1,
          'structured_owner_report', now(), ${input.actorUserId})
      `;
        const answers: Array<[string, unknown]> = [
          ["question.household_composition", input.facts.householdSize],
          ["question.dog_name", input.facts.dogName],
          ["question.dog_age_band", input.facts.ageBand],
          ["question.health_change", input.facts.suspectedPain],
          ["question.recent_safety_event", input.facts.safetyEvent],
          ["question.behavior_concern", input.facts.behaviorConcernCode],
          ["question.training_goal", input.facts.goalCode],
          ["question.training_setup", input.facts.equipmentCodes],
          ["question.baseline_success", input.facts.baselineSuccessRate],
        ];
        for (const [code, value] of answers) {
          await tx`
          insert into api.anamnesis_answers
            (anamnesis_id, question_definition_id, raw_answer_locale,
             answer_value, source, collected_channel)
          values (${input.ids.anamnesisId}, ${questionIds.get(code)!},
            ${input.facts.locale}, ${tx.json(value)}, 'owner_report', 'whatsapp')
        `;
        }
        await tx`
        insert into api.behavior_concerns
          (id, dog_id, anamnesis_id, concern_code, context, source)
        values (${input.ids.behaviorConcernId}, ${input.ids.dogId},
          ${input.ids.anamnesisId}, ${input.facts.behaviorConcernCode},
          ${tx.json({ ownerDescription: input.facts.behaviorConcernDescription })},
          'owner_report')
      `;
        if (input.ids.safetyEventId !== null) {
          await tx`
          insert into api.safety_events
            (id, dog_id, behavior_concern_id, event_code, recency_code,
             severity, source, review_status)
          values (${input.ids.safetyEventId}, ${input.ids.dogId},
            ${input.ids.behaviorConcernId}, ${
              input.facts.safetyEvent === "snap"
                ? "safety.snap"
                : "safety.child_involved"
            }, 'recency.recent', ${input.facts.safetyEvent === "snap" ? 2 : 5},
            'owner_report', 'unreviewed')
        `;
        }
        await tx`
        insert into api.goals
          (id, dog_id, owner_user_id, owner_goal_text, owner_goal_locale,
           canonical_goal_type, priority, status)
        values (${input.ids.goalId}, ${input.ids.dogId}, ${input.actorUserId},
          ${input.facts.goalText}, ${input.facts.locale}, ${input.facts.goalCode}, 1, 'active')
      `;
        await tx`
        insert into api.goal_versions
          (id, goal_id, version, baseline_definition, target_definition,
           measurement_definitions, environment_code, difficulty_definition,
           horizon_days, success_criteria, stop_criteria, escalation_criteria)
        values (${input.ids.goalVersionId}, ${input.ids.goalId}, 1,
          ${tx.json({ successRate: input.facts.baselineSuccessRate })},
          ${tx.json({ successRate: 80 })},
          ${["metric.success_rate"]}::api.canonical_code[],
          'environment.outdoor_low_distraction', ${tx.json({ level: 1 })}, 21,
          ${tx.json({ consecutiveSessions: 3 })},
          ${tx.json({ codes: ["stop.safety_escalation"] })},
          ${tx.json({ codes: ["escalate.professional_review"] })})
      `;
        await tx`
        insert into api.goal_measurements
          (id, goal_version_id, metric_code, value_numeric, is_unknown, unit_code,
           source, method_code, environment_code, measured_at, quality)
        values (${input.ids.baselineMeasurementId}, ${input.ids.goalVersionId},
          'metric.success_rate', ${input.facts.baselineSuccessRate}, false,
          'unit.percent', 'owner_report', 'method.owner_estimate',
          'environment.outdoor_low_distraction', now(), 'moderate')
      `;

        const risk = riskAssessmentToPersistenceDTO(input.riskAssessment);
        await tx`
        insert into api.risk_assessments
          (id, dog_id, risk_level_code, disposition_code, triggered_rule_codes,
           reason_codes, permitted_action_codes, prohibited_action_codes,
           required_question_codes, explanation_evidence_ids, rule_set_id, assessed_at)
        values (${input.ids.riskAssessmentId}, ${input.ids.dogId},
          ${risk.risk_level_code}, ${risk.disposition_code}, ${risk.triggered_rule_codes},
          ${risk.reason_codes}, ${risk.permitted_action_codes},
          ${risk.prohibited_action_codes}, ${risk.required_question_codes},
          ${risk.evidence_ids}::uuid[], ${risk.rule_set_id}, now())
      `;

        if (input.plan !== null) {
          await persistPlan(
            tx,
            input.plan,
            input.ids.planId,
            input.ids.dogId,
            input.ids.goalVersionId,
          );
        }

        await tx`
        insert into private.onboarding_projections
          (contact_id, snapshot_hash, dog_id, anamnesis_id, goal_id, plan_id,
           risk_assessment_id)
        values (${input.contactId}, ${input.snapshotHash}, ${input.ids.dogId},
          ${input.ids.anamnesisId}, ${input.ids.goalId},
          ${input.plan === null ? null : input.ids.planId}, ${input.ids.riskAssessmentId})
      `;
        await tx`
        insert into private.audit_events
          (actor_user_id, actor_type, action, target_type, target_id, trace_id, metadata)
        values (${input.actorUserId}, 'user', 'onboarding.projected', 'dog',
          ${input.ids.dogId}, ${input.snapshotHash},
          ${tx.json({ channel: "whatsapp", planGenerated: input.plan !== null })})
      `;
      },
    );
    const context = await this.findByDog(projectedDogId);
    if (context === null) throw new Error("ONBOARDING_PROJECTION_FAILED");
    return context;
  }
}
