import { useMemo } from "react";
import { PATTERNS } from "@/data/catalog";
import { useMarshallsCatalog } from "./useMarshallsCatalog";

/** Full wallpaper library: SVG patterns + synced Marshalls catalog. */
export function useWallpaperLibrary() {
  const { marshalls, syncing, syncedAt } = useMarshallsCatalog();
  const library = useMemo(() => [...PATTERNS, ...marshalls], [marshalls]);
  return { library, syncing, syncedAt, marshallsCount: marshalls.length };
}
