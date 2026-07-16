import type { ConversationLocale } from "./machine.js";

export interface ConversationLanguageResolution {
  confidence: number;
  locale: ConversationLocale;
  source: "explicit_request" | "message_text" | "preserved";
}

export interface ConversationLanguageResolver {
  resolve(input: {
    currentLocale: ConversationLocale;
    text: string;
  }): Promise<ConversationLanguageResolution>;
}

const germanWords = new Set([
  "akut",
  "bitte",
  "dein",
  "deutsch",
  "hallo",
  "hat",
  "heute",
  "hoi",
  "hund",
  "ich",
  "ist",
  "ja",
  "lahmt",
  "leine",
  "mein",
  "meine",
  "nein",
  "schmerz",
  "weiter",
]);

const englishWords = new Set([
  "acute",
  "continue",
  "dog",
  "english",
  "has",
  "hello",
  "hi",
  "is",
  "leash",
  "limps",
  "my",
  "no",
  "pain",
  "please",
  "proceed",
  "today",
  "want",
  "yes",
]);

export class DeterministicConversationLanguageResolver implements ConversationLanguageResolver {
  resolve(input: {
    currentLocale: ConversationLocale;
    text: string;
  }): Promise<ConversationLanguageResolution> {
    const normalized = input.text.trim().toLowerCase();
    const asksForEnglish = requestsLanguage(normalized, "english|englisch");
    const asksForGerman = requestsLanguage(normalized, "deutsch|german");

    if (asksForEnglish !== asksForGerman) {
      return Promise.resolve({
        confidence: 1,
        locale: asksForEnglish ? "en" : "de-CH",
        source: "explicit_request",
      });
    }

    if (/^choice\.\d+$/u.test(normalized) || normalized.length === 0) {
      return Promise.resolve(preserved(input.currentLocale));
    }

    const words = normalized.match(/[\p{L}]+/gu) ?? [];
    let germanScore = /[äöüß]/u.test(normalized) ? 2 : 0;
    let englishScore = 0;
    for (const word of words) {
      if (germanWords.has(word)) germanScore += 1;
      if (englishWords.has(word)) englishScore += 1;
    }

    if (
      germanScore === englishScore ||
      Math.max(germanScore, englishScore) < 1
    ) {
      return Promise.resolve(preserved(input.currentLocale));
    }

    const total = germanScore + englishScore;
    const difference = Math.abs(germanScore - englishScore);
    return Promise.resolve({
      confidence: Math.min(0.95, 0.6 + (difference / total) * 0.35),
      locale: englishScore > germanScore ? "en" : "de-CH",
      source: "message_text",
    });
  }
}

function requestsLanguage(text: string, languagePattern: string): boolean {
  const languageOnly = new RegExp(
    `^(?:${languagePattern})(?:\\s+(?:please|bitte))?$`,
    "u",
  );
  const request = new RegExp(
    `\\b(?:answer|antworte|continue|language|reply|respond|speak|sprache|weiter)\\b[^.!?]{0,40}\\b(?:${languagePattern})\\b`,
    "u",
  );
  return languageOnly.test(text) || request.test(text);
}

function preserved(locale: ConversationLocale): ConversationLanguageResolution {
  return { confidence: 0, locale, source: "preserved" };
}
