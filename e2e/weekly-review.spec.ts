import { expect, test } from "@playwright/test";

test("shows the week with its basis and an explicit previous-week comparison", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/auswertung/wochenrueckblick");

  await expect(
    page.getByRole("heading", { level: 1, name: "Wochenrückblick" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      /als Zahlen mit Zeitraum und Datenbasis, nicht als Bewertung/,
    ),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Aus dem Journal geht nur die Anzahl der Tage mit einem Eintrag ein, kein Freitext.",
    ),
  ).toBeVisible();

  await expect(
    page.getByRole("heading", { level: 2, name: /^Woche vom/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Nächste Woche" }),
  ).toBeDisabled();

  // Ohne einen einzigen Eintrag fehlt beiden Wochen die Grundlage — der
  // Vergleich sagt das ausdrücklich, statt eine Lücke zu zeigen. Der Text
  // steht mehrfach (Aufgaben, Routinen, Ziele, Ausgaben); Journal hat
  // dank der sieben Kalendertage immer eine Grundlage.
  await expect(
    page
      .getByText(
        "Kein Vorwochenvergleich möglich: Weder für diese noch für die vorherige Woche liegt eine Datenbasis vor.",
      )
      .first(),
  ).toBeVisible();

  // Eine Aufgabe für heute gibt der laufenden Woche eine Grundlage; die
  // Vorwoche bleibt ohne — der Hinweis benennt jetzt genau das, statt beide
  // Wochen pauschal als grundlagenlos zu behandeln.
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "Aufgabe für heute" })
    .fill("Wochenrückblick E2E");
  await page.getByRole("button", { name: "Aufgabe hinzufügen" }).click();
  await expect(page.getByText("Wochenrückblick E2E").first()).toBeVisible();
  await page
    .getByRole("button", { name: "„Wochenrückblick E2E“ abschließen" })
    .click();
  // Erst weiterreisen, wenn der Abschluss tatsächlich gespeichert ist —
  // sonst liest die nächste Seite noch die offene Aufgabe.
  await expect(
    page.getByRole("button", { name: "„Wochenrückblick E2E“ abschließen" }),
  ).toHaveCount(0);

  await page.goto("/auswertung/wochenrueckblick");
  await expect(
    page.getByRole("heading", { level: 3, name: "Aufgaben" }),
  ).toBeVisible();
  await expect(page.getByText("Grundlage: 1 geplante Aufgabe.")).toBeVisible();
  await expect(page.getByText("1 von 1", { exact: true })).toBeVisible();
  await expect(
    page.getByText(
      "Kein Vorwochenvergleich möglich: Für die vorherige Woche liegt keine Datenbasis vor.",
    ),
  ).toBeVisible();

  // Das Blättern über Wochen bleibt bedienbar, auch mit Daten in der
  // laufenden Woche.
  await page.getByRole("button", { name: "Vorherige Woche" }).click();
  await expect(
    page.getByRole("button", { name: "Nächste Woche" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Nächste Woche" }).click();
  await expect(
    page.getByRole("button", { name: "Nächste Woche" }),
  ).toBeDisabled();

  const hasHorizontalOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
});
