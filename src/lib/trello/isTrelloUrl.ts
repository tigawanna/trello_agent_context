export function isTrelloCaptureUrl(urlString: string): boolean {
  try {
    const u = new URL(urlString);
    const h = u.hostname.toLowerCase();
    if (h === "api.trello.com") return true;
    if (h === "trello.com" || h.endsWith(".trello.com")) return true;
    return false;
  } catch {
    return false;
  }
}
