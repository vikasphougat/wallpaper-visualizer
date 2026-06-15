import { useEffect, useMemo, useState } from "react";
import { Image } from "react-native";
import { PATTERNS } from "@/data/catalog";
import { fetchMarshallsCatalog, getMarshallsCatalogSync } from "@/data/marshallsSync";
import { buildTrayLibrary } from "@/lib/trayLibrary";
import { thumbTexture } from "@/lib/thumbTexture";
import { useSelection } from "@/stores/selection";
import type { Wallpaper } from "@/types";

export function useWallpaperLibrary() {
  const selectedId = useSelection((s) => s.wallpaper.id);
  const [marshalls, setMarshalls] = useState<Wallpaper[]>([]);
  const [syncing, setSyncing] = useState(true);
  const [syncedAt, setSyncedAt] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cached = await getMarshallsCatalogSync();
      if (!cancelled) setMarshalls(cached);
      try {
        const fresh = await fetchMarshallsCatalog();
        if (!cancelled) {
          setMarshalls(fresh);
          setSyncedAt(Date.now());
        }
      } finally {
        if (!cancelled) setSyncing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const library = useMemo(() => [...PATTERNS, ...marshalls], [marshalls]);
  const trayLibrary = useMemo(() => buildTrayLibrary(library, selectedId), [library, selectedId]);

  useEffect(() => {
    trayLibrary.slice(0, 20).forEach((w) => {
      const uri = thumbTexture(w.texture);
      if (uri.startsWith("http")) void Image.prefetch(uri);
    });
  }, [trayLibrary]);

  return { library, trayLibrary, syncing, syncedAt, marshallsCount: marshalls.length };
}
