export function isSafeExternalHref(href: string): boolean {
  try {
    const url = new URL(href);
    return (
      url.protocol === "https:" && url.username === "" && url.password === ""
    );
  } catch {
    return false;
  }
}
