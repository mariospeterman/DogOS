import {
  dogProfileSchema,
  healthContextSchema,
  householdContextSchema,
  measurementSchema,
  ownerProfileSchema,
  protocolEligibilitySchema,
  protocolVersionSchema,
  riskAssessmentSchema,
  type DogProfile,
  type HealthContext,
  type HouseholdContext,
  type OwnerProfile,
  type ProtocolEligibility,
  type ProtocolRequirement,
  type ProtocolVersion,
  type ReasonCode,
  type RiskAssessment,
} from "@dogos/contracts";
import { z } from "zod";

export const eligibilityContextSchema = z.strictObject({
  dogProfile: dogProfileSchema,
  healthContext: healthContextSchema,
  householdContext: householdContextSchema,
  ownerProfile: ownerProfileSchema,
  safetyAssessment: riskAssessmentSchema,
  baselineMeasurements: z.array(
    z.strictObject({
      evidenceId: z.uuid(),
      measurement: measurementSchema,
    }),
  ),
  behaviorConcernCodes: z.array(z.string().min(1)),
  mode: z.enum(["development", "production"]),
  evaluatedAt: z.iso.datetime({ offset: true }),
  presentationLocale: z.string().min(2),
  jurisdiction: z.string().length(2),
  releaseChannel: z.string().min(1),
  activeRuleSetVersion: z.string().min(1),
});

export interface EligibilityContext {
  dogProfile: DogProfile;
  healthContext: HealthContext;
  householdContext: HouseholdContext;
  ownerProfile: OwnerProfile;
  safetyAssessment: RiskAssessment;
  baselineMeasurements: Array<{
    evidenceId: string;
    measurement: z.infer<typeof measurementSchema>;
  }>;
  behaviorConcernCodes: string[];
  mode: "development" | "production";
  evaluatedAt: string;
  presentationLocale: string;
  jurisdiction: string;
  releaseChannel: string;
  activeRuleSetVersion: string;
}

function requirementSatisfied(
  requirement: ProtocolRequirement,
  context: EligibilityContext,
): boolean {
  switch (requirement.type) {
    case "capability":
      return (
        requirement.valueCode !== undefined &&
        context.ownerProfile.capabilityCodes.includes(requirement.valueCode)
      );
    case "equipment":
      return (
        requirement.valueCode !== undefined &&
        context.householdContext.availableEquipmentCodes.includes(
          requirement.valueCode,
        )
      );
    case "environment":
      return context.householdContext.environmentCode === requirement.valueCode;
    case "baseline_metric":
      return context.baselineMeasurements.some(
        ({ measurement }) =>
          measurement.metricCode === requirement.metricCode &&
          !measurement.unknown,
      );
    case "development_stage":
      return context.dogProfile.developmentStage === requirement.valueCode;
    case "physical_constraint_absent":
      return (
        requirement.valueCode !== undefined &&
        !context.healthContext.physicalConstraintCodes.includes(
          requirement.valueCode,
        ) &&
        !context.dogProfile.breedContext.sourcedPhysicalConstraintCodes.includes(
          requirement.valueCode,
        )
      );
  }
}

function uniqueSorted<T extends string>(values: T[]): T[] {
  return [...new Set(values)].sort();
}

