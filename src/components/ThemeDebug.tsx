import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeDebug() {
  const { theme, resolvedTheme, systemTheme, themes } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [domInfo, setDomInfo] = useState<{
    htmlDataTheme: string | null;
    htmlClass: string;
    computedBg: string;
    computedColor: string;
  } | null>(null);
  const [chromeTheme, setChromeTheme] = useState<string>("unknown");

  useEffect(() => {
    setMounted(true);
    
    // Get DOM info
    const html = document.documentElement;
    const computedStyle = getComputedStyle(document.body);
    setDomInfo({
      htmlDataTheme: html.getAttribute("data-theme"),
      htmlClass: html.className,
      computedBg: computedStyle.backgroundColor,
      computedColor: computedStyle.color,
    });

    // Get Chrome DevTools theme
    if (typeof chrome !== "undefined" && chrome.devtools?.panels?.themeName) {
      setChromeTheme(chrome.devtools.panels.themeName);
    } else {
      setChromeTheme("API not available");
    }
  }, [theme, resolvedTheme]);

  if (!mounted) {
    return <div className="p-4">Loading theme info...</div>;
  }

  return (
    <div className="p-4 space-y-4 font-mono text-xs">
      <h2 className="text-lg font-bold mb-4">🎨 Theme Debug Info</h2>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="p-3 border rounded bg-card">
          <h3 className="font-bold mb-2 text-primary">next-themes State</h3>
          <div className="space-y-1">
            <div><span className="text-muted-foreground">theme:</span> <span className="text-green-500">{theme ?? "undefined"}</span></div>
            <div><span className="text-muted-foreground">resolvedTheme:</span> <span className="text-green-500">{resolvedTheme ?? "undefined"}</span></div>
            <div><span className="text-muted-foreground">systemTheme:</span> <span className="text-green-500">{systemTheme ?? "undefined"}</span></div>
            <div><span className="text-muted-foreground">themes:</span> <span className="text-green-500">{themes?.join(", ")}</span></div>
          </div>
        </div>

        <div className="p-3 border rounded bg-card">
          <h3 className="font-bold mb-2 text-primary">Chrome DevTools</h3>
          <div className="space-y-1">
            <div><span className="text-muted-foreground">chrome.devtools.panels.themeName:</span></div>
            <div className="text-green-500">{chromeTheme}</div>
          </div>
        </div>

        <div className="p-3 border rounded bg-card">
          <h3 className="font-bold mb-2 text-primary">DOM State</h3>
          <div className="space-y-1">
            <div><span className="text-muted-foreground">html[data-theme]:</span> <span className="text-green-500">{domInfo?.htmlDataTheme ?? "null"}</span></div>
            <div><span className="text-muted-foreground">html.className:</span> <span className="text-green-500">{domInfo?.htmlClass || "(empty)"}</span></div>
          </div>
        </div>

        <div className="p-3 border rounded bg-card">
          <h3 className="font-bold mb-2 text-primary">Computed Styles (body)</h3>
          <div className="space-y-1">
            <div><span className="text-muted-foreground">background-color:</span></div>
            <div className="text-green-500 break-all">{domInfo?.computedBg}</div>
            <div><span className="text-muted-foreground">color:</span></div>
            <div className="text-green-500 break-all">{domInfo?.computedColor}</div>
          </div>
        </div>
      </div>

      <div className="p-3 border rounded bg-card">
        <h3 className="font-bold mb-2 text-primary">Color Swatches</h3>
        <div className="flex gap-2 flex-wrap">
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 bg-background border rounded" />
            <span className="text-[10px]">background</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 bg-foreground border rounded" />
            <span className="text-[10px]">foreground</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 bg-card border rounded" />
            <span className="text-[10px]">card</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 bg-primary border rounded" />
            <span className="text-[10px]">primary</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 bg-secondary border rounded" />
            <span className="text-[10px]">secondary</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 bg-muted border rounded" />
            <span className="text-[10px]">muted</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 bg-accent border rounded" />
            <span className="text-[10px]">accent</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 bg-destructive border rounded" />
            <span className="text-[10px]">destructive</span>
          </div>
        </div>
      </div>

      <div className="p-3 border rounded bg-card">
        <h3 className="font-bold mb-2 text-primary">Expected Values</h3>
        <div className="text-muted-foreground text-[10px]">
          <p>Dark mode background should be: <code className="text-green-500">oklch(14.5% 0 0)</code> ≈ rgb(20, 20, 20)</p>
          <p>Light mode background should be: <code className="text-green-500">oklch(100% 0 0)</code> = rgb(255, 255, 255)</p>
        </div>
      </div>
    </div>
  );
}
