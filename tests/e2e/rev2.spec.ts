import { expect, test } from "@playwright/test";

const pages = [
  ["top", "/kpi"], ["products", "/analysis/products"], ["abc", "/analysis/abc"],
  ["weekday", "/analysis/weekday"], ["hourly", "/analysis/hourly"],
  ["monthly", "/analysis/monthly"], ["consulting", "/consulting"], ["qa", "/qa"]
] as const;

for (const [name, path] of pages) {
  test(`${name}: screenshot, console, 404 and links`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    page.on("pageerror", (error) => errors.push(error.message));
    const response = await page.goto(path, { waitUntil: "networkidle" });
    expect(response?.status(), `${path} returned HTTP error`).toBeLessThan(400);
    await expect(page.locator("h1")).toBeVisible();
    for (const link of await page.locator("a[href]").all()) {
      const href = await link.getAttribute("href");
      if (href?.startsWith("/")) {
        const check = await page.request.get(href);
        expect(check.status(), `broken link: ${href}`).toBeLessThan(400);
      }
    }
    expect(errors, `console errors on ${path}`).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true });
  });
}

test("QA blocks release when any unresolved issue exists", async ({ page }) => {
  await page.goto("/qa", { waitUntil: "networkidle" });
  const text = await page.locator("body").innerText();
  const match = text.match(/NG合計\s*(\d+)件/);
  expect(match, "QA total is missing").not.toBeNull();
  expect(Number(match?.[1]), "release is blocked until QA NG is zero").toBe(0);
});
