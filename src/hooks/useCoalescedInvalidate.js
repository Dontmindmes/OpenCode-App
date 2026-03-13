import { useCallback, useEffect, useRef } from "react";

import { queryClient } from "../providers/AppProviders";

export function useCoalescedInvalidate(delay = 180) {
  const timerRef = useRef(null);
  const queuedRef = useRef(new Map());

  const flush = useCallback(() => {
    const entries = Array.from(queuedRef.current.values());
    queuedRef.current.clear();
    timerRef.current = null;

    entries.forEach((queryKey) => {
      queryClient.invalidateQueries({ queryKey });
    });
  }, []);

  const queueInvalidate = useCallback(
    (queryKey) => {
      queuedRef.current.set(JSON.stringify(queryKey), queryKey);

      if (timerRef.current) {
        return;
      }

      timerRef.current = setTimeout(flush, delay);
    },
    [delay, flush],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return queueInvalidate;
}
