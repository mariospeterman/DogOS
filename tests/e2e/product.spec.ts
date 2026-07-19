import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

import { expect, type APIRequestContext, test } from "@playwright/test";

const api = "http://127.0.0.1:4200";
const screenshots = resolve("test-results/chat-first-pwa/screenshots");
const headers = (key: string, user = "owner") => ({
  "x-dogos-user": user,
  "idempotency-key": key,
});

async function reset(
  request: APIRequestContext,
  locale: "de-CH" | "en" = "de-CH",
) {
  const response = await request.post(`${api}/v1/local/reset`, {
    headers: headers(`reset-${locale}-${crypto.randomUUID()}`),
    data: { locale },
  });
  expect(response.ok()).toBeTruthy();
}

test.beforeAll(async () => {
  await mkdir(screenshots, { recursive: true });
});

test("scenario 1: German low-risk owner reaches the chat-first coach", async ({
  page,
  request,
}, testInfo) => {
  await reset(request);
  await page.goto("/app/coach", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Rexs Coach")).toBeVisible();
  await expect(
    page.getByRole("main").getByText("Lockere Leine im ruhigen Abschnitt"),
  ).toBeVisible();
  await page.getByLabel("Nachricht an DogOS").fill("Warum dieser Block?");
  await page.getByLabel("Nachricht an DogOS").press("Enter");
  await expect(
    page.getByRole("article").getByText("Warum dieser Block?", {
      exact: true,
    }),
  ).toBeVisible();
  if (testInfo.project.name === "chromium")
    await page.screenshot({
      path: resolve(screenshots, "coach-flow.png"),
      fullPage: true,
    });
  await expect(page.getByText("Training starten")).toBeVisible();
});

test("scenario 2: English owner remains in Switzerland and CHF", async ({
  request,
}) => {
  await reset(request, "en");

  const state = await request.get(`${api}/v1/dogs/dog-1/current-plan`, {
    headers: { "x-dogos-user": "owner" },
  });
  expect(await state.json()).toMatchObject({
    locale: "en",
    country: "CH",
    currency: "CHF",
  });
});

test("scenario 3: three qualifying sessions increase difficulty", async ({
  request,
}) => {
  await reset(request);
  let result: Record<string, unknown> = {};
  for (let index = 1; index <= 3; index += 1) {
    const response = await request.post(
      `${api}/v1/sessions/session-${index}/complete`,
      {
        headers: headers(`improve-${index}`),
        data: { success: 85, foodAccepted: true },
      },
    );
    result = await response.json();
  }
  expect(result).toMatchObject({
    difficulty: 2,
    latestDecision: "increase_difficulty",
  });
});

test("scenario 4: food refusal and avoidance reduce autonomous work without diagnosis", async ({
  request,
  page,
}) => {
  await reset(request);
  for (let index = 1; index <= 3; index += 1)
    await request.post(`${api}/v1/sessions/pre-${index}/complete`, {
      headers: headers(`regression-prerequisite-${index}`),
      data: { success: 85, foodAccepted: true },
    });
  const response = await request.post(`${api}/v1/sessions/session-1/complete`, {
    headers: headers("regression-1"),
    data: { success: 20, foodAccepted: false, avoidance: true },
  });
  expect(await response.json()).toMatchObject({
    difficulty: 1,
    latestDecision: "reduce_difficulty",
    safety: "stop_training",
  });
  await page.goto("/app/today", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "Rex / Heute" }),
  ).toBeVisible();
  await expect(
    page.getByText("Futterverweigerung, Meiden, Schmerzzeichen"),
  ).not.toBeVisible();
  await expect(
    page.getByText("Neue Beobachtung zu Rex", { exact: false }),
  ).toBeVisible();
  await page.goto("/app/coach", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Training gestoppt")).toBeVisible();
  await expect(page.getByText("Training starten")).not.toBeVisible();
  await expect(page.getByText("Zuerst fachlich abklären")).not.toBeVisible();
});

