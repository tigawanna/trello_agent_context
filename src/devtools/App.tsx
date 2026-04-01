import { TrelloAppView } from "@/components/TrelloAppView";
import { TrelloCaptureSettings } from "@/components/TrelloCaptureSettings";
import { DEFAULT_SETTINGS, getSettings, updateSettings } from "@/db/settings";
import { useNetworkCapture } from "@/hooks/useNetworkCapture";
import { useTrelloAuth } from "@/hooks/useTrelloAuth";
import { useTrelloSnapshot } from "@/hooks/useTrelloSnapshot";
import { garbageCollectRequests, updateGCConfig, useRequestStore } from "@/lib/tanstackdb";
import { useEffect, useState } from "react";

export default function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sessionRetentionHours, setSessionRetentionHours] = useState(DEFAULT_SETTINGS.sessionRetentionHours);
  const [maxRequestsPerEndpoint, setMaxRequestsPerEndpoint] = useState(DEFAULT_SETTINGS.maxRequestsPerEndpoint);
  const [maxTotalRequests, setMaxTotalRequests] = useState(DEFAULT_SETTINGS.maxTotalRequests);

  const { requests, addRequest, onNavigate, clearRequests, cleanupOldSessions, currentPageUrl } = useRequestStore();
  const trelloState = useTrelloSnapshot(requests);
  const trelloAuth = useTrelloAuth(requests);

  useNetworkCapture(addRequest, onNavigate);

  useEffect(() => {
    getSettings().then((settings) => {
      setSessionRetentionHours(settings.sessionRetentionHours);
      setMaxRequestsPerEndpoint(settings.maxRequestsPerEndpoint ?? DEFAULT_SETTINGS.maxRequestsPerEndpoint);
      setMaxTotalRequests(settings.maxTotalRequests ?? DEFAULT_SETTINGS.maxTotalRequests);
      updateGCConfig({
        maxRequestsPerEndpoint: settings.maxRequestsPerEndpoint ?? DEFAULT_SETTINGS.maxRequestsPerEndpoint,
        maxTotalRequests: settings.maxTotalRequests ?? DEFAULT_SETTINGS.maxTotalRequests,
      });
      cleanupOldSessions(settings.sessionRetentionHours);
      garbageCollectRequests();
    });
  }, [cleanupOldSessions]);

  useEffect(() => {
    const interval = setInterval(() => {
      cleanupOldSessions(sessionRetentionHours);
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [sessionRetentionHours, cleanupOldSessions]);

  const handleSaveCaptureSettings = async (partial: {
    sessionRetentionHours: number;
    maxRequestsPerEndpoint: number;
    maxTotalRequests: number;
  }) => {
    await updateSettings(partial);
    setSessionRetentionHours(partial.sessionRetentionHours);
    setMaxRequestsPerEndpoint(partial.maxRequestsPerEndpoint);
    setMaxTotalRequests(partial.maxTotalRequests);
    updateGCConfig({
      maxRequestsPerEndpoint: partial.maxRequestsPerEndpoint,
      maxTotalRequests: partial.maxTotalRequests,
    });
    garbageCollectRequests();
  };

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      <TrelloAppView
        trelloState={trelloState}
        captureCount={requests.length}
        inspectedPageUrl={currentPageUrl}
        trelloAuth={trelloAuth}
        onClearCapture={clearRequests}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <TrelloCaptureSettings
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        sessionRetentionHours={sessionRetentionHours}
        maxRequestsPerEndpoint={maxRequestsPerEndpoint}
        maxTotalRequests={maxTotalRequests}
        onSave={handleSaveCaptureSettings}
      />
    </div>
  );
}
