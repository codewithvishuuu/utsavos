/** Accepts only same-origin absolute paths, so a login redirect cannot leave the app. */
export function safeDestination(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/")) return "/events";
  try {
    const url = new URL(value, window.location.origin);
    if (url.origin !== window.location.origin) return "/events";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/events";
  }
}
