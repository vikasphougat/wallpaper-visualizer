import { PATTERNS } from "@/data/catalog";
import type { Wallpaper } from "@/types";

const TRAY_LIMIT = 48;

/** Quick-pick strip: built-ins first, then Marshalls — capped for fast open. */
export function buildTrayLibrary(library: Wallpaper[], selectedId?: string): Wallpaper[] {
  const seen = new Set<string>();
  const out: Wallpaper[] = [];

  const push = (w: Wallpaper) => {
    if (seen.has(w.id)) return;
    seen.add(w.id);
    out.push(w);
  };

  for (const p of PATTERNS) {
    const match = library.find((w) => w.id === p.id) ?? p;
    push(match);
  }

  const selected = library.find((w) => w.id === selectedId);
  if (selected) push(selected);

  for (const w of library) {
    if (out.length >= TRAY_LIMIT) break;
    push(w);
  }

  return out;
}
