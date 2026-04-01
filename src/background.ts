import browser from "webextension-polyfill";

console.log("Hello from the background!");

browser.runtime.onInstalled.addListener((details) => {
  console.log("Extension installed:", details);
});

interface ProxyFetchRequest {
  type: "PROXY_FETCH";
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

interface ProxyFetchImageRequest {
  type: "PROXY_FETCH_IMAGE";
  url: string;
}

interface SaveImageToDiskRequest {
  type: "SAVE_IMAGE_TO_DISK";
  url: string;
  cardSlug: string;
  fileName: string;
}

interface ProxyFetchResponse {
  success: true;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  duration: number;
}

interface ProxyFetchImageResponse {
  success: true;
  dataUri: string;
  mimeType: string;
  sizeBytes: number;
}

interface SaveImageToDiskResponse {
  success: true;
  filePath: string;
  mimeType: string;
  sizeBytes: number;
}

interface ProxyFetchError {
  success: false;
  error: string;
  details: string;
}

type ProxyFetchResult = ProxyFetchResponse | ProxyFetchError;
type ProxyFetchImageResult = ProxyFetchImageResponse | ProxyFetchError;
type SaveImageToDiskResult = SaveImageToDiskResponse | ProxyFetchError;
type BgMessage = ProxyFetchRequest | ProxyFetchImageRequest | SaveImageToDiskRequest;

browser.runtime.onMessage.addListener(
  (message: BgMessage, _sender): Promise<ProxyFetchResult | ProxyFetchImageResult | SaveImageToDiskResult> | undefined => {
    if (message.type === "PROXY_FETCH") {
      return handleProxyFetch(message);
    }
    if (message.type === "PROXY_FETCH_IMAGE") {
      return handleProxyFetchImage(message);
    }
    if (message.type === "SAVE_IMAGE_TO_DISK") {
      return handleSaveImageToDisk(message);
    }
    return undefined;
  }
);

const FORBIDDEN_HEADERS = new Set([
  "host", "content-length", "connection", "cookie",
  "sec-fetch-dest", "sec-fetch-mode", "sec-fetch-site", "sec-fetch-user",
  "sec-ch-ua", "sec-ch-ua-mobile", "sec-ch-ua-platform",
  "if-none-match", "if-modified-since", "cache-control",
]);

function sanitizeHeaders(headers: Record<string, string>): {
  sanitized: Record<string, string>;
  skipped: string[];
} {
  const sanitized: Record<string, string> = {};
  const skipped: string[] = [];
  for (const [key, value] of Object.entries(headers)) {
    if (key.startsWith(":")) {
      skipped.push(key);
      continue;
    }
    if (FORBIDDEN_HEADERS.has(key.toLowerCase())) {
      skipped.push(key);
      continue;
    }
    sanitized[key] = value;
  }
  return { sanitized, skipped };
}

async function handleProxyFetch(request: ProxyFetchRequest): Promise<ProxyFetchResult> {
  const { url, method, headers, body } = request;
  const { sanitized: sanitizedHeaders, skipped: skippedHeaders } = sanitizeHeaders(headers);
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

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function fetchImageBuffer(url: string): Promise<{ buffer: ArrayBuffer; mimeType: string } | ProxyFetchError> {
  try {
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) {
      return {
        success: false,
        error: `HTTP ${res.status} ${res.statusText}`,
        details: `Failed to fetch image: ${url}`,
      };
    }
    const contentType = res.headers.get("content-type") ?? "application/octet-stream";
    const buffer = await res.arrayBuffer();
    const mimeType = contentType.split(";")[0].trim();
    return { buffer, mimeType };
  } catch (err) {
    const error = err as Error;
    return {
      success: false,
      error: error.message || "Unknown error",
      details: `Failed to fetch image: ${url}`,
    };
  }
}

async function handleProxyFetchImage(request: ProxyFetchImageRequest): Promise<ProxyFetchImageResult> {
  const result = await fetchImageBuffer(request.url);
  if ("success" in result && !result.success) return result;
  const { buffer, mimeType } = result as { buffer: ArrayBuffer; mimeType: string };
  const base64 = arrayBufferToBase64(buffer);
  const dataUri = `data:${mimeType};base64,${base64}`;

  return {
    success: true,
    dataUri,
    mimeType,
    sizeBytes: buffer.byteLength,
  };
}

function sanitizeFileName(name: string): string {
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").replace(/\s+/g, "_").slice(0, 120);
}

function waitForDownload(downloadId: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const onChanged = (delta: chrome.downloads.DownloadDelta) => {
      if (delta.id !== downloadId) return;
      if (delta.state?.current === "complete") {
        chrome.downloads.onChanged.removeListener(onChanged);
        chrome.downloads.search({ id: downloadId }, (items) => {
          if (items?.[0]?.filename) resolve(items[0].filename);
          else reject(new Error("Download completed but path unavailable"));
        });
      }
      if (delta.state?.current === "interrupted") {
        chrome.downloads.onChanged.removeListener(onChanged);
        reject(new Error(delta.error?.current ?? "Download interrupted"));
      }
    };
    chrome.downloads.onChanged.addListener(onChanged);
  });
}

async function handleSaveImageToDisk(request: SaveImageToDiskRequest): Promise<SaveImageToDiskResult> {
  const result = await fetchImageBuffer(request.url);
  if ("success" in result && !result.success) return result;
  const { buffer, mimeType } = result as { buffer: ArrayBuffer; mimeType: string };
  const base64 = arrayBufferToBase64(buffer);
  const dataUri = `data:${mimeType};base64,${base64}`;

  const cardDir = sanitizeFileName(request.cardSlug || "card");
  const fileName = sanitizeFileName(request.fileName || "image");
  const relativePath = `trello-images/${cardDir}/${fileName}`;

  try {
    const downloadId = await new Promise<number>((resolve, reject) => {
      chrome.downloads.download(
        {
          url: dataUri,
          filename: relativePath,
          conflictAction: "uniquify",
          saveAs: false,
        },
        (id) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(id);
          }
        }
      );
    });

    const filePath = await waitForDownload(downloadId);

    return {
      success: true,
      filePath,
      mimeType,
      sizeBytes: buffer.byteLength,
    };
  } catch (err) {
    const error = err as Error;
    return {
      success: false,
      error: error.message || "Download failed",
      details: `Failed to save image to disk: ${request.url}`,
    };
  }
}
