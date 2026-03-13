import { useEffect, useMemo, useState } from "react";

import { readHostSecret } from "../lib/storage";
import { useAppStore } from "../store/appStore";

export function useSelectedHost() {
  const hosts = useAppStore((state) => state.hosts);
  const selectedHostId = useAppStore((state) => state.selectedHostId);
  const [secret, setSecret] = useState(null);
  const [loading, setLoading] = useState(true);

  const meta = useMemo(() => hosts.find((item) => item.id === selectedHostId) || null, [hosts, selectedHostId]);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!selectedHostId) {
        setSecret(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      const value = await readHostSecret(selectedHostId);

      if (!active) {
        return;
      }

      setSecret(value);
      setLoading(false);
    }

    load();

    return () => {
      active = false;
    };
  }, [selectedHostId]);

  const host = useMemo(() => (meta && secret ? { ...meta, ...secret } : null), [meta, secret]);

  return {
    loading,
    host,
    meta,
  };
}
