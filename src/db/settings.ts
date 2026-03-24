import Dexie, { type EntityTable } from "dexie";

export interface UserSettings {
  id: string;
  jwtHeaders: string[];
  tokenPrefixes: string[];
  theme: "light" | "dark" | "system";
  sessionRetentionHours: number;
  /** Maximum requests to keep per URL pattern (endpoint). Older requests are garbage collected. */
  maxRequestsPerEndpoint: number;
  /** Maximum total requests to keep across all endpoints */
  maxTotalRequests: number;
}

const db = new Dexie("RequestVisualizerSettings") as Dexie & {
  settings: EntityTable<UserSettings, "id">;
};

db.version(1).stores({
  settings: "id",
});

export const DEFAULT_SETTINGS: UserSettings = {
  id: "user-settings",
  jwtHeaders: ["Authorization"],
  tokenPrefixes: ["Bearer", "Token", "JWT"],
  theme: "system",
  sessionRetentionHours: 24,
  maxRequestsPerEndpoint: 50,
  maxTotalRequests: 500,
};

export async function getSettings(): Promise<UserSettings> {
  const settings = await db.settings.get("user-settings");
  return settings ?? DEFAULT_SETTINGS;
}

export async function updateSettings(
  updates: Partial<Omit<UserSettings, "id">>
): Promise<void> {
  const current = await getSettings();
  await db.settings.put({ ...current, ...updates, id: "user-settings" });
}

export { db };
