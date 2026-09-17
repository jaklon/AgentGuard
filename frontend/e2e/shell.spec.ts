import { expect, test } from "@playwright/test";

test("renders the guarded payment flow", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /verify the intent/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /connect metamask/i })).toBeVisible();
  await expect(page.getByText(/no keys. no automatic signing/i)).toBeVisible();
});
