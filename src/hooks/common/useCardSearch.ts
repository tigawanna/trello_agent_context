import { listDetectedCards } from "@/lib/trello/aggregate";
import type { TrelloAggregateState, TrelloDetectedCardRow } from "@/types/trello";
import { useMemo, useState } from "react";
import { useDebounce } from "./useDebounce";

const SEARCH_DEBOUNCE_MS = 200;

interface UseCardSearchResult {
  query: string;
  setQuery: (value: string) => void;
  filteredRows: TrelloDetectedCardRow[];
}

export function useCardSearch(
  trelloState: TrelloAggregateState,
  laneFilter: string | null
): UseCardSearchResult {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, SEARCH_DEBOUNCE_MS);

  const filteredRows = useMemo(
    () => listDetectedCards(trelloState, laneFilter, debouncedQuery),
    [trelloState, laneFilter, debouncedQuery]
  );

  return { query, setQuery, filteredRows };
}
