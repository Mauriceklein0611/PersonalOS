/**
 * Zählt Feldzugriffe auf eine Menge von Datensätzen.
 *
 * Eine Zeitmessung sagt auf einem geteilten CI-Läufer wenig: Sie schwankt mit
 * der Maschine und muss deshalb so großzügig ausfallen, dass sie eine
 * zusätzliche Schleife über alle Datensätze nicht mehr bemerkt. Die Zahl der
 * Zugriffe ist dagegen deterministisch und bildet genau das ab, was eine
 * Auswertung teuer macht: wie oft sie ihre Eingabe anfasst.
 *
 * Gezählt wird am einzelnen Datensatz, nicht an der Liste. Ein `filter` gibt
 * eine neue, gewöhnliche Liste zurück; ein Zähler an der Liste würde deshalb
 * nur den ersten Durchlauf sehen und alles danach übersehen.
 */
export type AccessCounter = { reads: number };

export function createAccessCounter(): AccessCounter {
  return { reads: 0 };
}

export function countPropertyReads<T extends object>(
  items: readonly T[],
  counter: AccessCounter,
): T[] {
  return items.map(
    (item) =>
      new Proxy(item, {
        get(target, property, receiver) {
          counter.reads += 1;
          return Reflect.get(target, property, receiver);
        },
      }),
  );
}
