// URL parsing and pattern generation utilities

/**
 * Safely extract pathname from URL, returns fallback if invalid
 */
export function safePathname(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url || "/";
  }
}

/**
 * Generate URL pattern for grouping (replaces IDs with placeholders)
 */
export function generateUrlPattern(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split("/").filter(Boolean);
    const patternParts = pathParts.map((part) => {
      if (/^\d+$/.test(part)) return ":id";
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(part)) return ":uuid";
      if (/^[0-9a-f]{24}$/i.test(part)) return ":objectId";
      return part;
    });
    return `${urlObj.origin}/${patternParts.join("/")}`;
  } catch {
    return url;
  }
}

/**
 * Parse page URL into domain (with port) and path
 */
export function parsePageUrl(pageUrl: string): { domain: string; path: string } {
  try {
    const urlObj = new URL(pageUrl);
    const port = urlObj.port;
    const domain = port ? `${urlObj.hostname}:${port}` : urlObj.hostname;
    return { domain, path: urlObj.pathname };
  } catch {
    return { domain: "unknown", path: "/" };
  }
}

/**
 * Extract unique route segments from requests (excluding IDs)
 */
export function extractRouteSegments(urls: string[]): string[] {
  const segments = new Set<string>();
  for (const url of urls) {
    try {
      const pathname = new URL(url).pathname;
      const parts = pathname.split("/").filter(Boolean);
      parts.forEach((part) => {
        if (!/^\d+$/.test(part) && 
            !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(part) &&
            !/^[0-9a-f]{24}$/i.test(part)) {
          segments.add(part);
        }
      });
    } catch {
      // Ignore invalid URLs
    }
  }
  return Array.from(segments).sort();
}
