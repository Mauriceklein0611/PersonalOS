export type PersistenceErrorCode =
  "conflict" | "not-found" | "storage" | "transaction" | "validation";

const persistenceMessages: Record<PersistenceErrorCode, string> = {
  conflict: "Der Datensatz steht in Konflikt mit vorhandenen lokalen Daten.",
  "not-found": "Der lokale Datensatz wurde nicht gefunden.",
  storage: "Die lokalen Daten konnten nicht gespeichert werden.",
  transaction:
    "Die lokale Änderung konnte nicht vollständig gespeichert werden.",
  validation: "Die lokalen Daten entsprechen nicht dem erwarteten Format.",
};

export class PersistenceError extends Error {
  readonly code: PersistenceErrorCode;

  constructor(code: PersistenceErrorCode, options?: ErrorOptions) {
    super(persistenceMessages[code], options);
    this.name = "PersistenceError";
    this.code = code;
  }
}

export function toPersistenceError(
  error: unknown,
  fallbackCode: PersistenceErrorCode = "storage",
): PersistenceError {
  if (error instanceof PersistenceError) {
    return error;
  }

  const code =
    error instanceof Error && error.name === "ConstraintError"
      ? "conflict"
      : fallbackCode;

  return new PersistenceError(code, { cause: error });
}
