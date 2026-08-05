/**
 * Eine Summe über verschiedene Währungen wäre nur mit einer Umrechnung
 * möglich. Umrechnung ist nicht im Scope; der Fall wird deshalb benannt statt
 * still geschätzt. Die Meldung nennt den betroffenen Bereich.
 */
export class MixedCurrencyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MixedCurrencyError";
  }
}
