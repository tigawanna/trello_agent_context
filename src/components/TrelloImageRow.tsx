import { Button } from "@/components/ui/button";
import { copyImageToClipboard } from "@/lib/clipboard";
import { fetchImageAsDataUri, saveImageToDisk } from "@/lib/trello/proxyImage";
import type { EmbeddedImage, SavedImage } from "@/types/trelloAuth";
import { Clipboard, Download, Loader2 } from "lucide-react";
import { useCallback, useState } from "react";

type FetchStatus = "idle" | "loading" | "ready" | "error";
type SaveStatus = "idle" | "saving" | "saved" | "error";

interface TrelloImageRowProps {
  url: string;
  cardSlug: string;
  onHint: (msg: string) => void;
  onSaved?: (saved: SavedImage) => void;
}

export function TrelloImageRow({ url, cardSlug, onHint, onSaved }: TrelloImageRowProps) {
  const [fetchStatus, setFetchStatus] = useState<FetchStatus>("idle");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [image, setImage] = useState<EmbeddedImage | null>(null);
  const [savedPath, setSavedPath] = useState<string | null>(null);

  const ensureFetched = useCallback(async (): Promise<EmbeddedImage | null> => {
    if (image) return image;
    const fetched = await fetchImageAsDataUri(url);
    if (fetched) setImage(fetched);
    return fetched;
  }, [url, image]);

  const handleCopyAsImage = useCallback(async () => {
    setFetchStatus("loading");
    onHint("Fetching image…");

    const fetched = await ensureFetched();
    if (!fetched) {
      setFetchStatus("error");
      onHint("Failed to fetch image");
      return;
    }

    setFetchStatus("ready");
    const ok = await copyImageToClipboard(fetched.dataUri);
    onHint(ok ? "Image copied — paste into agent" : "Clipboard write blocked — right-click thumbnail instead");
  }, [ensureFetched, onHint]);

  const handleSaveToDisk = useCallback(async () => {
    setSaveStatus("saving");
    onHint("Saving to Downloads…");

    const saved = await saveImageToDisk(url, cardSlug);
    if (!saved) {
      setSaveStatus("error");
      onHint("Failed to save image");
      return;
    }

    setSavedPath(saved.filePath);
    setSaveStatus("saved");
    onSaved?.(saved);
    onHint(`Saved → ${saved.filePath}`);
  }, [url, cardSlug, onHint, onSaved]);

  const fileName = url.split("/").pop()?.split("?")[0] ?? "image";

  return (
    <li className="space-y-1">
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0 shrink-0"
          onClick={handleCopyAsImage}
          disabled={fetchStatus === "loading"}
          title="Copy image to clipboard (pasteable into agent)"
        >
          {fetchStatus === "loading" ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Clipboard className="w-3 h-3" />
          )}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0 shrink-0"
          onClick={handleSaveToDisk}
          disabled={saveStatus === "saving" || saveStatus === "saved"}
          title="Save image to Downloads folder"
        >
          {saveStatus === "saving" ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Download className="w-3 h-3" />
          )}
        </Button>
        <a
          className="text-primary underline truncate flex-1 min-w-0 text-xs"
          href={url}
          target="_blank"
          rel="noreferrer"
          title={url}
        >
          {fileName}
        </a>
        {fetchStatus === "error" && (
          <span className="text-[10px] text-destructive shrink-0">fetch failed</span>
        )}
        {saveStatus === "saved" && (
          <span className="text-[10px] text-emerald-600 shrink-0">saved</span>
        )}
      </div>
      {savedPath && (
        <code className="block text-[10px] font-mono text-muted-foreground truncate pl-7" title={savedPath}>
          {savedPath}
        </code>
      )}
      {image && (
        <img
          src={image.dataUri}
          alt={fileName}
          className="max-w-[200px] max-h-[120px] rounded border border-border object-contain bg-muted/20 cursor-pointer ml-7"
          title="Right-click → Copy Image as fallback"
        />
      )}
    </li>
  );
}
