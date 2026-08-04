export type ServiceWorkerUpdate = (reloadPage?: boolean) => Promise<void>;

export type ServiceWorkerRegistrationCallbacks = {
  onNeedRefresh: () => void;
  onOfflineReady: () => void;
};

export type RegisterPersonalOsServiceWorker = (
  callbacks: ServiceWorkerRegistrationCallbacks,
) => ServiceWorkerUpdate;

const noUpdateAvailable: ServiceWorkerUpdate = () => Promise.resolve();

export const registerPersonalOsServiceWorker: RegisterPersonalOsServiceWorker =
  (callbacks) => {
    if (!("serviceWorker" in navigator)) {
      return noUpdateAvailable;
    }

    const serviceWorker = navigator.serviceWorker;
    const registrationPromise = serviceWorker
      .register("/sw.js")
      .then((registration) => {
        const observedWorkers = new WeakSet<ServiceWorker>();
        const notifyWhenInstalled = (worker: ServiceWorker) => {
          if (observedWorkers.has(worker)) {
            return;
          }
          observedWorkers.add(worker);

          worker.addEventListener("statechange", () => {
            if (worker.state !== "installed") {
              return;
            }

            if (serviceWorker.controller) {
              callbacks.onNeedRefresh();
            } else {
              callbacks.onOfflineReady();
            }
          });
        };

        if (registration.waiting && serviceWorker.controller) {
          callbacks.onNeedRefresh();
        } else if (registration.installing) {
          notifyWhenInstalled(registration.installing);
        } else if (registration.active && !serviceWorker.controller) {
          callbacks.onOfflineReady();
        }

        registration.addEventListener("updatefound", () => {
          if (registration.installing) {
            notifyWhenInstalled(registration.installing);
          }
        });

        return registration;
      })
      .catch(() => undefined);

    return async (reloadPage = false) => {
      const registration = await registrationPromise;

      if (!registration?.waiting) {
        return;
      }

      const activated = new Promise<void>((resolve) => {
        serviceWorker.addEventListener(
          "controllerchange",
          () => {
            if (reloadPage) {
              window.location.reload();
            }
            resolve();
          },
          { once: true },
        );
      });

      registration.waiting.postMessage({ type: "SKIP_WAITING" });
      await activated;
    };
  };
