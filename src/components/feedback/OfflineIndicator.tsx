import { useSyncExternalStore } from "react";

function subscribeToOnlineStatus(onStoreChange: () => void) {
  window.addEventListener("online", onStoreChange);
  window.addEventListener("offline", onStoreChange);

  return () => {
    window.removeEventListener("online", onStoreChange);
    window.removeEventListener("offline", onStoreChange);
  };
}

function getOnlineSnapshot() {
  return navigator.onLine;
}

export function OfflineIndicator() {
  const isOnline = useSyncExternalStore(
    subscribeToOnlineStatus,
    getOnlineSnapshot,
    () => true,
  );

  if (isOnline) {
    return null;
  }

  return (
    <span className="offline-indicator" role="status" aria-live="polite">
      Offline
    </span>
  );
}
