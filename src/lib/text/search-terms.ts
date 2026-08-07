/**
 * Freitextsuche über bereits geladene Datensätze. Bewusst ohne Index: Die
 * Listen liegen ohnehin vollständig im Speicher, und ein Index müsste bei jeder
 * Änderung gepflegt und mitgesichert werden.
 *
 * Der Suchbegriff wird weder gespeichert noch protokolliert.
 */

/**
 * Vergleichsform eines Textes: ohne Groß-/Kleinschreibung und ohne Diakritika,
 * damit „Muller“ auch „Müller“ und „Cafe“ auch „Café“ findet. `toLowerCase`
 * allein genügt dafür nicht.
 */
export function normaliseForSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export type SearchMatcher = {
  /** Wahr, sobald einer der Werte den Suchbegriff enthält. */
  matches: (...values: Array<string | undefined>) => boolean;
  /** Falsch, solange kein verwertbarer Begriff eingegeben wurde. */
  isActive: boolean;
};

/**
 * Baut den Vergleich einmal je Suchbegriff auf. Ohne leeren Begriff bleibt
 * `matches` durchlässig, sodass Aufrufer keinen Sonderfall brauchen.
 */
export function createSearchMatcher(term: string): SearchMatcher {
  const needle = normaliseForSearch(term.trim());
  if (needle.length === 0) {
    return { isActive: false, matches: () => true };
  }
  return {
    isActive: true,
    matches: (...values) =>
      values.some(
        (value) =>
          value !== undefined && normaliseForSearch(value).includes(needle),
      ),
  };
}
