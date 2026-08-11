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

/**
 * Netzwerkanalyse über einen vollständigen Tagesablauf, Issue #29.
 *
 * Der erste Seitenaufruf beweist wenig: Fachdaten entstehen erst beim
 * Erfassen. Diese Prüfung schreibt Aufgabe, Check-in, Journal und Buchung und
 * hört dabei jeder Anfrage zu, die der Browser stellt.
 */
test("sends nothing to the network while a full day is captured", async ({
  page,
}) => {
  const requests: { method: string; url: string; body: string | null }[] = [];
  page.on("request", (request) => {
    requests.push({
      body: request.postData(),
      method: request.method(),
      url: request.url(),
    });
  });

  await page.goto("/");
  await page
    .getByRole("textbox", { name: "Aufgabe für heute" })
    .fill("Synthetische Aufgabe");
  await page.getByRole("button", { name: "Aufgabe hinzufügen" }).click();
  await expect(
    page.getByRole("heading", { level: 3, name: "Synthetische Aufgabe" }),
  ).toBeVisible();

  await page.goto("/routinen/journal");
  await page
    .getByRole("textbox", { name: /Highlight/ })
    .fill("Synthetischer Eintrag");
  await page
    .getByRole("button", { name: /speichern/ })
    .first()
    .click();

  await page.goto("/geld");
  await page.getByRole("textbox", { name: /Betrag in/ }).fill("12,50");
  await page
    .getByRole("combobox", { name: /Kategorie der Buchung/ })
    .selectOption({ label: "Lebensmittel" });
  await page.getByRole("button", { name: "Buchung speichern" }).click();
  await expect(page.getByRole("table").first()).toBeVisible();

  await page.goto("/auswertung/ueberblick");
  await expect(
    page.getByRole("heading", { level: 1, name: "Auswertung" }),
  ).toBeVisible();

  const foreign = requests.filter(
    (request) => new URL(request.url).origin !== "http://127.0.0.1:4173",
  );
  expect(foreign).toEqual([]);

  // Kein Request trägt einen Rumpf; damit kann keiner Fachdaten mitnehmen.
  expect(requests.filter((request) => request.body !== null)).toEqual([]);
  expect(
    requests.filter((request) => !["GET", "HEAD"].includes(request.method)),
  ).toEqual([]);

  /*
   * Die einzige Anfrage, die keine Datei holt, ist der inhaltsfreie
   * Erreichbarkeitstest. Sein Pfad existiert nicht; er fragt nur, ob der
   * eigene Origin antwortet.
   */
  const nonAssetPaths = requests
    .map((request) => new URL(request.url).pathname)
    .filter((path) => !/\.[a-z0-9]+$/i.test(path))
    .filter((path) => !["/", "/geld"].includes(path))
    .filter((path) => !path.startsWith("/routinen"))
    .filter((path) => !path.startsWith("/auswertung"))
    .filter((path) => !path.startsWith("/planen"));
  expect([...new Set(nonAssetPaths)]).toEqual(["/__personalos-online-check__"]);
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

  /*
   * Die Aufgabe und der beim Start angelegte Settings-Datensatz — mehr nicht.
   * Das Dashboard zeigt seit #73 auch den Life Score; es liest ihn dabei nur
   * und legt keine zweite Konfiguration an. Ansehen darf nichts schreiben,
   * sonst wüchse die Zahl allein vom Betrachten.
   */
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
