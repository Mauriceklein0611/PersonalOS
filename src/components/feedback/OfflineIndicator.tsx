import { useEffect, useState } from "react";

import { canReachOrigin } from "./online-status";

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    let isMounted = true;
    const checkConnection = async () => {
      const nextStatus = import.meta.env.PROD
        ? await canReachOrigin()
        : navigator.onLine;
      if (isMounted) {
        setIsOnline(nextStatus);
      }
    };

    const markOffline = () => setIsOnline(false);
    const checkOnline = () => void checkConnection();

    void checkConnection();
    window.addEventListener("offline", markOffline);
    window.addEventListener("online", checkOnline);
    document.addEventListener("visibilitychange", checkOnline);

    return () => {
      isMounted = false;
      window.removeEventListener("offline", markOffline);
      window.removeEventListener("online", checkOnline);
      document.removeEventListener("visibilitychange", checkOnline);
    };
  }, []);

  if (isOnline) {
    return null;
  }

  return (
    <span className="offline-indicator" role="status" aria-live="polite">
      Offline
    </span>
  );
}
