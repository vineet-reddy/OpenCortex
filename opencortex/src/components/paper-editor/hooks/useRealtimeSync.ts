"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { PaperDetail } from "./usePaperData";

export function useRealtimeSync(
  paperId: string,
  onUpdate: (data: PaperDetail) => void
) {
  const [connected, setConnected] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  const reconnect = useCallback(() => {
    const es = new EventSource(`/api/papers/${paperId}/events`);

    es.onopen = () => {
      setConnected(true);
    };

    es.addEventListener("paper:update", (event) => {
      try {
        const data = JSON.parse(event.data);
        onUpdateRef.current(data);
        setLastSync(new Date());
      } catch {
        // ignore parse errors
      }
    });

    es.addEventListener("comment:new", (event) => {
      try {
        const data = JSON.parse(event.data);
        onUpdateRef.current(data);
        setLastSync(new Date());
      } catch {
        // ignore
      }
    });

    es.addEventListener("edit:new", (event) => {
      try {
        const data = JSON.parse(event.data);
        onUpdateRef.current(data);
        setLastSync(new Date());
      } catch {
        // ignore
      }
    });

    // Default message handler (initial data)
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data && data.id) {
          onUpdateRef.current(data);
          setLastSync(new Date());
        }
      } catch {
        // ignore
      }
    };

    es.onerror = () => {
      setConnected(false);
      es.close();
      // Auto-reconnect after 3 seconds
      setTimeout(() => reconnect(), 3000);
    };

    return es;
  }, [paperId]);

  useEffect(() => {
    const es = reconnect();
    return () => {
      es.close();
      setConnected(false);
    };
  }, [reconnect]);

  return { connected, lastSync };
}
