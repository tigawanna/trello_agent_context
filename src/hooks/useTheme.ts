import { useState, useEffect } from "react";

type Theme = "light" | "dark";
type ThemeMode = "system" | "light" | "dark";

function getDevToolsTheme(): Theme {
  // Chrome DevTools API: themeName is "default" (light) or "dark"
  if (typeof chrome !== "undefined" && chrome.devtools?.panels?.themeName) {
    return chrome.devtools.panels.themeName === "dark" ? "dark" : "light";
  }
  // Fallback to system preference
  if (typeof window !== "undefined") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "light";
}

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("themeMode") as ThemeMode;
      if (stored) return stored;
    }
    return "system"; // Default to following Chrome DevTools theme
  });

  const [resolvedTheme, setResolvedTheme] = useState<Theme>(() => {
    if (mode === "system") {
      return getDevToolsTheme();
    }
    return mode;
  });

  // Update resolved theme when mode changes or when DevTools theme changes
  useEffect(() => {
    const updateResolvedTheme = () => {
      if (mode === "system") {
        setResolvedTheme(getDevToolsTheme());
      } else {
        setResolvedTheme(mode);
      }
    };

    updateResolvedTheme();

    // Listen for Chrome DevTools theme changes
    if (typeof chrome !== "undefined" && chrome.devtools?.panels?.setThemeChangeHandler) {
      chrome.devtools.panels.setThemeChangeHandler((theme) => {
        if (mode === "system") {
          setResolvedTheme(theme === "dark" ? "dark" : "light");
        }
      });
    }

    // Also listen for system preference changes as fallback
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      if (mode === "system") {
        updateResolvedTheme();
      }
    };
    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
      // Clear the theme change handler
      if (typeof chrome !== "undefined" && chrome.devtools?.panels?.setThemeChangeHandler) {
        chrome.devtools.panels.setThemeChangeHandler(undefined);
      }
    };
  }, [mode]);

  // Apply theme data attribute to document
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", resolvedTheme);
  }, [resolvedTheme]);

  // Persist mode preference
  useEffect(() => {
    localStorage.setItem("themeMode", mode);
  }, [mode]);

  const toggleTheme = () => {
    // Cycle through: system -> light -> dark -> system
    setMode((prev) => {
      if (prev === "system") return "light";
      if (prev === "light") return "dark";
      return "system";
    });
  };

  return {
    theme: resolvedTheme,
    mode,
    setMode,
    toggleTheme,
    isSystem: mode === "system",
  };
}
