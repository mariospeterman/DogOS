"use client";

import { useChat } from "@ai-sdk/react";
import {
  Archive,
  Camera,
  CircleUserRound,
  Clock3,
  CreditCard,
  FileText,
  MoreHorizontal,
  Mic,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Pin,
  Plus,
  Route,
  Search,
  Send,
  Settings,
  Share2,
  Sparkles,
  Sun,
  Target,
  Trash2,
  Upload,
  Video,
  X,
} from "lucide-react";
import { DefaultChatTransport, type UIMessage } from "ai";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { dogosApiHeaders, dogosApiUrl } from "../lib/api-client";
import type { ProductDashboard } from "../lib/product";
import { trainingPresentation } from "../lib/training-presentation";

interface PersistedConversation {
  id: string;
  locale: "de-CH" | "en";
  messages: Array<{
    content: string;
    id: string;
    role: "assistant" | "system" | "user";
  }>;
}

interface VideoAnalysis {
  completedAt: string | null;
  findings: Array<{
    confidence: number;
    evidence: string;
    label: string;
    recommendation: string;
  }>;
  id: string;
  jobId: string | null;
  originalFilename: string;
  status: string;
}

interface VideoUpload {
  expiresInSeconds: number;
  method: "PUT";
  url: string;
}

interface LiveSession {
  consumedMinutes: number;
  id: string;
  plannedMinutes: number;
  roomName: string;
  status: string;
  summary: string | null;
}

interface SearchResult {
  createdAt: string;
  excerpt: string;
  href: string;
  id: string;
  kind:
    | "chapter"
    | "live_session"
    | "memory"
    | "message"
    | "video_analysis"
    | "video_observation";
  title: string;
  workspace: "coach" | "media" | "plan" | "progress" | "setup" | "train";
}

interface AccountView {
  billingAvailable: boolean;
  country: string;
  currency: string;
  displayName: string | null;
  householdName: string;
  role: string;
  tier: string;
  timezone: string;
}

type InlinePanelKind =
  "billing" | "delete" | "files" | "live" | "profile" | "settings" | "video";

function toUiMessages(conversation: PersistedConversation): UIMessage[] {
  return conversation.messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      id: message.id,
      parts: [{ text: message.content, type: "text" as const }],
      role: message.role as "assistant" | "user",
    }));
}

function textOf(message: UIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n");
}

function presentLegacyText(text: string, locale: "de-CH" | "en"): string {
  const trainingLink =
    locale === "en" ? "Open today's training" : "Heutiges Training öffnen";
  return text
    .replace(/https?:\/\/\S+\?action=\S+/g, trainingLink)
    .replace(
      /\b(?:[a-z_]+\.)?choice\.\d+\b/g,
      locale === "en" ? "Selection saved." : "Auswahl gespeichert.",
    )
    .replace(
      /\brepeat_step\b/g,
      locale === "en"
        ? "repeat the current level"
        : "aktuelle Stufe wiederholen",
    )
    .replace(
      /\bstep\.recall_short_distance\b/g,
      locale === "en"
        ? "short recall under low distraction"
        : "kurzer Rückruf bei wenig Ablenkung",
    )
    .replace(
      /\bcontinue_low_risk_training\b/g,
      locale === "en" ? "low-risk training" : "Training mit niedrigem Risiko",
    );
}

function splitSources(text: string, locale: "de-CH" | "en") {
  const match = text.match(/\n\n(Quellen|Sources):\s*(.+)$/s);
  const body = presentLegacyText(
    match === null ? text : text.slice(0, match.index),
    locale,
  ).trim();
  const sources =
    match === null
      ? []
      : (match[2] ?? "")
          .split(/;\s*/)
          .map((item) =>
            presentLegacyText(item.replace(/^\[\d+\]\s*/, ""), locale).trim(),
          )
          .filter(Boolean);
  return { body, sources };
}

type TrainingActionState =
  "ready" | "not_scheduled" | "needs_information" | "stopped";

function trainingActionState(product: ProductDashboard): TrainingActionState {
  if (product.riskDisposition === "require_more_information") {
    return "needs_information";
  }
  if (product.riskDisposition !== "continue_low_risk_training") {
    return "stopped";
  }
  if (product.planStatus !== "active" || product.todaySessionId === null) {
    return "not_scheduled";
  }
  return "ready";
}

function trainingDecisionLabel(decision: string, english: boolean): string {
  if (decision === "increase_difficulty") {
    return english ? "ready for the next level" : "nächste Stufe möglich";
  }
  if (decision === "reduce_difficulty") {
    return english ? "make this easier" : "Übung vereinfachen";
  }
  if (decision === "ask_for_information") {
    return english ? "one observation missing" : "eine Beobachtung fehlt";
  }
  return english ? "repeat this level" : "aktuelle Stufe wiederholen";
}

function heldTrainingCopy(
  state: TrainingActionState,
  english: boolean,
): { label: string; status: string; title: string; body: string } {
  if (state === "needs_information") {
    return english
      ? {
          body: "DogOS needs one more observation before it shows another autonomous training start.",
          label: "Training held",
          status: "Info",
          title: "One observation is missing",
        }
      : {
          body: "DogOS braucht zuerst eine weitere Beobachtung, bevor eine neue autonome Trainingseinheit startet.",
          label: "Training pausiert",
          status: "Info",
          title: "Eine Beobachtung fehlt",
        };
  }
  if (state === "not_scheduled") {
    return english
      ? {
          body: "The plan stays visible, but there is no startable session scheduled right now.",
          label: "No session",
          status: "Plan",
          title: "Nothing scheduled yet",
        }
      : {
          body: "Der Plan bleibt sichtbar, aber aktuell ist keine startbare Einheit geplant.",
          label: "Keine Einheit",
          status: "Plan",
          title: "Noch nichts geplant",
        };
  }
  return english
    ? {
        body: "DogOS keeps the history visible, but stops autonomous training until the risk state is reviewed.",
        label: "Training stopped",
        status: "Stop",
        title: "Review before training",
      }
    : {
        body: "DogOS zeigt den Verlauf weiter, stoppt aber autonomes Training bis zur Abklärung des Risikozustands.",
        label: "Training gestoppt",
        status: "Stop",
        title: "Abklärung vor Training",
      };
}

function historyLabel(text: string, fallback: string): string {
  const first = text.replace(/\s+/g, " ").trim();
  if (first.length === 0) return fallback;
  return first.length > 42 ? `${first.slice(0, 42)}...` : first;
}

