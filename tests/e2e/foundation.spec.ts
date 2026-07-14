import { expect, test } from "@playwright/test";

test("renders the honest foundation status", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/DogOS/);
  await expect(
    page.getByRole("heading", { name: "Training, das sich anpasst." }),
  ).toBeVisible();
  await expect(page.getByText("Phase 2 · Foundation")).toBeVisible();
});