test("scenario 5: suspected pain blocks further session starts", async ({
  request,
  page,
}, testInfo) => {
  await reset(request);
  await request.post(`${api}/v1/dogs/dog-1/safety-assessments`, {
    headers: headers("pain-1"),
    data: { kind: "pain" },
  });
  const blocked = await request.post(
    `${api}/v1/scheduled-sessions/session-2/start`,
    {
      headers: headers("pain-start"),
      data: {},
    },
  );
  expect(blocked.status()).toBe(409);
  expect((await blocked.json()).error.code).toBe("SAFETY_REVIEW_REQUIRED");
  await page.goto("/app/referral/referral-1", {
    waitUntil: "domcontentloaded",
  });
  await expect(
    page.getByRole("heading", {
      name: "Beobachtung professionell einordnen lassen",
    }),
  ).toBeVisible();
  if (testInfo.project.name === "chromium")
    await page.screenshot({
      path: resolve(screenshots, "safety-escalation.png"),
    });
});

test("scenario 6: child-involved bite blocks plan generation", async ({
  request,
}) => {
  await reset(request);
  await request.post(`${api}/v1/dogs/dog-1/safety-assessments`, {
    headers: headers("bite-1"),
    data: { kind: "child_bite" },
  });
  const blocked = await request.post(`${api}/v1/goals/goal-1/generate-plan`, {
    headers: headers("bite-plan"),
    data: {},
  });
  expect(blocked.status()).toBe(409);
  expect((await blocked.json()).error.code).toBe("PLAN_GENERATION_BLOCKED");
});

test("scenario 7: role permissions fail closed", async ({ request }) => {
  await reset(request);
  const caregiver = await request.post(
    `${api}/v1/sessions/session-1/complete`,
    {
      headers: headers("role-caregiver", "caregiver"),
      data: { success: 60, foodAccepted: true },
    },
  );
  const viewer = await request.post(`${api}/v1/sessions/session-1/complete`, {
    headers: headers("role-viewer", "viewer"),
    data: { success: 60, foodAccepted: true },
  });
  const trainer = await request.get(`${api}/v1/dogs/shared-case`, {
    headers: { "x-dogos-user": "trainer" },
  });
  const unrelated = await request.get(`${api}/v1/dogs/dog-1`, {
    headers: { "x-dogos-user": "unrelated" },
  });
  expect(caregiver.ok()).toBeTruthy();
  expect(viewer.status()).toBe(403);
  expect(trainer.ok()).toBeTruthy();
  expect(unrelated.status()).toBe(403);
});

test("scenario 8: signed links enforce expiry, replay, and household binding", async ({
  request,
}) => {
  await reset(request);
  const issue = async (key: string, oneTime = false, ttlSeconds = 60) =>
    (
      await (
        await request.post(`${api}/v1/signed-actions`, {
          headers: headers(key),
          data: {
            purpose: "open_session",
            householdId: "household-a",
            subjectId: "session-a",
            oneTime,
            ttlSeconds,
          },
        })
      ).json()
    ).token as string;
  const resolveAction = (
    token: string,
    householdId = "household-a",
    consume = false,
  ) =>
    request.post(`${api}/v1/signed-actions/resolve`, {
      headers: { "x-dogos-user": "owner" },
      data: {
        token,
        purpose: "open_session",
        householdId,
        subjectId: "session-a",
        consume,
      },
    });
  expect((await resolveAction(await issue("signed-valid"))).ok()).toBeTruthy();
  const wrong = await resolveAction(await issue("signed-wrong"), "household-b");
  expect(wrong.status()).toBe(400);
  const once = await issue("signed-once", true);
  expect((await resolveAction(once, "household-a", true)).ok()).toBeTruthy();
  expect((await resolveAction(once, "household-a", true)).status()).toBe(409);
  const expired = await issue("signed-expired", false, 1);
  await new Promise((resolve) => setTimeout(resolve, 1_100));
  expect((await resolveAction(expired)).status()).toBe(400);
});

test("scenario 9: duplicate commands create one result", async ({
  request,
}) => {
  await reset(request);
  const options = {
    headers: headers("duplicate-checkin"),
    data: { success: 75, foodAccepted: true },
  };
  const first = await request.post(
    `${api}/v1/sessions/session-1/complete`,
    options,
  );
  const duplicate = await request.post(
    `${api}/v1/sessions/session-1/complete`,
    options,
  );
  expect((await first.json()).sessions).toHaveLength(1);
  expect((await duplicate.json()).sessions).toHaveLength(1);
  expect(duplicate.headers()["x-idempotent-replay"]).toBe("true");
  const adjustment = {
    headers: headers("duplicate-adjustment"),
    data: { expectedVersion: 1 },
  };
  const adjusted = await request.post(
    `${api}/v1/plans/plan-1/adjust`,
    adjustment,
  );
  const duplicateAdjustment = await request.post(
    `${api}/v1/plans/plan-1/adjust`,
    adjustment,
  );
  expect((await adjusted.json()).planVersion).toBe(2);
  expect((await duplicateAdjustment.json()).planVersion).toBe(2);
});

