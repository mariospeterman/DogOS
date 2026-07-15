export interface CandidateFact<T> {
  confidence: number;
  value: T;
}

export interface ConversationLanguageProvider {
  detectLocale(text: string): Promise<CandidateFact<"de-CH" | "en">>;
  extractCandidateFacts(
    text: string,
  ): Promise<Record<string, CandidateFact<unknown>>>;
  renderCanonicalResult(
    messageKey: string,
    locale: "de-CH" | "en",
    values: Record<string, string | number>,
  ): Promise<string>;
}

export function missingPlanFact(input: {
  dogId?: string;
  goalCode?: string;
}): "dogId" | "goalCode" | null {
  if (input.dogId === undefined) return "dogId";
  if (input.goalCode === undefined) return "goalCode";
  return null;
}

export function progressExplanation(locale: "de-CH" | "en"): string {
  return locale === "de-CH"
    ? "In ruhiger Umgebung war die Erfolgsrate höher. Der Zusammenhang beweist keine Ursache."
    : "Success was higher in a quiet environment. This association does not establish causation.";
}
