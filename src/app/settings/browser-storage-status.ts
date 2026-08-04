export type BrowserStorageStatus = {
  persisted?: boolean;
  quota?: number;
  usage?: number;
};

export type ReadBrowserStorageStatus = () => Promise<BrowserStorageStatus>;

export const readBrowserStorageStatus: ReadBrowserStorageStatus = async () => {
  const storage = navigator.storage;
  if (!storage) {
    return {};
  }

  let estimate: StorageEstimate = {};
  try {
    estimate = await storage.estimate();
  } catch {
    // Hardened or private browser contexts may deny storage estimates.
  }
  const persisted =
    typeof storage.persisted === "function"
      ? await storage.persisted().catch(() => undefined)
      : undefined;

  return {
    persisted,
    quota: estimate.quota,
    usage: estimate.usage,
  };
};

export function formatStorageBytes(bytes: number): string {
  const mebibytes = bytes / (1024 * 1024);
  return `${new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: mebibytes < 10 ? 1 : 0,
  }).format(mebibytes)} MB`;
}
