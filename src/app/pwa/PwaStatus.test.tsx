import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type {
  RegisterPersonalOsServiceWorker,
  ServiceWorkerRegistrationCallbacks,
} from "./register-service-worker";
import { PwaStatus } from "./PwaStatus";

function createRegistration() {
  let callbacks: ServiceWorkerRegistrationCallbacks | undefined;
  const updateServiceWorker = vi.fn(() => Promise.resolve());
  const registerServiceWorker: RegisterPersonalOsServiceWorker = (
    nextCallbacks,
  ) => {
    callbacks = nextCallbacks;
    return updateServiceWorker;
  };

  return {
    getCallbacks: () => callbacks,
    registerServiceWorker,
    updateServiceWorker,
  };
}

describe("PwaStatus", () => {
  it("explains offline readiness and lets the user dismiss the notice", async () => {
    const user = userEvent.setup();
    const registration = createRegistration();
    render(
      <PwaStatus registerServiceWorker={registration.registerServiceWorker} />,
    );

    registration.getCallbacks()?.onOfflineReady();

    expect(await screen.findByText("Offline bereit")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Hinweis schließen" }));
    expect(screen.queryByText("Offline bereit")).not.toBeInTheDocument();
  });

  it("activates an update only after an explicit user action", async () => {
    const user = userEvent.setup();
    const registration = createRegistration();
    render(
      <PwaStatus registerServiceWorker={registration.registerServiceWorker} />,
    );

    registration.getCallbacks()?.onNeedRefresh();

    expect(await screen.findByText("Update verfügbar")).toBeInTheDocument();
    expect(registration.updateServiceWorker).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole("button", { name: "Jetzt aktualisieren" }),
    );
    expect(registration.updateServiceWorker).toHaveBeenCalledOnce();
    expect(registration.updateServiceWorker).toHaveBeenCalledWith(true);
  });
});