export function evaluateProtocolEligibility(
  rawProtocol: ProtocolVersion,
  rawContext: EligibilityContext,
): ProtocolEligibility {
  const protocol = protocolVersionSchema.parse(rawProtocol);
  const context = eligibilityContextSchema.parse(rawContext);
  const reasons: ReasonCode[] = [];
  const missingRequirements: string[] = [];
  const satisfiedRequirements: string[] = [];
  const exclusions: string[] = [];

  for (const requirement of protocol.prerequisites) {
    if (requirementSatisfied(requirement, context)) {
      satisfiedRequirements.push(requirement.code);
    } else {
      missingRequirements.push(requirement.code);
      reasons.push(
        requirement.type === "baseline_metric"
          ? "PROTOCOL_BASELINE_MISSING"
          : requirement.type === "equipment"
            ? "PROTOCOL_EQUIPMENT_MISSING"
            : requirement.type === "environment"
              ? "PROTOCOL_ENVIRONMENT_UNSUPPORTED"
              : requirement.type === "development_stage"
                ? "PROTOCOL_DEVELOPMENT_STAGE_UNSUPPORTED"
                : requirement.type === "physical_constraint_absent"
                  ? "PROTOCOL_PHYSICAL_CONSTRAINT"
                  : requirement.type === "capability"
                    ? "PROTOCOL_OWNER_CAPABILITY_INSUFFICIENT"
                    : "PROTOCOL_PREREQUISITE_MISSING",
      );
    }
  }

  if (context.safetyAssessment.disposition !== "continue_low_risk_training") {
    reasons.push("PROTOCOL_SAFETY_DISPOSITION_BLOCKED");
    exclusions.push("exclusion.non_low_risk_disposition");
  }
  if (
    !protocol.supportedDevelopmentStages.includes(
      context.dogProfile.developmentStage,
    )
  ) {
    reasons.push("PROTOCOL_DEVELOPMENT_STAGE_UNSUPPORTED");
  }
  if (
    context.householdContext.environmentCode === null ||
    !protocol.supportedEnvironmentCodes.includes(
      context.householdContext.environmentCode,
    )
  ) {
    reasons.push("PROTOCOL_ENVIRONMENT_UNSUPPORTED");
  }

  const physicalConstraints = new Set([
    ...context.healthContext.physicalConstraintCodes,
    ...context.dogProfile.breedContext.sourcedPhysicalConstraintCodes,
  ]);
  for (const exclusion of protocol.exclusions) {
    const triggered =
      (exclusion.type === "safety_disposition" &&
        context.safetyAssessment.disposition !==
          "continue_low_risk_training") ||
      (exclusion.type === "health_constraint" &&
        physicalConstraints.has(exclusion.valueCode)) ||
      (exclusion.type === "behavior_concern" &&
        context.behaviorConcernCodes.includes(exclusion.valueCode)) ||
      (exclusion.type === "environment" &&
        context.householdContext.environmentCode === exclusion.valueCode);
    if (triggered) {
      exclusions.push(exclusion.code);
      reasons.push(
        exclusion.type === "health_constraint"
          ? "PROTOCOL_PHYSICAL_CONSTRAINT"
          : exclusion.type === "safety_disposition"
            ? "PROTOCOL_SAFETY_DISPOSITION_BLOCKED"
            : "PROTOCOL_EXCLUSION_TRIGGERED",
      );
    }
  }

  const missingEquipment = protocol.requiredEquipmentCodes.filter(
    (equipment) =>
      !context.householdContext.availableEquipmentCodes.includes(equipment),
  );
  if (missingEquipment.length > 0) {
    reasons.push("PROTOCOL_EQUIPMENT_MISSING");
    missingRequirements.push(...missingEquipment);
  }

  if (
    protocol.ruleSetVersion === null ||
    protocol.ruleSetVersion !== context.activeRuleSetVersion
  ) {
    reasons.push("PROTOCOL_RULE_SET_VERSION_MISSING");
  }

  if (context.mode === "production") {
    if (protocol.developmentOnly) reasons.push("PROTOCOL_DEVELOPMENT_ONLY");
    if (protocol.approval.status === "unapproved") {
      reasons.push("PROTOCOL_UNAPPROVED");
    }
    if (
      !protocol.approval.jurisdictions.includes(context.jurisdiction) ||
      !protocol.approval.releaseChannels.includes(context.releaseChannel)
    ) {
      reasons.push("PROTOCOL_UNAPPROVED");
    }
    if (
      protocol.approval.status === "expired" ||
      (protocol.approval.expiresAt !== null &&
        protocol.approval.expiresAt <= context.evaluatedAt)
    ) {
      reasons.push("PROTOCOL_APPROVAL_EXPIRED");
    }
    if (
      protocol.safetyCriticalPresentation &&
      !protocol.releasedLocales.includes(context.presentationLocale)
    ) {
      reasons.push("PROTOCOL_LOCALIZATION_NOT_RELEASED");
    }
  }

  const reasonCodes = uniqueSorted(reasons);
  return protocolEligibilitySchema.parse({
    protocolVersionId: protocol.id,
    status: reasonCodes.length === 0 ? "eligible" : "blocked",
    reasonCodes,
    satisfiedRequirementCodes: uniqueSorted(satisfiedRequirements),
    missingRequirementCodes: uniqueSorted(missingRequirements),
    triggeredExclusionCodes: uniqueSorted(exclusions),
    evidenceIds: uniqueSorted([
      ...context.safetyAssessment.evidenceIds,
      ...context.baselineMeasurements.map(({ evidenceId }) => evidenceId),
    ]),
  });
}
