import { expect, test } from "@playwright/test";

test("explains the life score with and without a data basis", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/insights");

  await expect(
    page.getByRole("heading", { level: 1, name: "Insights" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      /Deine Woche aus deinen eigenen Einträgen – keine Bewertung deines Lebens/,
    ),
  ).toBeVisible();

  // Eine Woche ohne Daten ist ein hilfreicher Zustand, keine leere Fläche.
  await expect(
    page.getByRole("heading", { level: 2, name: /^Woche vom/ }),
  ).toBeVisible();
  await expect(page.getByText("Noch keine Beobachtung")).toBeVisible();
  await expect(
    page.getByText("Für diese Woche war keine Aufgabe geplant."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Nächste Woche" }),
  ).toBeDisabled();

  await page.getByRole("button", { name: "Vorherige Woche" }).click();
  await expect(
    page.getByRole("button", { name: "Nächste Woche" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Nächste Woche" }).click();

  // Ohne einen einzigen Eintrag gibt es keine Aussage — und keine Null.
  await expect(page.getByText("Keine Angabe").first()).toBeVisible();
  await expect(
    page.getByText(/Für diesen Zeitraum liegt noch zu wenig vor/),
  ).toBeVisible();
  await expect(page.getByText("0 von 100")).toHaveCount(0);
  await expect(page.getByText("life-score-v2")).toBeVisible();

  // Jeder Teilwert führt in einem Schritt zu Formel und Datenbasis.
  await page.getByRole("button", { name: "Warum? Erklärung zu Fokus" }).click();
  await expect(page.getByText(/hoch zählt dreifach/)).toBeVisible();
  await expect(
    page.getByText("Mindestens drei geplante Aufgaben im Zeitraum."),
  ).toBeVisible();

  // Drei für heute geplante Aufgaben, zwei davon erledigt: Damit hat Fokus
  // eine Grundlage und der Gesamtwert eine Aussage.
  await page.goto("/");
  for (const title of ["Synthetisch A", "Synthetisch B", "Synthetisch C"]) {
    await page.getByRole("textbox", { name: "Aufgabe für heute" }).fill(title);
    await page.getByRole("button", { name: "Aufgabe hinzufügen" }).click();
    await expect(page.getByText(title).first()).toBeVisible();
  }
  for (const title of ["Synthetisch A", "Synthetisch B"]) {
    await page.getByRole("button", { name: `„${title}“ abschließen` }).click();
    await expect(
      page.getByRole("button", { name: `„${title}“ abschließen` }),
    ).toHaveCount(0);
  }

  await page.goto("/insights");
  await expect(
    page.getByRole("heading", { level: 2, name: "Life Score" }),
  ).toBeVisible();

  // Die Woche hat jetzt eine Grundlage, und jede Zahl nennt sie.
  await expect(page.getByText("2 von 3", { exact: true })).toBeVisible();
  await expect(page.getByText("Grundlage: 3 geplante Aufgaben.")).toBeVisible();

  // Zwei von drei geplanten Aufgaben gleicher Priorität sind 67 von 100.
  await expect(
    page.getByRole("progressbar", { name: "Fokus" }),
  ).toHaveJSProperty("value", 67);
  await expect(
    page.getByText("1 von 5 Bereichen", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("25 % der Gewichtung").first()).toBeVisible();

  // Eine Gewichtsänderung zeigt ihre Wirkung, bevor sie gespeichert wird.
  const focusWeight = page.getByRole("spinbutton", {
    name: /Gewicht für Fokus/,
  });
  await focusWeight.fill("50");
  await expect(page.getByText(/Mit dieser Gewichtung:/)).toBeVisible();

  await page.getByRole("button", { name: "Gewichtung speichern" }).click();
  await expect(
    page.getByText("Die Gewichtung wurde gespeichert."),
  ).toBeVisible();
  await expect(
    page.getByText("40 % der Gewichtung", { exact: true }),
  ).toBeVisible();

  await page.reload();
  await expect(
    page.getByText("40 % der Gewichtung", { exact: true }),
  ).toBeVisible();

  // Ein abgewählter Bereich ist eine Entscheidung, keine Lücke.
  await page.getByRole("checkbox", { name: "Finanzen einbeziehen" }).click();
  await page.getByRole("button", { name: "Gewichtung speichern" }).click();
  await expect(
    page.getByText("Die Gewichtung wurde gespeichert."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Warum? Erklärung zu Finanzen" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Life Score ausblenden" }).click();
  await expect(
    page.getByRole("heading", { name: "Life Score ist ausgeblendet" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Life Score anzeigen" }).click();
  await expect(
    page.getByRole("heading", { level: 2, name: "Teilwerte" }),
  ).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
});
