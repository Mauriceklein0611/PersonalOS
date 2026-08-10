import { expect, test } from "@playwright/test";

type WebAppManifest = {
  display?: string;
  icons?: Array<{ sizes?: string; src?: string; type?: string }>;
  name?: string;
  short_name?: string;
  start_url?: string;
};

test("exposes complete installation metadata", async ({ request }) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBe(true);

  const manifest = (await response.json()) as WebAppManifest;
  expect(manifest.name).toBe("PersonalOS – Privater Alltagsbegleiter");
  expect(manifest.short_name).toBe("PersonalOS");
  expect(manifest.display).toBe("standalone");
  expect(manifest.start_url).toBe("/");

  for (const size of ["192x192", "512x512"]) {
    const icon = manifest.icons?.find((candidate) => candidate.sizes === size);
    expect(icon?.type).toBe("image/png");
    expect(icon?.src).toBeTruthy();

    const iconResponse = await request.get(`/${icon?.src ?? "missing"}`);
    expect(iconResponse.ok()).toBe(true);
    expect(iconResponse.headers()["content-type"]).toContain("image/png");
    expect((await iconResponse.body()).byteLength).toBeGreaterThan(1_000);
  }
});

test("starts offline from static caches and keeps local actions available", async ({
  context,
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "Heute" }),
  ).toBeVisible();

  await expect
    .poll(() =>
      page.evaluate(async () => {
        const registration = await navigator.serviceWorker.getRegistration();
        return Boolean(registration?.active);
      }),
    )
    .toBe(true);

  await page.reload();
  await expect
    .poll(() =>
      page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
    )
    .toBe(true);

  const cachedUrls = await page.evaluate(async () => {
    const cacheNames = await caches.keys();
    const requests = await Promise.all(
      cacheNames.map(async (cacheName) => {
        const cache = await caches.open(cacheName);
        return cache.keys();
      }),
    );
    return requests.flat().map((request) => request.url);
  });

  expect(cachedUrls.length).toBeGreaterThan(10);
  for (const cachedUrl of cachedUrls) {
    const url = new URL(cachedUrl);
    expect(url.origin).toBe("http://127.0.0.1:4173");
    expect(url.pathname).toMatch(
      /^\/(?:assets\/[^/]+\.(?:css|js)|apple-touch-icon\.png|favicon\.svg|index\.html|manifest\.webmanifest|maskable-icon-512x512\.png|pwa-(?:192x192|512x512)\.png)$/,
    );
  }
  expect(cachedUrls.some((url) => url.endsWith(".json"))).toBe(false);
  expect(cachedUrls.some((url) => url.includes("/api/"))).toBe(false);

  await context.setOffline(true);
  try {
    await page.reload();
    await expect(
      page.getByRole("heading", { level: 1, name: "Heute" }),
    ).toBeVisible();
    await expect(page.getByText("Offline", { exact: true })).toBeVisible();

    await page.goto("/einstellungen");
    await expect(
      page.getByRole("heading", { level: 1, name: "Einstellungen" }),
    ).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Vollständigen Export herunterladen" })
      .click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(
      /^personalos-backup-\d{8}T\d{9}Z\.json$/,
    );
  } finally {
    await context.setOffline(false);
  }
});

/*
 * #118: Fixiert nahm der Hinweis bei 390 px die volle Breite am oberen Rand
 * ein — und die Kopfzeile klebt selbst dort. Er lag damit dauerhaft über
 * Marke, Nebenbereichen und Farbschema.
 */
test("keeps the install hint clear of the header on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const hint = page.getByText(
    "PersonalOS kann jetzt ohne Netzwerk gestartet werden.",
  );
  await expect(hint).toBeVisible({ timeout: 20_000 });

  const hintBox = await page.locator(".pwa-toast-region").boundingBox();
  const barBox = await page.locator(".top-bar").boundingBox();
  const captureBox = await page.locator(".today-capture").boundingBox();

  // Der Hinweis endet, bevor die Kopfzeile beginnt, und beide vor der Erfassung.
  expect(hintBox!.y + hintBox!.height).toBeLessThanOrEqual(barBox!.y + 1);
  expect(barBox!.y + barBox!.height).toBeLessThanOrEqual(captureBox!.y + 1);

  await page.getByRole("button", { name: "Hinweis schließen" }).click();
  await expect(hint).toBeHidden();
});
