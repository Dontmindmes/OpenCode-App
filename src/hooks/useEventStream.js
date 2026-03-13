import { useEffect, useRef, useState } from "react";

import EventSource from "react-native-sse";

import { createAuthHeaders } from "../lib/opencode";

function parsePayload(message) {
  if (!message?.data) {
    return null;
  }

  try {
    return JSON.parse(message.data);
  } catch {
    return { type: message.type || "message", data: message.data };
  }
}

export function useEventStream({ host, projectPath, enabled = true, onEvent }) {
  const onEventRef = useRef(onEvent);
  const [state, setState] = useState("idle");

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!enabled || !host?.baseUrl) {
      return undefined;
    }

    const eventSource = new EventSource(`${host.baseUrl}/event`, {
      headers: createAuthHeaders(host, projectPath),
      pollingInterval: 0,
    });

    setState("connecting");

    eventSource.addEventListener("open", () => {
      setState("open");
    });

    eventSource.addEventListener("message", (message) => {
      const payload = parsePayload(message);

      if (payload && onEventRef.current) {
        onEventRef.current(payload);
      }
    });

    eventSource.addEventListener("error", () => {
      setState("error");
    });

    return () => {
      setState("closed");
      eventSource.close();
    };
  }, [enabled, host, projectPath]);

  return state;
}
