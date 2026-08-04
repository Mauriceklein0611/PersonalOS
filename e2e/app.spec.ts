import { expect, test } from "@playwright/test";

test("shows the PersonalOS bootstrap shell", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { level: 1, name: "PersonalOS" }),
  ).toBeVisible();
  await expect(page).toHaveTitle("PersonalOS");
});