function chapterTitle(text: string, english: boolean): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length === 0)
    return english ? "Training topic" : "Trainingsthema";
  const lower = normalized.toLowerCase();
  if (/video|clip|film|aufnahme/.test(lower)) {
    return english ? "Video review" : "Videoauswertung";
  }
  if (/plan|block|übung|uebung|training/.test(lower)) {
    return english ? "Training plan" : "Trainingsplan";
  }
  if (/fortschritt|progress|besser|trend/.test(lower)) {
    return english ? "Progress review" : "Fortschritt prüfen";
  }
  return historyLabel(
    normalized,
    english ? "Training topic" : "Trainingsthema",
  );
}

function sessionLabel(plannedStart: string, english: boolean): string {
  const date = new Date(plannedStart);
  if (Number.isNaN(date.getTime()))
    return english ? "Scheduled session" : "Geplante Einheit";
  return new Intl.DateTimeFormat(english ? "en" : "de-CH", {
    day: "2-digit",
    month: "short",
    weekday: "short",
  }).format(date);
}

export function CoachChat({ product }: { product: ProductDashboard }) {
  const [conversation, setConversation] =
    useState<PersistedConversation | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch(
          dogosApiUrl(
            `/v1/coach/conversation?dogId=${encodeURIComponent(product.dogId)}`,
          ),
          { cache: "no-store", headers: await dogosApiHeaders() },
        );
        if (response.status === 401) {
          window.location.assign("/auth/sign-in?next=/app/coach");
          return;
        }
        if (!response.ok) throw new Error("COACH_UNAVAILABLE");
        const conversation = (await response.json()) as PersistedConversation;
        if (active) setConversation(conversation);
      } catch {
        if (active) setLoadError("Der Coach konnte nicht geladen werden.");
      }
    })();
    return () => {
      active = false;
    };
  }, [product.dogId]);

  if (conversation === null) {
    return (
      <div className="coach-loading">
        <span className="coach-pulse" />
        <p>{loadError ?? "Gespräch wird geladen"}</p>
      </div>
    );
  }
  return (
    <CoachRuntime
      initialMessages={toUiMessages(conversation)}
      locale={conversation.locale}
      product={product}
    />
  );
}

