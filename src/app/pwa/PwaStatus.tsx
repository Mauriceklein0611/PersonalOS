import { useEffect, useRef, useState } from "react";

import { Toast } from "../../components/ui/Toast";
import {
  registerPersonalOsServiceWorker,
  type RegisterPersonalOsServiceWorker,
  type ServiceWorkerUpdate,
} from "./register-service-worker";

type PwaStatusProps = {
  registerServiceWorker?: RegisterPersonalOsServiceWorker;
};

const noUpdateAvailable: ServiceWorkerUpdate = () => Promise.resolve();

export function PwaStatus({
  registerServiceWorker = registerPersonalOsServiceWorker,
}: PwaStatusProps) {
  const [offlineReady, setOfflineReady] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const updateServiceWorker = useRef<ServiceWorkerUpdate>(noUpdateAvailable);

  useEffect(() => {
    updateServiceWorker.current = registerServiceWorker({
      onNeedRefresh: () => setUpdateAvailable(true),
      onOfflineReady: () => setOfflineReady(true),
    });
  }, [registerServiceWorker]);

  const activateUpdate = () => {
    void updateServiceWorker.current(true);
  };

  if (!offlineReady && !updateAvailable) {
    return null;
  }

  return (
    <div className="pwa-toast-region">
      {updateAvailable ? (
        <Toast
          action={{ label: "Jetzt aktualisieren", onClick: activateUpdate }}
          message="Eine neue Version ist bereit. Aktualisiere erst, wenn deine Eingaben gespeichert sind."
          onDismiss={() => setUpdateAvailable(false)}
          title="Update verfügbar"
        />
      ) : null}
      {offlineReady ? (
        <Toast
          message="PersonalOS kann jetzt ohne Netzwerk gestartet werden."
          onDismiss={() => setOfflineReady(false)}
          title="Offline bereit"
          tone="success"
        />
      ) : null}
    </div>
  );
}
