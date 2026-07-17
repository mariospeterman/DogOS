import postgres, { type Sql } from "postgres";
import type {
  PlanAdjustment,
  ProgressEvaluation,
  RiskAssessment,
} from "@dogos/contracts";
import {
  planAdjustmentToPersistenceDTO,
  progressEvaluationToPersistenceDTO,
  riskAssessmentToPersistenceDTO,
} from "./mappers.js";

export interface CommandContext {
  actorUserId: string;
  commandCode: string;
  idempotencyKey: string;
  requestHash: string;
  traceId: string;
}

export class IdempotencyConflictError extends Error {}
export class EvidenceNotFoundError extends Error {}

interface TransactionQuery {
  (
    template: TemplateStringsArray,
    ...parameters: unknown[]
  ): Promise<Array<Record<string, unknown>>>;
  json(value: unknown): unknown;
}

export class PostgresRepository {
  readonly #sql: Sql;

  constructor(connectionString: string) {
    this.#sql = postgres(connectionString, { max: 5, prepare: false });
  }

  async close(): Promise<void> {
    await this.#sql.end();
  }

  async executeCommand<T extends object>(
    context: CommandContext,
    action: string,
    targetType: string,
    operation: (
      tx: TransactionQuery,
    ) => Promise<{ status: number; body: T; targetId?: string }>,
  ): Promise<{ status: number; body: T; replayed: boolean }> {
    return this.#sql.begin(
      "isolation level serializable",
      async (transaction) => {
        const tx = transaction as unknown as TransactionQuery;
        const inserted = await tx`
        insert into private.command_idempotency
          (actor_user_id, command_code, idempotency_key, request_hash, trace_id)
        values (${context.actorUserId}, ${context.commandCode}, ${context.idempotencyKey},
          ${context.requestHash}, ${context.traceId})
        on conflict (actor_user_id, command_code, idempotency_key) do nothing
        returning id
      `;
        if (inserted.length === 0) {
          const [existing] = await tx`
          select request_hash, response_status, response_body
          from private.command_idempotency
          where actor_user_id = ${context.actorUserId}
            and command_code = ${context.commandCode}
            and idempotency_key = ${context.idempotencyKey}
          for update
        `;
          if (existing?.request_hash !== context.requestHash) {
            throw new IdempotencyConflictError(
              "Idempotency key was used with a different request",
            );
          }
          if (
            existing?.response_status !== null &&
            existing?.response_body !== null
          ) {
            return {
              status: Number(existing.response_status),
              body: existing.response_body as T,
              replayed: true,
            };
          }
        }

        const result = await operation(tx);
        await tx`
        update private.command_idempotency
        set response_status = ${result.status}, response_body = ${tx.json(result.body)}, completed_at = now()
        where actor_user_id = ${context.actorUserId}
          and command_code = ${context.commandCode}
          and idempotency_key = ${context.idempotencyKey}
      `;
        await tx`
        insert into private.audit_events
          (actor_user_id, actor_type, action, target_type, target_id, request_id, trace_id, metadata)
        values (${context.actorUserId}, 'user', ${action}, ${targetType},
          ${result.targetId ?? null}, ${context.idempotencyKey}, ${context.traceId},
          ${tx.json({ commandCode: context.commandCode })})
      `;
        return { status: result.status, body: result.body, replayed: false };
      },
    ) as Promise<{ status: number; body: T; replayed: boolean }>;
  }

  async assertEvidenceExists(
    tx: TransactionQuery,
    evidenceIds: string[],
  ): Promise<void> {
    if (evidenceIds.length === 0) return;
    const rows = await tx`
      select id from api.goal_measurements where id = any(${evidenceIds}::uuid[])
      union select id from api.session_measurements where id = any(${evidenceIds}::uuid[])
      union select id from api.owner_checkins where id = any(${evidenceIds}::uuid[])
      union select id from api.observations where id = any(${evidenceIds}::uuid[])
      union select id from api.sessions where id = any(${evidenceIds}::uuid[])
      union select id from api.safety_events where id = any(${evidenceIds}::uuid[])
      union select id from api.dog_health_context where id = any(${evidenceIds}::uuid[])
    `;
    if (
      new Set(rows.map((row) => String(row.id))).size !==
      new Set(evidenceIds).size
    ) {
      throw new EvidenceNotFoundError(
        "Decision references unresolved evidence",
      );
    }
  }

  async persistRiskAssessment(
    tx: TransactionQuery,
    dogId: string,
    decision: RiskAssessment,
  ): Promise<string> {
    const dto = riskAssessmentToPersistenceDTO(decision);
    await this.assertEvidenceExists(tx, dto.evidence_ids);
    const [row] = await tx`
      insert into api.risk_assessments
        (dog_id, risk_level_code, disposition_code, triggered_rule_codes, reason_codes,
         permitted_action_codes, prohibited_action_codes, required_question_codes,
         explanation_evidence_ids, rule_set_id, assessed_at)
      values (${dogId}, ${dto.risk_level_code}, ${dto.disposition_code}, ${dto.triggered_rule_codes},
        ${dto.reason_codes}, ${dto.permitted_action_codes}, ${dto.prohibited_action_codes},
        ${dto.required_question_codes}, ${dto.evidence_ids}::uuid[], ${dto.rule_set_id}, now())
      returning id
    `;
    return String(row?.id);
  }

  async persistProgressEvaluation(
    tx: TransactionQuery,
    planVersionId: string,
    decision: ProgressEvaluation,
  ): Promise<string> {
    const dto = progressEvaluationToPersistenceDTO(decision);
    await this.assertEvidenceExists(tx, dto.evidence_ids);
    const [row] = await tx`
      insert into api.progress_evaluations
        (plan_version_id, status_code, confidence, evidence_ids, missing_metric_codes,
         reason_codes, candidate_next_action, engine_version, rule_set_id, evaluated_at)
      values (${planVersionId}, ${dto.status_code}, ${dto.confidence}, ${dto.evidence_ids}::uuid[],
        ${dto.missing_metric_codes}, ${dto.reason_codes}, ${dto.candidate_next_action},
        ${dto.engine_version}, ${dto.rule_set_id}, now()) returning id
    `;
    const evaluationId = String(row?.id);
    for (const dimension of dto.dimensions) {
      await tx`insert into api.progress_dimensions
        (progress_evaluation_id, dimension_code, result)
        values (${evaluationId}, ${`progress.${dimension.dimensionCode}`}, ${tx.json(dimension)})`;
    }
    return evaluationId;
  }

  async persistPlanAdjustment(
    tx: TransactionQuery,
    planId: string,
    previousPlanVersionId: string,
    decision: PlanAdjustment,
    newPlanVersionId: string | null,
  ): Promise<string> {
    const dto = planAdjustmentToPersistenceDTO(decision);
    await this.assertEvidenceExists(tx, dto.evidence_ids);
    const [row] = await tx`
      insert into api.plan_adjustments
        (plan_id, previous_plan_version_id, new_plan_version_id, decision_code,
         reason_codes, evidence_ids, required_question_codes, escalation_code, engine_version)
      values (${planId}, ${previousPlanVersionId}, ${newPlanVersionId}, ${dto.decision_code},
        ${dto.reason_codes}, ${dto.evidence_ids}::uuid[], ${dto.required_question_codes},
        ${dto.escalation_code}, '1.0.0') returning id
    `;
    if (newPlanVersionId !== null) {
      await tx`select private.activate_plan_version(${planId}, ${newPlanVersionId}, null)`;
    }
    return String(row?.id);
  }

  startSession(
    context: CommandContext,
    scheduledSessionId: string,
    householdId: string,
  ): Promise<{
    body: { sessionId: string; status: "in_progress" };
    replayed: boolean;
    status: number;
  }> {
    return this.executeCommand(
      context,
      "session.started",
      "session",
      async (tx) => {
        const [scheduled] = await tx`
          select ss.id, d.id as dog_id
          from api.scheduled_sessions ss
          join api.plan_steps ps on ps.id = ss.plan_step_id
          join api.plan_versions pv on pv.id = ps.plan_version_id
          join api.plans p on p.id = pv.plan_id
          join api.dogs d on d.id = p.dog_id
          where ss.id = ${scheduledSessionId}::uuid
            and d.household_id = ${householdId}::uuid
            and p.active_plan_version_id = pv.id
          for update of ss
        `;
        if (scheduled === undefined) throw new Error("RESOURCE_NOT_FOUND");
        const [existing] = await tx`
          select id, completion_status from api.sessions
          where scheduled_session_id = ${scheduledSessionId}::uuid
          order by created_at
          limit 1
        `;
        if (
          existing !== undefined &&
          existing.completion_status !== "in_progress"
        ) {
          throw new Error("STALE_VERSION");
        }
        const sessionId =
          existing === undefined
            ? String(
                (
                  await tx`
                    insert into api.sessions
                      (scheduled_session_id, dog_id, handler_user_id, started_at,
                       completion_status)
                    values (${scheduledSessionId}, ${scheduled.dog_id},
                      ${context.actorUserId}, now(), 'in_progress')
                    returning id
                  `
                )[0]!.id,
              )
            : String(existing.id);
        return {
          body: { sessionId, status: "in_progress" as const },
          status: 200,
          targetId: sessionId,
        };
      },
    );
  }

  completeSession(
    context: CommandContext,
    sessionId: string,
    householdId: string,
    input: {
      concernNotes: string | null;
      confidence: number | null;
      difficulty: number | null;
      distractionLevel: number | null;
      foodAccepted: boolean | null;
      locale: string;
      outcome: "clean" | "mixed" | "stopped";
      repetitions: number;
      successes: number;
    },
  ): Promise<{
    body: { sessionId: string; status: "completed" | "interrupted" };
    replayed: boolean;
    status: number;
  }> {
    return this.executeCommand(
      context,
      "session.completed",
      "session",
      async (tx) => {
        const [session] = await tx`
          select s.id, s.scheduled_session_id, s.completion_status
          from api.sessions s
          join api.dogs d on d.id = s.dog_id
          where s.id = ${sessionId}::uuid
            and d.household_id = ${householdId}::uuid
          for update of s
        `;
        if (session === undefined) throw new Error("RESOURCE_NOT_FOUND");
        if (session.completion_status !== "in_progress") {
          throw new Error("STALE_VERSION");
        }
        const completionStatus =
          input.outcome === "stopped" ? "interrupted" : "completed";
        await tx`
          update api.sessions
          set completion_status = ${completionStatus}, ended_at = now()
          where id = ${sessionId}::uuid
        `;
        if (session.scheduled_session_id !== null) {
          await tx`
            update api.scheduled_sessions
            set status = 'completed', updated_at = now()
            where id = ${session.scheduled_session_id}
          `;
        }
        await tx`
          insert into api.session_context
            (session_id, distraction_level, feeding_context)
          values (${sessionId}, ${input.distractionLevel},
            ${tx.json({ accepted: input.foodAccepted })})
          on conflict (session_id) do nothing
        `;
        const measurements: Array<{
          code: string;
          unit: string | null;
          value: boolean | number | null;
        }> = [
          {
            code: "metric.repetition_count",
            unit: "unit.count",
            value: input.repetitions,
          },
          {
            code: "metric.success_count",
            unit: "unit.count",
            value: input.successes,
          },
          {
            code: "metric.success_rate",
            unit: "unit.percent",
            value:
              input.repetitions === 0
                ? null
                : (input.successes / input.repetitions) * 100,
          },
          {
            code: "metric.food_acceptance",
            unit: null,
            value: input.foodAccepted,
          },
        ];
        for (const measurement of measurements) {
          const unknown = measurement.value === null;
          await tx`
            insert into api.session_measurements
              (session_id, metric_code, value_numeric, value_boolean, is_unknown,
               unknown_reason, unit_code, source, method_code, measured_at, quality)
            values (${sessionId}, ${measurement.code},
              ${typeof measurement.value === "number" ? measurement.value : null},
              ${typeof measurement.value === "boolean" ? measurement.value : null},
              ${unknown}, ${unknown ? "unknown.not_measured" : null},
              ${measurement.unit}, 'owner_report', 'method.session_summary',
              now(), ${unknown ? "unavailable" : "moderate"})
          `;
        }
        await tx`
          insert into api.owner_checkins
            (session_id, user_id, difficulty_rating, confidence_rating,
             perceived_outcome_code, concern_codes, notes, notes_locale)
          values (${sessionId}, ${context.actorUserId}, ${input.difficulty},
            ${input.confidence}, ${`outcome.${input.outcome}`},
            ${input.concernNotes === null ? [] : ["concern.owner_reported"]},
            ${input.concernNotes}, ${input.locale})
        `;
        return {
          body: {
            sessionId,
            status: completionStatus as "completed" | "interrupted",
          },
          status: 200,
          targetId: sessionId,
        };
      },
    );
  }
}
