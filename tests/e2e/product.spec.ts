import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

import {
  expect,
  type APIRequestContext,
  type Page,
  test,
} from "@playwright/test";

const api = "http://127.0.0.1:4000";
const screenshots = resolve("test-results/slice-2.5/screenshots");
const distributionScreenshots = resolve("test-results/slice-2.7/screenshots");
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

async function clickButton(page: Page, name: string) {
  const button = page.getByRole("button", { name, exact: true });
  await expect(button).toHaveCount(1);
  await button.click();
}

test.beforeAll(async () => {
  await Promise.all([
    mkdir(screenshots, { recursive: true }),
    mkdir(distributionScreenshots, { recursive: true }),
  ]);
});

test("scenario 1: German low-risk owner reaches and uses the plan", async ({
  page,
  request,
}, testInfo) => {
  await reset(request);
  await page.goto("/app/today");
  await expect(
    page.getByRole("heading", { name: "Milo / Heute" }),
  ).toBeVisible();
  if (testInfo.project.name === "chromium")
    await page.screenshot({
      path: resolve(screenshots, "german-flow.png"),
      fullPage: true,
    });
  await expect(page.getByText("Block 01 · Orientierung")).toBeVisible();
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
  await page.goto("/app/today");
  await expect(
    page.getByText("Futterverweigerung, Meiden, Schmerzzeichen"),
  ).not.toBeVisible();
  await expect(
    page.getByText("Hat sich bei Milo heute etwas akut verändert?", {
      exact: false,
    }),
  ).toBeVisible();
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
  const blocked = await request.post(`${api}/v1/sessions/session-2/start`, {
    headers: headers("pain-start"),
    data: {},
  });
  expect(blocked.status()).toBe(409);
  expect((await blocked.json()).error.code).toBe("SAFETY_REVIEW_REQUIRED");
  await page.goto("/app/referral/referral-1");
  await expect(
    page.getByRole("heading", { name: "Tiermedizinische Abklärung empfohlen" }),
  ).toBeVisible();
  if (testInfo.project.name === "chromium")
    await page.screenshot({
      path: resolve(screenshots, "safety-escalation.png"),
      fullPage: true,
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

test("account link hydrates and confirms without exposing a web chat", async ({
  page,
}) => {
  await page.route("**/v1/whatsapp/link/confirm", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ linked: true }),
    });
  });
  await page.goto(`/app/account/link?token=${"a".repeat(32)}`);
  await clickButton(page, "Verbindung bestätigen");
  await expect(page.getByText("WhatsApp ist verbunden.")).toBeVisible();

  const simulator = await page.goto("/simulator");
  expect(simulator?.status()).toBe(404);
});

test("calendar supports bounded rescheduling and a revocable ICS feed", async ({
  page,
  request,
}) => {
  test.setTimeout(60_000);
  await page.goto("/app/calendar");
  await clickButton(page, "Freitag auf 17:30 verschieben");
  await expect(page.getByText("17:30 · 4 Min.")).toBeVisible();

  const invalid = await request.get("/api/calendar.ics");
  expect(invalid.status()).toBe(401);
  const valid = await request.get(
    "/api/calendar.ics?token=local-review-calendar-v1",
  );
  expect(valid.headers()["content-type"]).toContain("text/calendar");
  expect(await valid.text()).toContain("BEGIN:VEVENT");
});

test("public start is WhatsApp-first and referral codes grant no access", async ({
  page,
}, testInfo) => {
  await page.goto("/?ref=DOGOS26");
  await expect(
    page.getByRole("heading", {
      name: "Im WhatsApp-Chat starten. In DogOS dranbleiben.",
    }),
  ).toBeVisible();
  const start = page.getByRole("link", { name: "In WhatsApp starten" });
  await expect(start).toHaveAttribute("href", /text=DogOS\+starten/);
  await expect(start).toHaveAttribute("href", /Einladung\+DOGOS26/);
  await expect(
    page.getByRole("link", { name: /Schon verbunden/ }),
  ).toHaveAttribute("href", "/auth/sign-in");
  await page.locator("main").screenshot({
    path: resolve(
      distributionScreenshots,
      `start-${testInfo.project.name}.png`,
    ),
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
  expect(manifest.start_url).toContain("/app/today");
  expect(manifest.icons.map((icon) => icon.sizes)).toEqual(
    expect.arrayContaining(["192x192", "512x512"]),
  );
  expect(manifest.shortcuts.map((shortcut) => shortcut.url)).toEqual(
    expect.arrayContaining([
      "/app/today?source=app_shortcut",
      "/app/progress?source=app_shortcut",
    ]),
  );
});