function InlineWorkspacePanel({
  chatArchived,
  english,
  kind,
  onArchive,
  onClose,
  onDelete,
  onOpenVideo,
  product,
}: {
  chatArchived: boolean;
  english: boolean;
  kind: InlinePanelKind;
  onArchive: () => void;
  onClose: () => void;
  onDelete: () => void;
  onOpenVideo: () => void;
  product: ProductDashboard;
}) {
  const [account, setAccount] = useState<AccountView | null>(null);
  const [analyses, setAnalyses] = useState<VideoAnalysis[]>([]);
  const [consent, setConsent] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [liveMessage, setLiveMessage] = useState<string | null>(null);
  const [liveSession, setLiveSession] = useState<LiveSession | null>(null);
  const [plannedMinutes, setPlannedMinutes] = useState(10);
  const [videoMessage, setVideoMessage] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (kind !== "video" && kind !== "files") return;
    let active = true;
    void (async () => {
      const response = await fetch(
        dogosApiUrl(`/v1/dogs/${product.dogId}/video-analyses`),
        { cache: "no-store", headers: await dogosApiHeaders() },
      );
      if (!active || !response.ok) return;
      const body = (await response.json()) as { analyses: VideoAnalysis[] };
      setAnalyses(body.analyses);
    })();
    return () => {
      active = false;
    };
  }, [kind, product.dogId]);

  useEffect(() => {
    if (kind !== "profile" && kind !== "settings" && kind !== "billing") {
      return;
    }
    let active = true;
    void (async () => {
      const response = await fetch(dogosApiUrl("/v1/me"), {
        headers: await dogosApiHeaders(),
      });
      if (!active || !response.ok) return;
      setAccount((await response.json()) as AccountView);
    })();
    return () => {
      active = false;
    };
  }, [kind]);

  async function uploadVideo() {
    if (file === null) return;
    setWorking(true);
    setVideoMessage(null);
    try {
      const createResponse = await fetch(
        dogosApiUrl(`/v1/dogs/${product.dogId}/video-analyses`),
        {
          body: JSON.stringify({
            contentType: file.type,
            originalFilename: file.name,
            sizeBytes: file.size,
          }),
          headers: await dogosApiHeaders(true),
          method: "POST",
        },
      );
      if (!createResponse.ok) {
        setVideoMessage(
          createResponse.status === 409
            ? english
              ? "Your current plan has no remaining video allowance."
              : "Dein aktueller Tarif hat kein freies Video-Kontingent."
            : english
              ? "The video could not be prepared."
              : "Das Video konnte nicht vorbereitet werden.",
        );
        return;
      }
      const created = (await createResponse.json()) as {
        analysis: VideoAnalysis;
        upload: VideoUpload;
      };
      const uploadResponse = await fetch(created.upload.url, {
        body: file,
        headers: { "content-type": file.type },
        method: created.upload.method,
      });
      if (!uploadResponse.ok) {
        setAnalyses((current) => [created.analysis, ...current]);
        setVideoMessage(
          english
            ? "The private upload failed. Please try again."
            : "Der private Upload ist fehlgeschlagen. Bitte erneut versuchen.",
        );
        return;
      }
      const completeResponse = await fetch(
        dogosApiUrl(
          `/v1/video-analyses/${created.analysis.id}/complete-upload`,
        ),
        {
          body: JSON.stringify({}),
          headers: await dogosApiHeaders(true),
          method: "POST",
        },
      );
      if (!completeResponse.ok) {
        setAnalyses((current) => [created.analysis, ...current]);
        setVideoMessage(
          english
            ? "The upload is saved, but analysis could not be queued yet."
            : "Der Upload ist gespeichert, konnte aber noch nicht eingereiht werden.",
        );
        return;
      }
      const queued = (await completeResponse.json()) as {
        analysis: VideoAnalysis;
      };
      setAnalyses((current) => [queued.analysis, ...current]);
      setFile(null);
      setVideoMessage(
        english
          ? "Upload saved. DogOS analyzes the clip asynchronously."
          : "Upload gespeichert. DogOS analysiert den Clip asynchron.",
      );
    } finally {
      setWorking(false);
    }
  }

  async function startLive() {
    setWorking(true);
    setLiveMessage(null);
    try {
      const response = await fetch(
        dogosApiUrl(`/v1/dogs/${product.dogId}/live-sessions`),
        {
          body: JSON.stringify({ plannedMinutes }),
          headers: await dogosApiHeaders(true),
          method: "POST",
        },
      );
      if (!response.ok) {
        setLiveMessage(
          response.status === 409
            ? english
              ? "Live coaching is not enabled or your allowance is used."
              : "Live Coaching ist noch nicht freigeschaltet oder dein Kontingent ist aufgebraucht."
            : english
              ? "Live coaching could not be started."
              : "Live Coaching konnte nicht gestartet werden.",
        );
        return;
      }
      const body = (await response.json()) as {
        liveKit: { token: string; url: string };
        session: LiveSession;
      };
      setLiveSession(body.session);
      setLiveMessage(
        english
          ? "Live room ready. Credentials stay hidden and are only used for the connection."
          : "Live Raum bereit. Zugangsdaten bleiben verborgen und werden nur für die Verbindung genutzt.",
      );
    } finally {
      setWorking(false);
    }
  }

  const title =
    kind === "files"
      ? english
        ? "Files in chat"
        : "Dateien im Chat"
      : kind === "video"
        ? english
          ? "Analyze training video"
          : "Trainingsvideo analysieren"
        : kind === "live"
          ? "Live Coaching"
          : kind === "billing"
            ? "Billing"
            : kind === "delete"
              ? english
                ? "Delete chat"
                : "Chat löschen"
              : kind === "profile"
                ? english
                  ? "Profile"
                  : "Profil"
                : "Settings";

  return (
    <section className="chat-inline-panel" id={kind}>
      <div className="inline-panel-header">
        <span>{title}</span>
        <button
          aria-label={english ? "Close panel" : "Panel schliessen"}
          onClick={onClose}
          type="button"
        >
          <X size={17} />
        </button>
      </div>

      {kind === "files" ? (
        <div className="inline-panel-body">
          <p>
            {english
              ? "Media stays attached to this Coach timeline. Upload a training video or review queued clips without leaving chat."
              : "Medien bleiben an diese Coach-Timeline gebunden. Lade ein Trainingsvideo hoch oder prüfe wartende Clips direkt im Chat."}
          </p>
          <button
            className="button primary"
            onClick={onOpenVideo}
            type="button"
          >
            <Upload size={17} />
            {english ? "Upload training video" : "Trainingsvideo hochladen"}
          </button>
          <div className="inline-panel-list">
            {analyses.length === 0 ? (
              <span>
                {english
                  ? "No media attached yet."
                  : "Noch keine Medien angehängt."}
              </span>
            ) : (
              analyses.slice(0, 6).map((analysis) => (
                <span key={analysis.id}>
                  <strong>{analysis.originalFilename}</strong>
                  <small>{analysis.status}</small>
                </span>
              ))
            )}
          </div>
        </div>
      ) : null}

      {kind === "video" ? (
        <div className="inline-panel-body">
          <p>
            {english
              ? "Upload clips in chat. DogOS stores them privately, queues analysis, and only returns reviewed observations."
              : "Lade Clips direkt im Chat hoch. DogOS speichert sie privat, reiht die Analyse ein und zeigt nur geprüfte Beobachtungen."}
          </p>
          <label className="inline-file-input">
            <Upload size={17} />
            <span>
              {file?.name ?? (english ? "Choose file" : "Datei wählen")}
            </span>
            <input
              accept="video/mp4,video/quicktime,video/webm"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              type="file"
            />
          </label>
          <button
            className="button primary"
            disabled={file === null || working}
            onClick={() => void uploadVideo()}
            type="button"
          >
            <Upload size={17} />
            {working
              ? english
                ? "Uploading..."
                : "Upload läuft..."
              : english
                ? "Upload video"
                : "Video hochladen"}
          </button>
          {videoMessage === null ? null : (
            <p className="helper">{videoMessage}</p>
          )}
          <div className="inline-panel-list">
            {analyses.length === 0 ? (
              <span>
                {english
                  ? "No videos in review yet."
                  : "Noch keine Videos in Prüfung."}
              </span>
            ) : (
              analyses.slice(0, 4).map((analysis) => (
                <span key={analysis.id}>
                  <strong>{analysis.originalFilename}</strong>
                  <small>
                    {analysis.status === "uploaded"
                      ? english
                        ? "Queued"
                        : "In der Warteschlange"
                      : analysis.status}
                  </small>
                </span>
              ))
            )}
          </div>
        </div>
      ) : null}

      {kind === "live" ? (
        <div className="inline-panel-body">
          <p>
            {english
              ? "Start near real-time coaching from the chat workspace. DogOS keeps consent, entitlements, retention and summaries authoritative."
              : "Starte Near-Realtime-Coaching direkt aus dem Chat. DogOS bleibt für Einwilligung, Kontingent, Aufbewahrung und Zusammenfassung autoritativ."}
          </p>
          <label>
            {english ? "Minutes" : "Minuten"}
            <input
              max={60}
              min={1}
              onChange={(event) =>
                setPlannedMinutes(Number(event.target.value) || 1)
              }
              type="number"
              value={plannedMinutes}
            />
          </label>
          <label className="checkbox-row">
            <input
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              type="checkbox"
            />
            <span>
              {english
                ? "I consent to live transmission for this session."
                : "Ich stimme der Live-Übertragung für diese Session zu."}
            </span>
          </label>
          <button
            className="button primary"
            disabled={working || !consent}
            onClick={() => void startLive()}
            type="button"
          >
            <Camera size={17} />
            {working
              ? english
                ? "Starting..."
                : "Startet..."
              : english
                ? "Start live session"
                : "Live Session starten"}
          </button>
          {liveMessage === null ? null : (
            <p className="helper">{liveMessage}</p>
          )}
          {liveSession === null ? null : (
            <div className="inline-panel-list">
              <span>
                <strong>{english ? "Room ready" : "Raum bereit"}</strong>
                <small>
                  {liveSession.status} · {liveSession.plannedMinutes} Min.
                </small>
              </span>
            </div>
          )}
        </div>
      ) : null}

      {kind === "settings" ? (
        <div className="inline-panel-body">
          <p>
            {english
              ? "Keep account work out of the main navigation, but reachable from chat."
              : "Kontothemen bleiben aus der Hauptnavigation, sind aber direkt im Chat erreichbar."}
          </p>
          <div className="inline-panel-list">
            <Link href="/app/account/settings">Settings</Link>
            <Link href="/app/account/history">
              {english ? "History and search" : "Verlauf und Suche"}
            </Link>
            <Link href="/app/account/privacy">Privacy</Link>
            <Link href="/app/account/memory">Memory</Link>
          </div>
        </div>
      ) : null}

      {kind === "profile" ? (
        <div className="inline-panel-body">
          <div className="account-inline-person">
            <span>
              {(account?.displayName ?? "DogOS Owner")
                .split(/\s+/)
                .map((part) => part[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </span>
            <div>
              <strong>{account?.displayName ?? "DogOS Owner"}</strong>
              <small>
                {account === null
                  ? english
                    ? "Loading account..."
                    : "Konto wird geladen..."
                  : `${account.role} · ${account.householdName}`}
              </small>
            </div>
          </div>
          <div className="inline-panel-list">
            <span>
              <strong>{english ? "Plan" : "Tarif"}</strong>
              <small>{account?.tier ?? "..."}</small>
            </span>
            <span>
              <strong>{english ? "Locale" : "Land und Währung"}</strong>
              <small>
                {account === null
                  ? "..."
                  : `${account.country} · ${account.currency} · ${account.timezone}`}
              </small>
            </span>
            <Link href="/app/account/privacy">Privacy</Link>
            <Link href="/app/account/memory">Memory</Link>
          </div>
        </div>
      ) : null}

      {kind === "billing" ? (
        <div className="inline-panel-body">
          <p>
            {english
              ? "Video analysis, live coaching and trainer handoff stay tied to entitlement checks before checkout or usage."
              : "Videoanalyse, Live Coaching und Trainerübergabe bleiben vor Checkout oder Nutzung an Entitlements gebunden."}
          </p>
          <div className="inline-panel-list">
            <Link href="/app/account/billing">Billing</Link>
            <Link href="/app/account/plans">
              {english ? "Plans" : "Tarife"}
            </Link>
          </div>
        </div>
      ) : null}

      {kind === "delete" ? (
        <div className="inline-panel-body">
          <p>
            {english
              ? "Delete hides this chat from the current workspace. Durable safety, billing, privacy and training records are kept under their own retention rules."
              : "Löschen blendet diesen Chat aus dem aktuellen Workspace aus. Dauerhafte Sicherheits-, Abrechnungs-, Datenschutz- und Trainingsdaten behalten ihre eigenen Aufbewahrungsregeln."}
          </p>
          <div className="inline-card-actions">
            <button className="button danger" onClick={onDelete} type="button">
              <Trash2 size={17} />
              {english ? "Delete chat" : "Chat löschen"}
            </button>
            <button
              className="button secondary"
              disabled={chatArchived}
              onClick={onArchive}
              type="button"
            >
              <Archive size={17} />
              {chatArchived
                ? english
                  ? "Archived"
                  : "Archiviert"
                : english
                  ? "Archive instead"
                  : "Stattdessen archivieren"}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function searchKindLabel(kind: SearchResult["kind"], english: boolean): string {
  if (kind === "chapter") return english ? "Topic" : "Thema";
  if (kind === "message") return english ? "Message" : "Nachricht";
  if (kind === "video_analysis") return english ? "Video" : "Video";
  if (kind === "video_observation")
    return english ? "Video observation" : "Video-Beobachtung";
  if (kind === "live_session") return "Live";
  return "Memory";
}

function DurableSearchResults({
  english,
  onNavigate,
  results,
  searching,
}: {
  english: boolean;
  onNavigate: () => void;
  results: SearchResult[];
  searching: boolean;
}) {
  if (searching) {
    return <p>{english ? "Searching..." : "Suche läuft..."}</p>;
  }
  if (results.length === 0) {
    return <p>{english ? "No durable matches" : "Keine Treffer"}</p>;
  }
  return (
    <>
      {results.map((result) => (
        <a href={result.href} key={result.id} onClick={onNavigate}>
          <strong>{result.title}</strong>
          <small>
            {searchKindLabel(result.kind, english)} · {result.workspace}
          </small>
        </a>
      ))}
    </>
  );
}

function InlineSpaceSummary({
  activeSpace,
  english,
  product,
}: {
  activeSpace: string;
  english: boolean;
  product: ProductDashboard;
}) {
  const presentation = trainingPresentation(product, english ? "en" : "de-CH");
  const duration = Math.max(
    1,
    Math.ceil((product.currentStep?.durationSeconds ?? 180) / 60),
  );
  if (activeSpace === "plan") {
    return (
      <section className="chat-inline-panel">
        <div className="inline-panel-header">
          <span>{english ? "Plan" : "Plan"}</span>
        </div>
        <div className="inline-panel-body">
          <p>{presentation.instruction(product.dogName)}</p>
          <div className="inline-panel-list">
            <span>
              <strong>{presentation.title}</strong>
              <small>{presentation.stage}</small>
            </span>
            <span>
              <strong>{english ? "Target" : "Ziel"}</strong>
              <small>
                {product.baselineSuccessRate}% →{" "}
                {product.targetSuccessRate ?? 80}%
              </small>
            </span>
          </div>
        </div>
      </section>
    );
  }
  if (activeSpace === "train") {
    return (
      <section className="chat-inline-panel">
        <div className="inline-panel-header">
          <span>{english ? "Training session" : "Trainingseinheit"}</span>
        </div>
        <div className="inline-panel-body">
          <div className="inline-panel-list">
            <span>
              <strong>{presentation.title}</strong>
              <small>
                {duration} Min. · {product.currentStep?.repetitions ?? 6}{" "}
                {presentation.unit}
              </small>
            </span>
          </div>
          <p>{presentation.instruction(product.dogName)}</p>
        </div>
      </section>
    );
  }
  return (
    <section className="chat-inline-panel">
      <div className="inline-panel-header">
        <span>{english ? "Progress" : "Fortschritt"}</span>
      </div>
      <div className="inline-panel-body">
        <div className="inline-panel-list">
          <span>
            <strong>
              {product.baselineSuccessRate}% → {product.targetSuccessRate ?? 80}
              %
            </strong>
            <small>
              {product.sessionCount}{" "}
              {english ? "recorded sessions" : "gespeicherte Einheiten"}
            </small>
          </span>
          <span>
            <strong>{english ? "Decision" : "Entscheid"}</strong>
            <small>
              {trainingDecisionLabel(product.latestDecision, english)}
            </small>
          </span>
        </div>
      </div>
    </section>
  );
}

function CoachRuntime({
  initialMessages,
  locale,
  product,
}: {
  initialMessages: UIMessage[];
  locale: "de-CH" | "en";
  product: ProductDashboard;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const action = searchParams.get("action");
  const [input, setInput] = useState("");
  const [activePanel, setActivePanel] = useState<InlinePanelKind | null>(() =>
    action === "upload-video"
      ? "video"
      : action === "start-live"
        ? "live"
        : action === "profile"
          ? "profile"
          : action === "files"
            ? "files"
            : action === "delete-chat"
              ? "delete"
              : null,
  );
  const [historyQuery, setHistoryQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [chatArchived, setChatArchived] = useState(false);
  const [chatDeleted, setChatDeleted] = useState(false);
  const [chatPinned, setChatPinned] = useState(false);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window === "undefined") return "light";
    return window.localStorage.getItem("dogos-theme") === "dark"
      ? "dark"
      : "light";
  });
  const viewport = useRef<HTMLDivElement>(null);
  const deepLinkSent = useRef(false);
  const activeSpace = searchParams.get("space") ?? "coach";
  const contextKind =
    activeSpace === "plan"
      ? "plan"
      : activeSpace === "progress"
        ? "progress"
        : activeSpace === "train"
          ? "session"
          : activeSpace === "media"
            ? "media"
            : "general";
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { contextKind, dogId: product.dogId },
        headers: () => dogosApiHeaders(true),
      }),
    [contextKind, product.dogId],
  );
  const { error, messages, sendMessage, status, stop } = useChat({
    id: `dog:${product.dogId}`,
    messages: initialMessages,
    transport,
  });
  const busy = status === "submitted" || status === "streaming";
  const presentation = trainingPresentation(product, locale);
  const english = locale === "en";
  const duration = Math.max(
    1,
    Math.ceil((product.currentStep?.durationSeconds ?? 180) / 60),
  );
  const placeholder =
    activeSpace === "plan"
      ? english
        ? `Ask about ${product.dogName}'s plan...`
        : `Frag nach ${product.dogName}s Plan...`
      : activeSpace === "train"
        ? english
          ? "Record what happened during the session..."
          : "Halte fest, was in der Einheit passiert ist..."
        : activeSpace === "progress"
          ? english
            ? "Ask about a trend or improvement..."
            : "Frag nach einem Trend oder Fortschritt..."
          : activeSpace === "media"
            ? english
              ? "Describe what was difficult in the video..."
              : "Beschreibe, was im Video schwierig war..."
            : english
              ? `Tell DogOS what happened with ${product.dogName}...`
              : `Erzähl DogOS, was mit ${product.dogName} passiert ist...`;

  useEffect(() => {
    const query = historyQuery.trim();
    if (query.length < 2) {
      return;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setSearching(true);
      void (async () => {
        try {
          const parameters = new URLSearchParams({
            dogId: product.dogId,
            limit: "20",
            query,
          });
          const response = await fetch(
            dogosApiUrl(`/v1/search?${parameters}`),
            {
              cache: "no-store",
              headers: await dogosApiHeaders(),
              signal: controller.signal,
            },
          );
          if (!response.ok) throw new Error("SEARCH_UNAVAILABLE");
          const body = (await response.json()) as { results: SearchResult[] };
          setSearchResults(body.results);
        } catch {
          if (!controller.signal.aborted) setSearchResults([]);
        } finally {
          if (!controller.signal.aborted) setSearching(false);
        }
      })();
    }, 180);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [historyQuery, product.dogId]);

  useEffect(() => {
    viewport.current?.scrollTo({
      behavior: "smooth",
      top: viewport.current.scrollHeight,
    });
  }, [activePanel, messages, status]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("dogos-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (deepLinkSent.current) return;
    const url = new URL(window.location.href);
    const prompt = url.searchParams.get("prompt")?.trim();
    if (prompt === undefined || prompt.length === 0) return;
    deepLinkSent.current = true;
    url.searchParams.delete("prompt");
    window.history.replaceState({}, "", `${url.pathname}${url.search}`);
    void sendMessage({ text: prompt.slice(0, 500) });
  }, [sendMessage]);

  async function submit(text = input) {
    const value = text.trim();
    if (value.length === 0 || busy) return;
    setInput("");
    await sendMessage({ text: value });
  }

  function showStatus(value: string) {
    setShareMessage(value);
    window.setTimeout(() => setShareMessage(null), 2200);
  }

  async function shareWorkspace() {
    const shareData = {
      title: "DogOS Coach",
      url: window.location.href,
    };
    try {
      if (navigator.share !== undefined) {
        await navigator.share(shareData);
        showStatus(english ? "Shared" : "Geteilt");
      } else {
        await navigator.clipboard.writeText(shareData.url);
        showStatus(english ? "Link copied" : "Link kopiert");
      }
    } catch {
      showStatus(english ? "Could not share" : "Teilen nicht möglich");
    }
  }

  const hasHistory = messages.length > 0;
  const trainingState = trainingActionState(product);
  const trainingAllowed = trainingState === "ready";
  const conversationChapters = messages
    .filter((message) => message.role === "user")
    .reduce<
      Array<{
        href: string;
        id: string;
        label: string;
        meta: string;
        search: string;
      }>
    >((chapters, message, index) => {
      const text = textOf(message);
      const title = chapterTitle(text, english);
      const previous = chapters.at(-1);
      if (previous?.label.toLowerCase() === title.toLowerCase()) {
        previous.search = `${previous.search} ${text}`;
        return chapters;
      }
      chapters.push({
        href: `#message-${message.id}`,
        id: message.id,
        label: title,
        meta:
          index === 0
            ? english
              ? "Latest topic"
              : "Aktuelles Thema"
            : english
              ? "Conversation"
              : "Gespräch",
        search: text,
      });
      return chapters;
    }, [])
    .slice(-6)
    .reverse();
  const trainingEntries = product.calendar.slice(0, 6).map((session) => ({
    href: `/app/coach?space=train&session=${session.id}`,
    id: session.id,
    label: session.isRecovery
      ? english
        ? "Recovery observation"
        : "Beobachtungstag"
      : presentation.title,
    meta: `${sessionLabel(session.plannedStart, english)} · ${Math.ceil(session.durationSeconds / 60)} Min.`,
    search: `${session.status} ${session.purposeCode} ${presentation.title}`,
  }));
  const filterNavigationEntries = <
    T extends { label: string; meta: string; search: string },
  >(
    entries: T[],
  ) => {
    const query = historyQuery.trim().toLowerCase();
    if (query.length === 0) return entries;
    return entries.filter((entry) =>
      `${entry.label} ${entry.meta} ${entry.search}`
        .toLowerCase()
        .includes(query),
    );
  };
  const filteredConversationChapters =
    filterNavigationEntries(conversationChapters);
  const filteredTrainingEntries = filterNavigationEntries(trainingEntries);
  const durableSearchActive = historyQuery.trim().length >= 2;
  const visibleSearchResults = durableSearchActive ? searchResults : [];
  const navigatorEntries = messages
    .filter((message) => textOf(message).trim().length > 0)
    .slice(-18)
    .map((message, index) => ({
      href: `#message-${message.id}`,
      id: message.id,
      label: historyLabel(
        textOf(message),
        message.role === "user"
          ? english
            ? "Your message"
            : "Deine Nachricht"
          : "DogOS",
      ),
      role: message.role,
      step: index + 1,
    }));
  const quickActions = [
    {
      action: () => router.push("/app/coach?space=plan"),
      icon: Route,
      id: "plan",
      label: "Plan",
    },
    {
      action: () =>
        trainingAllowed
          ? router.push(
              `/app/coach?space=train&session=${product.todaySessionId}`,
            )
          : router.push("/app/coach?space=train"),
      icon: Clock3,
      id: "train",
      label: english ? "Train" : "Training",
    },
    {
      action: () => router.push("/app/coach?space=progress"),
      icon: Target,
      id: "progress",
      label: english ? "Progress" : "Fortschritt",
    },
    {
      icon: Video,
      id: "live",
      label: "Live",
      action: () => {
        setActivePanel("live");
        router.push("/app/coach?space=media&action=start-live");
      },
    },
  ] as const;
  const heldCopy = heldTrainingCopy(trainingState, english);
  return (
    <div
      className="coach-shell"
      data-mobile-drawer={mobileDrawerOpen ? "open" : "closed"}
      data-sidebar={sidebarOpen ? "open" : "closed"}
      data-theme={theme}
    >
      <aside className="coach-sidebar" aria-label="DogOS navigation">
        <div className="sidebar-brand">
          <span className="coach-mark">D</span>
          <strong>DogOS</strong>
          <button
            aria-label={
              english ? "Collapse sidebar" : "Seitenleiste einklappen"
            }
            className="sidebar-icon-button"
            onClick={() => setSidebarOpen(false)}
            type="button"
          >
            <PanelLeftClose size={18} />
          </button>
        </div>
        <Link className="new-chat-link" href="/app/coach">
          <Sparkles size={16} />
          {english ? "New topic" : "Neues Thema"}
        </Link>
        <label className="sidebar-search">
          <Search size={15} />
          <input
            aria-label={english ? "Search history" : "Verlauf suchen"}
            onChange={(event) => setHistoryQuery(event.target.value)}
            placeholder={english ? "Search" : "Suchen"}
            value={historyQuery}
          />
        </label>
        <section className="sidebar-section">
          <span>{english ? "Conversations" : "Gespräche"}</span>
          {durableSearchActive ? (
            <DurableSearchResults
              english={english}
              onNavigate={() => setMobileDrawerOpen(false)}
              results={visibleSearchResults}
              searching={searching}
            />
          ) : filteredConversationChapters.length === 0 ? (
            <p>{english ? "No topics found" : "Keine Themen gefunden"}</p>
          ) : (
            filteredConversationChapters.map((entry) => (
              <a href={entry.href} key={entry.id}>
                <strong>{entry.label}</strong>
                <small>{entry.meta}</small>
              </a>
            ))
          )}
        </section>
        <section className="sidebar-section">
          <span>{english ? "Training plan" : "Trainingsplan"}</span>
          <Link href="/app/coach?space=plan">
            <strong>{english ? "Current plan" : "Aktueller Plan"}</strong>
            <small>{presentation.stage}</small>
          </Link>
          <Link href="/app/coach?space=progress">
            <strong>{english ? "Progress" : "Fortschritt"}</strong>
            <small>
              {product.baselineSuccessRate}% → {product.targetSuccessRate ?? 80}
              %
            </small>
          </Link>
          {filteredTrainingEntries.map((entry) => (
            <Link href={entry.href} key={entry.id}>
              <strong>{entry.label}</strong>
              <small>{entry.meta}</small>
            </Link>
          ))}
          <Link
            href="/app/coach?space=media&action=upload-video"
            onClick={() => setActivePanel("video")}
          >
            <strong>{english ? "Video analysis" : "Videoanalyse"}</strong>
            <small>
              {english ? "Upload and review" : "Upload und Prüfung"}
            </small>
          </Link>
          <Link
            href="/app/coach?space=media&action=start-live"
            onClick={() => setActivePanel("live")}
          >
            <strong>{english ? "Live session" : "Live Session"}</strong>
            <small>{english ? "Camera session" : "Kamera-Session"}</small>
          </Link>
        </section>
        <div className="sidebar-account">
          <button onClick={() => setActivePanel("profile")} type="button">
            <CircleUserRound size={17} />
            {english ? "Profile" : "Profil"}
          </button>
          <button onClick={() => setActivePanel("settings")} type="button">
            <Settings size={17} />
            Settings
          </button>
          <button onClick={() => setActivePanel("billing")} type="button">
            <CreditCard size={17} />
            Billing
          </button>
        </div>
      </aside>

      {mobileDrawerOpen ? (
        <div className="mobile-drawer" role="dialog" aria-label="DogOS Menü">
          <button
            aria-label={english ? "Close menu" : "Menü schliessen"}
            className="mobile-drawer-backdrop"
            onClick={() => setMobileDrawerOpen(false)}
            type="button"
          />
          <div className="mobile-drawer-panel">
            <div className="sidebar-brand">
              <span className="coach-mark">D</span>
              <strong>DogOS</strong>
              <button
                aria-label={english ? "Close menu" : "Menü schliessen"}
                className="sidebar-icon-button"
                onClick={() => setMobileDrawerOpen(false)}
                type="button"
              >
                <X size={18} />
              </button>
            </div>
            <label className="sidebar-search">
              <Search size={15} />
              <input
                aria-label={english ? "Search history" : "Verlauf suchen"}
                onChange={(event) => setHistoryQuery(event.target.value)}
                placeholder={english ? "Search" : "Suchen"}
                value={historyQuery}
              />
            </label>
            <section className="sidebar-section">
              <span>{english ? "Conversations" : "Gespräche"}</span>
              {durableSearchActive ? (
                <DurableSearchResults
                  english={english}
                  onNavigate={() => setMobileDrawerOpen(false)}
                  results={visibleSearchResults}
                  searching={searching}
                />
              ) : (
                filteredConversationChapters.map((entry) => (
                  <a
                    href={entry.href}
                    key={entry.id}
                    onClick={() => setMobileDrawerOpen(false)}
                  >
                    <strong>{entry.label}</strong>
                    <small>{entry.meta}</small>
                  </a>
                ))
              )}
            </section>
            <section className="sidebar-section">
              <span>{english ? "Training plan" : "Trainingsplan"}</span>
              <Link
                href="/app/coach?space=plan"
                onClick={() => setMobileDrawerOpen(false)}
              >
                <strong>{english ? "Current plan" : "Aktueller Plan"}</strong>
                <small>{presentation.stage}</small>
              </Link>
              <Link
                href="/app/coach?space=progress"
                onClick={() => setMobileDrawerOpen(false)}
              >
                <strong>{english ? "Progress" : "Fortschritt"}</strong>
                <small>
                  {product.baselineSuccessRate}% →{" "}
                  {product.targetSuccessRate ?? 80}%
                </small>
              </Link>
              {filteredTrainingEntries.map((entry) => (
                <Link
                  href={entry.href}
                  key={entry.id}
                  onClick={() => setMobileDrawerOpen(false)}
                >
                  <strong>{entry.label}</strong>
                  <small>{entry.meta}</small>
                </Link>
              ))}
              <Link
                href="/app/coach?space=media&action=upload-video"
                onClick={() => {
                  setActivePanel("video");
                  setMobileDrawerOpen(false);
                }}
              >
                <strong>{english ? "Video analysis" : "Videoanalyse"}</strong>
                <small>
                  {english ? "Upload and review" : "Upload und Prüfung"}
                </small>
              </Link>
              <Link
                href="/app/coach?space=media&action=start-live"
                onClick={() => {
                  setActivePanel("live");
                  setMobileDrawerOpen(false);
                }}
              >
                <strong>{english ? "Live session" : "Live Session"}</strong>
                <small>{english ? "Camera session" : "Kamera-Session"}</small>
              </Link>
            </section>
            <div className="sidebar-account">
              <button
                onClick={() => {
                  setActivePanel("profile");
                  setMobileDrawerOpen(false);
                }}
                type="button"
              >
                <CircleUserRound size={17} />
                {english ? "Profile" : "Profil"}
              </button>
              <button
                onClick={() => {
                  setActivePanel("billing");
                  setMobileDrawerOpen(false);
                }}
                type="button"
              >
                <CreditCard size={17} />
                Billing
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <main className="coach-main">
        <header className="coach-header">
          <div className="coach-identity">
            <button
              aria-label={english ? "Open menu" : "Menü öffnen"}
              className="icon-link mobile-menu-button"
              onClick={() => setMobileDrawerOpen(true)}
              type="button"
            >
              <PanelLeftOpen size={20} />
            </button>
            <button
              aria-label={english ? "Open sidebar" : "Seitenleiste öffnen"}
              className="icon-link sidebar-toggle-main desktop-only"
              onClick={() => setSidebarOpen(true)}
              type="button"
            >
              <PanelLeftOpen size={20} />
            </button>
            <span className="coach-mark">D</span>
            <div>
              <strong>
                {english
                  ? `${product.dogName}'s Coach`
                  : `${product.dogName}s Coach`}
              </strong>
              <span>
                {product.goalText} · {presentation.stage} ·{" "}
                {product.baselineSuccessRate}% →{" "}
                {product.targetSuccessRate ?? 80}%
              </span>
            </div>
          </div>
          <div className="coach-header-actions">
            <button
              aria-label={english ? "Share coach" : "Coach teilen"}
              className="icon-link desktop-header-action"
              onClick={() => void shareWorkspace()}
              type="button"
            >
              <Share2 size={19} />
            </button>
            <button
              aria-pressed={theme === "dark"}
              className="icon-link desktop-header-action"
              type="button"
              aria-label={theme === "dark" ? "Light theme" : "Dark theme"}
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            <button
              aria-expanded={menuOpen}
              aria-label={english ? "Coach menu" : "Coach Menü"}
              className="icon-link"
              onClick={() => setMenuOpen((open) => !open)}
              type="button"
            >
              <MoreHorizontal size={20} />
            </button>
            {menuOpen ? (
              <div className="coach-menu-popover">
                <button
                  onClick={() => {
                    setActivePanel("files");
                    setMenuOpen(false);
                  }}
                  type="button"
                >
                  <FileText size={17} />
                  {english ? "Show files in chat" : "Dateien im Chat anzeigen"}
                </button>
                <button
                  onClick={() => {
                    setChatPinned((pinned) => !pinned);
                    showStatus(
                      chatPinned
                        ? english
                          ? "Chat unpinned"
                          : "Chat gelöst"
                        : english
                          ? "Chat pinned"
                          : "Chat angeheftet",
                    );
                    setMenuOpen(false);
                  }}
                  type="button"
                >
                  <Pin size={17} />
                  {chatPinned
                    ? english
                      ? "Unpin chat"
                      : "Chat lösen"
                    : english
                      ? "Pin chat"
                      : "Chat anheften"}
                </button>
                <button
                  onClick={() => {
                    setChatArchived(true);
                    showStatus(english ? "Chat archived" : "Chat archiviert");
                    setMenuOpen(false);
                  }}
                  type="button"
                >
                  <Archive size={17} />
                  {english ? "Archive" : "Archivieren"}
                </button>
                <button
                  className="danger"
                  onClick={() => {
                    setActivePanel("delete");
                    setMenuOpen(false);
                  }}
                  type="button"
                >
                  <Trash2 size={17} />
                  {english ? "Delete" : "Löschen"}
                </button>
              </div>
            ) : null}
            {shareMessage === null ? null : (
              <span className="share-status">{shareMessage}</span>
            )}
          </div>
        </header>

        <div className="coach-messages" ref={viewport} aria-live="polite">
          {chatPinned || chatArchived ? (
            <div className="chat-state-banner">
              {chatPinned ? (
                <span>
                  <Pin size={14} />
                  {english ? "Pinned" : "Angeheftet"}
                </span>
              ) : null}
              {chatArchived ? (
                <span>
                  <Archive size={14} />
                  {english ? "Archived" : "Archiviert"}
                </span>
              ) : null}
            </div>
          ) : null}
          {chatDeleted ? (
            <section className="chat-inline-panel">
              <div className="inline-panel-header">
                <span>{english ? "Chat deleted" : "Chat gelöscht"}</span>
              </div>
              <div className="inline-panel-body">
                <p>
                  {english
                    ? "This local chat view is hidden. Start a new topic or use History to reopen durable records."
                    : "Diese lokale Chatansicht ist ausgeblendet. Starte ein neues Thema oder öffne dauerhafte Einträge über den Verlauf."}
                </p>
                <Link className="button primary" href="/app/coach">
                  {english ? "New topic" : "Neues Thema"}
                </Link>
              </div>
            </section>
          ) : null}
          {!hasHistory && !chatDeleted ? (
            <div className="coach-welcome">
              <span className="coach-avatar">D</span>
              <div className="message-bubble assistant">
                <p>
                  {english
                    ? `I coach you and ${product.dogName} through the training. Tell me what happened today or what you want to improve next.`
                    : `Ich begleite dich und ${product.dogName} im Training. Erzähl mir, was heute passiert ist oder was du als Nächstes verbessern möchtest.`}
                </p>
              </div>
            </div>
          ) : null}

          {chatDeleted
            ? null
            : messages.map((message) => {
                const text = textOf(message);
                if (text.length === 0) return null;
                const { body, sources } = splitSources(text, locale);
                return (
                  <article
                    className={`coach-message ${message.role}`}
                    id={`message-${message.id}`}
                    key={message.id}
                  >
                    <div
                      className={
                        message.role === "assistant"
                          ? "assistant-response"
                          : "message-bubble user"
                      }
                    >
                      {body.split("\n").map((line, index) => (
                        <p key={`${message.id}:${index}`}>{line || "\u00a0"}</p>
                      ))}
                      {sources.length === 0 ? null : (
                        <details className="source-disclosure">
                          <summary>
                            {english
                              ? `${sources.length} references and plan facts`
                              : `${sources.length} Referenzen und Planfakten`}
                          </summary>
                          <ul>
                            {sources.map((source, sourceIndex) => (
                              <li key={`${message.id}:source:${sourceIndex}`}>
                                {source}
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </div>
                  </article>
                );
              })}

          {!chatDeleted &&
          activeSpace !== "media" &&
          ["plan", "train", "progress"].includes(activeSpace) ? (
            <InlineSpaceSummary
              activeSpace={activeSpace}
              english={english}
              product={product}
            />
          ) : null}

          {!chatDeleted && trainingAllowed ? (
            <section className="inline-training-card">
              <div className="inline-card-heading">
                <span>
                  {english
                    ? `Today with ${product.dogName}`
                    : `Heute mit ${product.dogName}`}
                </span>
                <em>{english ? "Ready" : "Bereit"}</em>
                <strong>{presentation.title}</strong>
              </div>
              <div className="inline-card-meta">
                <span>
                  <Clock3 size={15} /> {duration} Min.
                </span>
                <span>
                  <Target size={15} /> {product.currentStep?.repetitions ?? 6}{" "}
                  {presentation.unit}
                </span>
              </div>
              <p>{presentation.instruction(product.dogName)}</p>
              <small>
                {english
                  ? `Why this: ${product.sessionCount} sessions; ${trainingDecisionLabel(product.latestDecision, english)}.`
                  : `Warum: ${product.sessionCount} Einheiten; ${trainingDecisionLabel(product.latestDecision, english)}.`}
              </small>
              <div className="inline-card-actions">
                <Link
                  className="button primary"
                  href={`/app/coach?space=train&session=${product.todaySessionId}`}
                >
                  {english ? "Start training" : "Training starten"}
                </Link>
                <Link className="text-link inline" href="/app/coach?space=plan">
                  {english ? "View plan" : "Plan ansehen"}
                </Link>
              </div>
            </section>
          ) : !chatDeleted ? (
            <section className="inline-training-card held">
              <div className="inline-card-heading">
                <span>{heldCopy.label}</span>
                <em>{heldCopy.status}</em>
                <strong>{heldCopy.title}</strong>
              </div>
              <p>{heldCopy.body}</p>
            </section>
          ) : null}

          {activePanel === null ? null : (
            <InlineWorkspacePanel
              chatArchived={chatArchived}
              english={english}
              kind={activePanel}
              onArchive={() => {
                setChatArchived(true);
                setActivePanel(null);
                showStatus(english ? "Chat archived" : "Chat archiviert");
              }}
              onClose={() => setActivePanel(null)}
              onDelete={() => {
                setChatDeleted(true);
                setActivePanel(null);
                showStatus(english ? "Chat deleted" : "Chat gelöscht");
              }}
              onOpenVideo={() => setActivePanel("video")}
              product={product}
            />
          )}

          {busy ? (
            <div className="coach-message assistant">
              <span className="coach-avatar">D</span>
              <div className="typing-indicator" aria-label="DogOS antwortet">
                <i /> <i /> <i />
              </div>
            </div>
          ) : null}
          {error === undefined ? null : (
            <p className="coach-error">
              Die Antwort ist fehlgeschlagen. Deine Nachricht bleibt erhalten.
            </p>
          )}
        </div>

        {!hasHistory ? (
          <div className="coach-suggestions">
            <button onClick={() => submit("Was trainieren wir heute?")}>
              {english ? "Today's training" : "Heutiges Training"}
            </button>
            <button
              onClick={() =>
                submit(
                  english
                    ? `Explain ${product.dogName}'s current plan.`
                    : `Erkläre mir ${product.dogName}s aktuellen Plan.`,
                )
              }
            >
              {english ? "Explain plan" : "Plan erklären"}
            </button>
            <button
              onClick={() =>
                submit(
                  english
                    ? `I want to share an observation about ${product.dogName}.`
                    : `Ich möchte eine Beobachtung zu ${product.dogName} teilen.`,
                )
              }
            >
              {english ? "Share observation" : "Beobachtung teilen"}
            </button>
          </div>
        ) : null}

        <div className="composer-quick-actions" aria-label="Coach actions">
          {quickActions.map(({ action, icon: Icon, id, label }) => (
            <button
              aria-pressed={activeSpace === id}
              key={id}
              onClick={() => void action()}
              type="button"
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>

        <form
          className="coach-composer"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <Link
            aria-label={
              english ? "Upload training video" : "Trainingsvideo hochladen"
            }
            className="composer-tool"
            href="#video"
            onClick={(event) => {
              event.preventDefault();
              setActivePanel("video");
            }}
            title={
              english
                ? "Video analysis is available on paid plans."
                : "Videoanalyse ist in bezahlten Tarifen verfügbar."
            }
          >
            <Plus size={19} />
          </Link>
          <textarea
            aria-label={english ? "Message DogOS" : "Nachricht an DogOS"}
            maxLength={2_000}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void submit();
              }
            }}
            placeholder={placeholder}
            rows={1}
            value={input}
          />
          <button
            aria-label={
              english ? "Voice note not available yet" : "Sprachnotiz folgt"
            }
            className="composer-tool optional"
            disabled
            title={
              english
                ? "Voice notes are not enabled in this pilot yet."
                : "Sprachnotizen sind in diesem Pilot noch nicht aktiv."
            }
            type="button"
          >
            <Mic size={18} />
          </button>
          <Link
            aria-label={
              english ? "Start live video coaching" : "Live Video starten"
            }
            className="composer-tool optional"
            href="#live"
            onClick={(event) => {
              event.preventDefault();
              setActivePanel("live");
            }}
            title={
              english
                ? "Live video coaching requires Pro or Ultra."
                : "Live Video Coaching erfordert Pro oder Ultra."
            }
          >
            <Camera size={18} />
          </Link>
          {busy ? (
            <button aria-label="Antwort stoppen" onClick={stop} type="button">
              <span className="stop-square" />
            </button>
          ) : (
            <button
              aria-label="Senden"
              disabled={input.trim().length === 0}
              type="submit"
            >
              <Send size={19} />
            </button>
          )}
        </form>
        <div className="coach-disclosure">
          <Sparkles size={12} />{" "}
          {english
            ? "AI-assisted · not diagnosis or emergency care"
            : "KI-gestützt · keine Diagnose oder Notfallhilfe"}
        </div>
        {navigatorEntries.length < 2 ? null : (
          <nav
            aria-label={english ? "Message navigator" : "Nachrichten-Navigator"}
            className="message-navigator"
          >
            {navigatorEntries.map((entry) => (
              <a
                aria-label={`${entry.step}. ${entry.label}`}
                className={entry.role}
                href={entry.href}
                key={entry.id}
              >
                <span>{entry.label}</span>
              </a>
            ))}
          </nav>
        )}
      </main>
    </div>
  );
}
