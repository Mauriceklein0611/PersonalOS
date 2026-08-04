const onlineCheckTimeoutMilliseconds = 3_000;

export async function canReachOrigin(
  fetchFromOrigin: typeof window.fetch = window.fetch.bind(window),
): Promise<boolean> {
  if (!navigator.onLine) {
    return false;
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(
    () => controller.abort(),
    onlineCheckTimeoutMilliseconds,
  );

  try {
    await fetchFromOrigin(
      `/__personalos-online-check__?time=${encodeURIComponent(new Date().toISOString())}`,
      {
        cache: "no-store",
        credentials: "same-origin",
        method: "HEAD",
        signal: controller.signal,
      },
    );
    return true;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeout);
  }
}
