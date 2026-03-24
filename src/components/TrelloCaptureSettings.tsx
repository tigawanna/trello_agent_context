import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Clock, Database, Save } from "lucide-react";
import { useEffect, useState } from "react";

const RETENTION_OPTIONS = [
  { value: 1, label: "1 hour" },
  { value: 6, label: "6 hours" },
  { value: 12, label: "12 hours" },
  { value: 24, label: "24 hours" },
  { value: 48, label: "48 hours" },
  { value: 72, label: "3 days" },
  { value: 168, label: "1 week" },
];

const ENDPOINT_LIMIT_OPTIONS = [
  { value: 10, label: "10" },
  { value: 25, label: "25" },
  { value: 50, label: "50" },
  { value: 100, label: "100" },
  { value: 200, label: "200" },
];

const TOTAL_LIMIT_OPTIONS = [
  { value: 100, label: "100" },
  { value: 250, label: "250" },
  { value: 500, label: "500" },
  { value: 1000, label: "1,000" },
  { value: 2000, label: "2,000" },
];

interface TrelloCaptureSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionRetentionHours: number;
  maxRequestsPerEndpoint: number;
  maxTotalRequests: number;
  onSave: (v: {
    sessionRetentionHours: number;
    maxRequestsPerEndpoint: number;
    maxTotalRequests: number;
  }) => void;
}

export function TrelloCaptureSettings({
  open,
  onOpenChange,
  sessionRetentionHours,
  maxRequestsPerEndpoint,
  maxTotalRequests,
  onSave,
}: TrelloCaptureSettingsProps) {
  const [retentionHours, setRetentionHours] = useState(sessionRetentionHours);
  const [endpointLimit, setEndpointLimit] = useState(maxRequestsPerEndpoint);
  const [totalLimit, setTotalLimit] = useState(maxTotalRequests);

  useEffect(() => {
    if (!open) return;
    setRetentionHours(sessionRetentionHours);
    setEndpointLimit(maxRequestsPerEndpoint);
    setTotalLimit(maxTotalRequests);
  }, [open, sessionRetentionHours, maxRequestsPerEndpoint, maxTotalRequests]);

  const handleSave = () => {
    onSave({
      sessionRetentionHours: retentionHours,
      maxRequestsPerEndpoint: endpointLimit,
      maxTotalRequests: totalLimit,
    });
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[min(100%,380px)] sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Capture storage</SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-8rem)] mt-4 pr-4">
          <div className="space-y-5 text-sm">
            <p className="text-muted-foreground">
              Only Trello API traffic is recorded. These limits trim older rows so the panel stays fast.
            </p>
            <div>
              <label className="flex items-center gap-2 font-medium mb-2">
                <Clock className="w-4 h-4" />
                Retention
              </label>
              <select
                className="w-full border border-border rounded-md bg-background px-2 py-2 text-sm"
                value={retentionHours}
                onChange={(e) => setRetentionHours(Number(e.target.value))}
              >
                {RETENTION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="flex items-center gap-2 font-medium mb-2">
                <Database className="w-4 h-4" />
                Max rows per URL pattern
              </label>
              <select
                className="w-full border border-border rounded-md bg-background px-2 py-2 text-sm"
                value={endpointLimit}
                onChange={(e) => setEndpointLimit(Number(e.target.value))}
              >
                {ENDPOINT_LIMIT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="flex items-center gap-2 font-medium mb-2">
                <Database className="w-4 h-4" />
                Max total rows
              </label>
              <select
                className="w-full border border-border rounded-md bg-background px-2 py-2 text-sm"
                value={totalLimit}
                onChange={(e) => setTotalLimit(Number(e.target.value))}
              >
                {TOTAL_LIMIT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <Button className="w-full" onClick={handleSave}>
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
