import { useEffect, useState } from "react";
import type { Wallpaper } from "@/types";
import { fetchMarshallsCatalog, getMarshallsCatalogSync } from "@/data/marshallsSync";

/** Remote Marshalls catalog with bundled fallback + background sync. */
export function useMarshallsCatalog() {
  const [marshalls, setMarshalls] = useState<Wallpaper[]>(() => getMarshallsCatalogSync());
  const [syncing, setSyncing] = useState(false);
  const [syncedAt, setSyncedAt] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSyncing(true);
    fetchMarshallsCatalog()
      .then((items) => {
        if (!cancelled) {
          setMarshalls(items);
          setSyncedAt(Date.now());
        }
      })
      .finally(() => {
        if (!cancelled) setSyncing(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { marshalls, syncing, syncedAt };
}
