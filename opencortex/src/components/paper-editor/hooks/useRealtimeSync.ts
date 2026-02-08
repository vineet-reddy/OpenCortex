"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { PaperDetail } from "./usePaperData";

export function useRealtimeSync(
  paperId: string,
  onUpdate: (data: PaperDetail) => void
) {
  const [connected, setConnected] = useState(false);
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  const handleEvent = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      if (data && data.id) {
        onUpdateRef.current(data);
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  const reconnect = useCallback(() => {
    const es = new EventSource(`/api/papers/${paperId}/events`);

    es.onopen = () => setConnected(true);
    es.onmessage = handleEvent;
    es.addEventListener("paper:update", handleEvent);
    es.addEventListener("comment:new", handleEvent);
    es.addEventListener("edit:new", handleEvent);

    es.onerror = () => {
      setConnected(false);
      es.close();
      setTimeout(() => reconnect(), 3000);
    };

    return es;
  }, [paperId, handleEvent]);

  useEffect(() => {
    const es = reconnect();
    return () => {
      es.close();
      setConnected(false);
    };
  }, [reconnect]);

  return { connected };
}
