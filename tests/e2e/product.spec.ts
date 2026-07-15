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

test.beforeAll(async () => mkdir(screenshots, { recursive: true }));

test("scenario 1: German low-risk owner reaches and uses the plan", async ({
  page,
}, testInfo) => {
  await page.goto("/simulator");
  for (const choice of [
    "Los geht's",
    "Verstanden",
    "Deutsch",
    "Keine Kinder",
    "Gemischt / unbekannt",
    "Keine",
    "Nein",
    "Nein",
    "Ziehen an der Leine",
    "8 von 10 Abschnitten locker",
    "6 von 10",
    "Plan öffnen",
  ])
    await clickButton(page, choice);

  await expect(
    page.getByRole("link", { name: "Heutiges Training öffnen" }),
  ).toBeVisible();
  if (testInfo.project.name === "chromium")
    await page.screenshot({
      path: resolve(screenshots, "german-flow.png"),
      fullPage: true,
    });
  await page.getByRole("link", { name: "Heutiges Training öffnen" }).click();
  await expect(
    page.getByRole("heading", { name: "Heute mit Milo" }),
  ).toBeVisible();
  await expect(page.getByText("Stufe 1 · ruhige Strasse")).toBeVisible();
});

test("scenario 2: English owner remains in Switzerland and CHF", async ({
  page,
  request,
}, testInfo) => {
  await reset(request, "en");
  await page.goto("/simulator");
  await clickButton(page, "Sprache wechseln");
  await expect(page.getByText("Switzerland")).toHaveCount(0);
  await expect(page.getByText("Schweiz · CHF · Europe/Zurich")).toBeVisible();
  await expect(
    page.getByText(
      "Hi! I will guide you and Milo through short, safe training steps.",
    ),
  ).toBeVisible();
  if (testInfo.project.name === "chromium")
    await page.screenshot({
      path: resolve(screenshots, "english-flow.png"),
      fullPage: true,
    });

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
  ).toBeVisible();
  await expect(
    page.getByText("Keine Diagnose oder Notfallhilfe.", { exact: false }),
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

test("scenario 10: language switch preserves answers and workflow", async ({
  page,
}) => {
  await page.goto("/simulator");
  await clickButton(page, "Los geht's");
  await clickButton(page, "Verstanden");
  await clickButton(page, "Sprache wechseln");
  await expect(page.getByText("Los geht's")).toBeVisible();
  await expect(page.getByText("Verstanden")).toBeVisible();
  await expect(
    page.getByText("Would you like to continue in English?"),
  ).toBeVisible();
  await expect(page.getByText("Schweiz · CHF · Europe/Zurich")).toBeVisible();
});
