import { expect, test } from "@playwright/test";

test("blocks unexpected external connections with the production CSP", async ({
  page,
}) => {
  const externalRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).origin !== "http://127.0.0.1:4173") {
      externalRequests.push(request.url());
    }
  });
  await page.goto("/");

  const policy = await page
    .locator('meta[http-equiv="Content-Security-Policy"]')
    .getAttribute("content");
  expect(policy).toContain("connect-src 'self'");
  expect(policy).toContain("script-src 'self'");
  expect(policy).toContain("worker-src 'self'");
  expect(externalRequests).toEqual([]);

  const violatedDirective = await page.evaluate(
    () =>
      new Promise<string>((resolve, reject) => {
        const timeout = window.setTimeout(
          () => reject(new Error("CSP violation was not observed.")),
          3_000,
        );
        document.addEventListener(
          "securitypolicyviolation",
          (event) => {
            if (event.violatedDirective === "connect-src") {
              window.clearTimeout(timeout);
              resolve(event.violatedDirective);
            }
          },
          { once: true },
        );
        void fetch("https://example.com/personalos-csp-check").catch(
          () => undefined,
        );
      }),
  );

  expect(violatedDirective).toBe("connect-src");
  await expect(
    page.getByRole("heading", { level: 1, name: "Heute" }),
  ).toBeVisible();
});

test("downloads a safety backup before clearing local data", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("personalos");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction("tasks", "readwrite");
          transaction.objectStore("tasks").put({
            id: "00000000-0000-4000-8000-000000000801",
            createdAt: "2026-08-04T10:00:00.000Z",
            updatedAt: "2026-08-04T10:00:00.000Z",
            title: "Synthetische Löschprüfung",
            status: "open",
            priority: "normal",
          });
          transaction.onerror = () => reject(transaction.error);
          transaction.oncomplete = () => {
            database.close();
            resolve();
          };
        };
      }),
  );
  await page.evaluate(() =>
    localStorage.setItem("personalos.theme.v1", "dark"),
  );
  await page.goto("/einstellungen");

  // Die Aufgabe und der beim Start angelegte Settings-Datensatz.
  await expect(page.getByText("2 lokale Datensätze")).toBeVisible();
  await page
    .getByRole("button", { name: "Alle lokalen Daten löschen" })
    .click();
  await expect(
    page.getByRole("dialog", {
      name: "Alle lokalen PersonalOS-Daten löschen?",
    }),
  ).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  const reloadPromise = page.waitForEvent("load");
  await page
    .getByRole("button", {
      name: "Backup herunterladen und endgültig löschen",
    })
    .click();
  const download = await downloadPromise;
  await reloadPromise;

  expect(download.suggestedFilename()).toMatch(
    /^personalos-backup-\d{8}T\d{9}Z\.json$/,
  );
  await expect(
    page.getByRole("heading", { level: 1, name: "Einstellungen" }),
  ).toBeVisible();
  // Die Aufgabe ist fort; der Start legt die Einstellungen neu an.
  await expect(page.getByText("1 lokaler Datensatz")).toBeVisible();
  await expect(page.getByText("Synthetische Löschprüfung")).toHaveCount(0);
  await expect(page.getByLabel("Farbschema")).toHaveValue("system");
});