test("scenario 10: language switch preserves account and workflow", async ({
  request,
}) => {
  await reset(request);
  const response = await request.post(`${api}/v1/account/locale`, {
    headers: headers("language-switch"),
    data: { locale: "en" },
  });
  expect(await response.json()).toMatchObject({
    locale: "en",
    country: "CH",
    currency: "CHF",
    timezone: "Europe/Zurich",
    workflowState: "plan_ready",
    audit: [expect.objectContaining({ action: "locale.switched" })],
  });
});

test("public account creation is available without a provider simulator", async ({
  page,
}) => {
  await page.goto("/auth/sign-up?next=%2Fapp%2Fcoach");
  await expect(
    page.getByRole("heading", { name: "Konto erstellen" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Starten" })).toBeVisible();
  const simulator = await page.goto("/simulator");
  expect(simulator?.status()).toBe(404);
});

test("chat-first Coach and management views remain one PWA", async ({
  page,
}, testInfo) => {
  await page.goto("/app/coach");
  await expect(page).toHaveURL(/\/app\/coach$/);
  await expect(page.getByText("Rexs Coach")).toBeVisible();
  if (testInfo.project.name === "chromium") {
    await expect(
      page.getByRole("complementary", { name: "DogOS navigation" }),
    ).toBeVisible();
    await expect(page.getByLabel("Verlauf suchen")).toBeVisible();
    await page.getByLabel("Nachricht an DogOS").fill("echo ist die beste");
    await page.getByLabel("Nachricht an DogOS").press("Enter");
    await expect(
      page.getByRole("article").getByText("echo ist die beste"),
    ).toBeVisible();
    await page.getByLabel("Verlauf suchen").fill("beste");
    await expect(
      page
        .getByRole("complementary", { name: "DogOS navigation" })
        .getByText("echo ist die beste"),
    ).toBeVisible();
    await page.getByLabel("Verlauf suchen").fill("");
    await page.getByLabel("Seitenleiste einklappen").click();
    await expect(page.getByLabel("Seitenleiste öffnen")).toBeVisible();
    await page.getByLabel("Seitenleiste öffnen").click();
    await expect(page.getByLabel("Verlauf suchen")).toBeVisible();
  }
  if (testInfo.project.name === "chromium") {
    for (const name of ["Plan", "Training", "Fortschritt", "Live"]) {
      await expect(
        page.getByRole("button", { name, exact: true }),
      ).not.toBeVisible();
    }
    await expect(
      page.getByRole("link", { name: /Aktueller Plan/ }),
    ).toBeVisible();
  } else {
    for (const name of ["Plan", "Training", "Fortschritt"]) {
      await expect(
        page.getByRole("button", { name, exact: true }),
      ).toBeVisible();
    }
  }
  if (testInfo.project.name === "chromium") {
    await expect(page.getByLabel("Coach teilen")).toBeVisible();
  }
  await page.getByLabel("Coach Menü").click();
  await expect(page.getByText("Dateien im Chat anzeigen")).toBeVisible();
  await expect(page.getByText("Chat anheften")).toBeVisible();
  await expect(page.getByText("Archivieren")).toBeVisible();
  await expect(page.getByText("Löschen")).toBeVisible();
  await page.getByRole("button", { name: "Dateien im Chat anzeigen" }).click();
  await expect(page.getByText("Dateien im Chat")).toBeVisible();
  await page.getByLabel("Panel schliessen").click();
  await page.getByLabel("Coach Menü").click();
  await page.getByRole("button", { name: "Chat anheften" }).click();
  await expect(
    page.locator(".chat-state-banner").getByText("Angeheftet"),
  ).toBeVisible();
  await page.getByLabel("Coach Menü").click();
  await page.getByRole("button", { name: "Archivieren" }).click();
  await expect(
    page.locator(".chat-state-banner").getByText("Archiviert"),
  ).toBeVisible();
  await page.getByLabel("Coach Menü").click();
  await page.getByRole("button", { name: "Löschen" }).click();
  await expect(
    page.locator("#delete .inline-panel-header").getByText("Chat löschen"),
  ).toBeVisible();
  await page.getByLabel("Panel schliessen").click();
  await expect(page.getByLabel("Trainingsvideo hochladen")).toBeVisible();
  await page.getByLabel("Trainingsvideo hochladen").click();
  await expect(page.getByText("Trainingsvideo analysieren")).toBeVisible();
  await page.getByLabel("Panel schliessen").click();
  if (testInfo.project.name === "chromium") {
    await expect(page.getByLabel("Live Video starten")).toHaveCount(0);
    await expect(page.getByLabel("Sprachnotiz folgt")).toBeDisabled();
  }
  await page.goto("/app/plan");
  await expect(page).toHaveURL(/\/app\/coach\?space=plan/);
  if (testInfo.project.name !== "chromium") {
    await expect(
      page.getByRole("button", { exact: true, name: "Plan" }),
    ).toHaveAttribute("aria-pressed", "true");
  }
  await page.goto("/app/video");
  await expect(page).toHaveURL(/\/app\/coach\?action=upload-video/);
  await expect(page.getByText("Trainingsvideo analysieren")).toBeVisible();
  await page.goto("/app/live");
  await expect(page).toHaveURL(/\/app\/coach$/);
});

test("account language follows conversation without a selector", async ({
  page,
}) => {
  await page.goto("/app/account");
  await expect(page).toHaveURL(/\/app\/coach\?action=profile/);
  await expect(page.locator("#profile").getByText("Profil")).toBeVisible();
  await expect(page.getByRole("combobox", { name: /Sprache/ })).toHaveCount(0);
  await expect(
    page.getByText("Land und Währung", { exact: false }),
  ).toBeVisible();
});

test("calendar renders the canonical schedule without fake booking controls", async ({
  page,
}) => {
  await page.goto("/app/calendar");
  const firstSession = page.locator(
    '.calendar-list a[href="/app/session/session-1"]',
  );
  await expect(firstSession).toHaveCount(1);
  await expect(firstSession).toContainText("Mikrotraining");
  const observation = page.locator('.calendar-list a[href="/app/progress"]');
  await expect(observation).toHaveCount(1);
  await expect(observation).toContainText("Beobachtungstag");
  await expect(
    page.getByRole("button", { name: "Freitag auf 17:30 verschieben" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Kalender abonnieren" }),
  ).toHaveCount(0);
});

test("public start opens account creation and preserves referral attribution", async ({
  page,
}, testInfo) => {
  await page.goto("/?ref=DOGOS26");
  await expect(
    page.getByRole("heading", {
      name: "Ein Trainingscoach, der deinen Hund wirklich kennt.",
    }),
  ).toBeVisible();
  const start = page.getByRole("link", { name: /Gespräch starten/ });
  await expect(start).toHaveAttribute("href", /\/auth\/sign-up/);
  await expect(start).toHaveAttribute("href", /ref=DOGOS26/);
  await expect(page.getByRole("link", { name: "Anmelden" })).toHaveAttribute(
    "href",
    "/auth/sign-in",
  );
  await page.locator("main").screenshot({
    path: resolve(screenshots, `start-${testInfo.project.name}.png`),
  });
});

test("PWA manifest exposes install and durable product shortcuts", async ({
  request,
}) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.status()).toBe(200);
  const manifest = (await response.json()) as {
    display: string;
    icons: Array<{ sizes: string }>;
    shortcuts: Array<{ url: string }>;
    start_url: string;
  };
  expect(manifest.display).toBe("standalone");
  expect(manifest.start_url).toContain("/app/coach");
  expect(manifest.icons.map((icon) => icon.sizes)).toEqual(
    expect.arrayContaining(["192x192", "512x512"]),
  );
  expect(manifest.shortcuts.map((shortcut) => shortcut.url)).toEqual(
    expect.arrayContaining([
      "/app/coach?source=app_shortcut",
      "/app/coach?prompt=What%20should%20we%20train%20today%3F",
      "/app/progress?source=app_shortcut",
    ]),
  );
});
