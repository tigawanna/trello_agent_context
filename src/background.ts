import browser from "webextension-polyfill";

console.log("Hello from the background!");

browser.runtime.onInstalled.addListener((details) => {
  console.log("Extension installed:", details);
});

// Message types for type safety
interface ProxyFetchRequest {
  type: "PROXY_FETCH";
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

interface ProxyFetchResponse {
  success: true;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  duration: number;
}

interface ProxyFetchError {
  success: false;
  error: string;
  details: string;
}

type ProxyFetchResult = ProxyFetchResponse | ProxyFetchError;

// Handle messages from DevTools panel
browser.runtime.onMessage.addListener(
  (message: ProxyFetchRequest, _sender): Promise<ProxyFetchResult> | undefined => {
    if (message.type === "PROXY_FETCH") {
      return handleProxyFetch(message);
    }
    return undefined;
  }
);

async function handleProxyFetch(request: ProxyFetchRequest): Promise<ProxyFetchResult> {
  const { url, method, headers, body } = request;
  
  // Filter out problematic headers
  const sanitizedHeaders: Record<string, string> = {};
  const skippedHeaders: string[] = [];
  
  for (const [key, value] of Object.entries(headers)) {
    // Skip HTTP/2 pseudo-headers and browser-controlled headers
    if (key.startsWith(":")) {
      skippedHeaders.push(key);
      continue;
    }
    const lowerKey = key.toLowerCase();
    const forbidden = [
      "host", "content-length", "connection", "cookie",
      "sec-fetch-dest", "sec-fetch-mode", "sec-fetch-site", "sec-fetch-user",
      "sec-ch-ua", "sec-ch-ua-mobile", "sec-ch-ua-platform",
      // Cache headers - remove to force fresh response (avoid 304)
      "if-none-match", "if-modified-since", "cache-control",
    ];
    if (forbidden.includes(lowerKey)) {
      skippedHeaders.push(key);
      continue;
    }
    sanitizedHeaders[key] = value;
  }

  const startTime = performance.now();

  try {
    const fetchOptions: RequestInit = {
      method,
      headers: sanitizedHeaders,
      credentials: "include",
    };

    if (method !== "GET" && method !== "HEAD" && body) {
      fetchOptions.body = body;
    }

    const res = await fetch(url, fetchOptions);
    const duration = performance.now() - startTime;

    const responseHeaders: Record<string, string> = {};
    res.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    let responseBody = "";
    try {
      responseBody = await res.text();
    } catch {
      responseBody = "[Could not read response body]";
    }

    return {
      success: true,
      status: res.status,
      statusText: res.statusText,
      headers: responseHeaders,
      body: responseBody,
      duration,
    };
  } catch (err) {
    const error = err as Error;
    return {
      success: false,
      error: error.message || "Unknown error",
      details: `${error.name}: ${error.message}\n\nURL: ${url}\nMethod: ${method}\nSkipped headers: ${skippedHeaders.join(", ") || "none"}`,
    };
  }
}
