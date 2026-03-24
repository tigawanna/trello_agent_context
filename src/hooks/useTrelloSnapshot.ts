import type { CapturedRequest } from "@/types/request";
import type { TrelloAggregateState } from "@/types/trello";
import { createInitialTrelloState, reduceTrelloState } from "@/lib/trello/aggregate";
import { parseTrelloFromRequest } from "@/lib/trello/parseTrelloRequest";
import { useEffect, useRef, useState } from "react";

export function useTrelloSnapshot(requests: CapturedRequest[]) {
  const [state, setState] = useState<TrelloAggregateState>(() => createInitialTrelloState());
  const processedIds = useRef(new Set<string>());

  useEffect(() => {
    if (requests.length === 0) {
      processedIds.current.clear();
      setState(createInitialTrelloState());
    }
  }, [requests.length]);

  useEffect(() => {
    const batch: ReturnType<typeof parseTrelloFromRequest> = [];
    for (const r of requests) {
      if (processedIds.current.has(r.id)) continue;
      processedIds.current.add(r.id);
      batch.push(...parseTrelloFromRequest(r));
    }
    if (!batch.length) return;
    setState((prev) => reduceTrelloState(prev, batch));
  }, [requests]);

  return state;
}
