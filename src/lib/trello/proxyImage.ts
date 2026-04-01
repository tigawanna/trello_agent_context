import type { EmbeddedImage, SavedImage } from "@/types/trelloAuth";

interface ProxyFetchImageSuccess {
  success: true;
  dataUri: string;
  mimeType: string;
  sizeBytes: number;
}

interface SaveImageToDiskSuccess {
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

type ProxyFetchImageResult = ProxyFetchImageSuccess | ProxyFetchError;
type SaveImageToDiskResult = SaveImageToDiskSuccess | ProxyFetchError;

export async function fetchImageAsDataUri(url: string): Promise<EmbeddedImage | null> {
  try {
    const result: ProxyFetchImageResult = await chrome.runtime.sendMessage({
      type: "PROXY_FETCH_IMAGE",
      url,
    });

    if (!result.success) return null;

    return {
      originalUrl: url,
      dataUri: result.dataUri,
      mimeType: result.mimeType,
      sizeBytes: result.sizeBytes,
    };
  } catch {
    return null;
  }
}

export async function fetchAllImagesAsDataUri(
  urls: string[],
  onProgress?: (completed: number, total: number) => void
): Promise<Map<string, EmbeddedImage>> {
  const result = new Map<string, EmbeddedImage>();
  const unique = [...new Set(urls)];

  const settled = await Promise.allSettled(
    unique.map(async (url, idx) => {
      const image = await fetchImageAsDataUri(url);
      onProgress?.(idx + 1, unique.length);
      return { url, image };
    })
  );

  for (const entry of settled) {
    if (entry.status === "fulfilled" && entry.value.image) {
      result.set(entry.value.url, entry.value.image);
    }
  }

  return result;
}

function fileNameFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const last = pathname.split("/").pop() ?? "image";
    return last.split("?")[0] || "image";
  } catch {
    return "image";
  }
}

export async function saveImageToDisk(url: string, cardSlug: string): Promise<SavedImage | null> {
  try {
    const result: SaveImageToDiskResult = await chrome.runtime.sendMessage({
      type: "SAVE_IMAGE_TO_DISK",
      url,
      cardSlug,
      fileName: fileNameFromUrl(url),
    });

    if (!result.success) return null;

    return {
      originalUrl: url,
      filePath: result.filePath,
      mimeType: result.mimeType,
      sizeBytes: result.sizeBytes,
    };
  } catch {
    return null;
  }
}

export async function saveAllImagesToDisk(
  urls: string[],
  cardSlug: string,
  alreadySaved?: Map<string, SavedImage>,
  onProgress?: (completed: number, total: number) => void
): Promise<Map<string, SavedImage>> {
  const result = new Map<string, SavedImage>();
  const unique = [...new Set(urls)];

  for (let i = 0; i < unique.length; i++) {
    const existing = alreadySaved?.get(unique[i]);
    if (existing) {
      result.set(unique[i], existing);
      onProgress?.(i + 1, unique.length);
      continue;
    }
    const saved = await saveImageToDisk(unique[i], cardSlug);
    if (saved) result.set(unique[i], saved);
    onProgress?.(i + 1, unique.length);
  }

  return result;
}
