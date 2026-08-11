import { afterEach, describe, expect, it, vi } from "vitest";

import { requestBrowserPersistence } from "./browser-storage-status";

const originalStorage = Object.getOwnPropertyDescriptor(navigator, "storage");

function setStorage(storage: unknown) {
  Object.defineProperty(navigator, "storage", {
    configurable: true,
    value: storage,
  });
}

afterEach(() => {
  if (originalStorage) {
    Object.defineProperty(navigator, "storage", originalStorage);
  } else {
    Reflect.deleteProperty(navigator, "storage");
  }
});

describe("requestBrowserPersistence", () => {
  it("passes on what the browser granted", async () => {
    setStorage({ persist: vi.fn().mockResolvedValue(true) });

    expect(await requestBrowserPersistence()).toBe(true);
  });

  /*
   * Eine Ablehnung und ein Browser ohne die Bitte sind zwei verschiedene
   * Antworten. Die Oberfläche bietet nur im ersten Fall etwas an, das wirken
   * kann — deshalb dürfen sie hier nicht zusammenfallen.
   */
  it("separates a refusal from a browser that does not know the request", async () => {
    setStorage({ persist: vi.fn().mockResolvedValue(false) });
    expect(await requestBrowserPersistence()).toBe(false);

    setStorage({});
    expect(await requestBrowserPersistence()).toBeUndefined();

    setStorage(undefined);
    expect(await requestBrowserPersistence()).toBeUndefined();
  });

  it("treats a rejected request as a refusal", async () => {
    setStorage({ persist: vi.fn().mockRejectedValue(new Error("denied")) });

    expect(await requestBrowserPersistence()).toBe(false);
  });
});
