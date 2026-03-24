import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { CapturedRequest } from "@/types/request";

interface WaterfallProps {
  requests: CapturedRequest[];
  selectedRequest: CapturedRequest | null;
  onSelectRequest: (request: CapturedRequest) => void;
}

function getStatusColor(status: number) {
  if (status >= 200 && status < 300) return "bg-green-500";
  if (status >= 300 && status < 400) return "bg-blue-500";
  if (status >= 400 && status < 500) return "bg-yellow-500";
  if (status >= 500) return "bg-red-500";
  return "bg-gray-500";
}

export function Waterfall({ requests, selectedRequest, onSelectRequest }: WaterfallProps) {
  const { minTime, maxTime, scale } = useMemo(() => {
    if (requests.length === 0) {
      return { minTime: 0, maxTime: 1000, scale: 1 };
    }
    const min = Math.min(...requests.map((r) => r.startTime));
    const max = Math.max(...requests.map((r) => r.endTime));
    const range = max - min || 1000;
    return { minTime: min, maxTime: max, scale: 100 / range };
  }, [requests]);

  const timeMarkers = useMemo(() => {
    const range = maxTime - minTime;
    const step = range / 5;
    return Array.from({ length: 6 }, (_, i) => ({
      time: minTime + step * i,
      label: `${((step * i) / 1000).toFixed(1)}s`,
      position: (step * i * scale),
    }));
  }, [minTime, maxTime, scale]);

  if (requests.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        No requests to display
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex border-b border-border text-xs text-muted-foreground">
        <div className="w-48 shrink-0 p-2 font-semibold">URL</div>
        <div className="flex-1 relative h-8">
          {timeMarkers.map((marker, i) => (
            <div
              key={i}
              className="absolute top-0 h-full border-l border-border/50 flex items-end pb-1 pl-1"
              style={{ left: `${marker.position}%` }}
            >
              <span className="text-[10px]">{marker.label}</span>
            </div>
          ))}
        </div>
      </div>

      <ScrollArea className="flex-1">
        {requests.map((request) => {
          const left = (request.startTime - minTime) * scale;
          const width = Math.max(request.duration * scale, 0.5);
          const isSelected = selectedRequest?.id === request.id;

          return (
            <div
              key={request.id}
              className={cn(
                "flex items-center h-7 border-b border-border/50 cursor-pointer hover:bg-accent/50",
                isSelected && "bg-accent"
              )}
              onClick={() => onSelectRequest(request)}
            >
              <div className="w-48 shrink-0 px-2 truncate text-xs font-mono" title={request.url}>
                {new URL(request.url).pathname}
              </div>
              <div className="flex-1 relative h-full flex items-center">
                {timeMarkers.map((_, i) => (
                  <div
                    key={i}
                    className="absolute top-0 h-full border-l border-border/20"
                    style={{ left: `${(100 / 5) * i}%` }}
                  />
                ))}
                <div
                  className={cn(
                    "absolute h-4 rounded-sm flex items-center justify-end pr-1",
                    getStatusColor(request.status)
                  )}
                  style={{
                    left: `${left}%`,
                    width: `${width}%`,
                    minWidth: "2px",
                  }}
                >
                  {width > 5 && (
                    <span className="text-[10px] text-white font-medium">
                      {request.duration.toFixed(0)}ms
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </ScrollArea>
    </div>
  );
}
