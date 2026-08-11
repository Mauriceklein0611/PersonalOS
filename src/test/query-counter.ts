import type { PersonalOsDatabase } from "../db/database";

/**
 * Zählt Datenbankabfragen und die Datensätze, die sie tatsächlich aus dem
 * Speicher holen.
 *
 * Beide Zahlen messen etwas anderes, und beide sind nötig:
 *
 * - `queries` findet die N+1-Abfrage. Eine Ansicht, die je Routine einmal
 *   fragt, wächst hier mit der Zahl der Routinen.
 * - `rows` findet das Zuviel. Gezählt wird **vor** jeder Filterung im
 *   Anwendungscode; eine Abfrage, die drei Jahre liest, um sieben Tage zu
 *   zeigen, fällt damit auf.
 *
 * Beide Werte sind deterministisch. Eine Zeitmessung wäre es nicht: Sie
 * schwankt auf einem geteilten Läufer so stark, dass sie eine zusätzliche
 * vollständige Tabellenlesung nicht mehr zuverlässig bemerkt.
 */
export type QueryCounter = {
  /** Namen der abschließenden Operationen, in der Reihenfolge ihres Aufrufs. */
  operations: string[];
  queries: number;
  rows: number;
};

export function createQueryCounter(): QueryCounter {
  return { operations: [], queries: 0, rows: 0 };
}

/**
 * Legt den Zähler über die Tabellenzugriffe der Datenbank. Der Aufrufer erhält
 * eine Funktion, die den ursprünglichen Zustand wiederherstellt.
 */
export function countDatabaseQueries(
  database: PersonalOsDatabase,
  counter: QueryCounter,
): () => void {
  /*
   * Nur `table` wird ersetzt. `tableFor` ruft es selbst auf; beides zu
   * ersetzen zählte jede Abfrage der Repositories doppelt.
   */
  const originalTable = database.table.bind(database);

  const wrap = <TValue extends object>(value: TValue): TValue =>
    new Proxy(value, {
      get(target, property, receiver) {
        const member = Reflect.get(target, property, receiver) as unknown;
        if (typeof member !== "function") {
          return member;
        }

        return (...args: unknown[]) => {
          const result = (member as (...input: unknown[]) => unknown).apply(
            target,
            args,
          );
          if (isThenable(result)) {
            counter.queries += 1;
            counter.operations.push(String(property));
            return result.then((rows) => {
              counter.rows += countRows(rows);
              return rows;
            });
          }
          // Ein Kettenglied wie `where(...)`; erst sein Abschluss liest.
          return result !== null && typeof result === "object"
            ? wrap(result)
            : result;
        };
      },
    });

  // @ts-expect-error -- Testinstrument; die Signatur bleibt identisch.
  database.table = (...args: unknown[]) => wrap(originalTable(...args));

  return () => {
    database.table = originalTable;
  };
}

function isThenable(value: unknown): value is Promise<unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof (value as { then?: unknown }).then === "function"
  );
}

function countRows(rows: unknown): number {
  if (Array.isArray(rows)) return rows.length;
  return rows === undefined || rows === null ? 0 : 1;
}
