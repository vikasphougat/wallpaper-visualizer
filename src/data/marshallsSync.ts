import type { Wallpaper } from "@/types";
import { MARSHALLS } from "./marshalls";

const SHOPIFY = "https://www.marshallsindia.com/products.json";
const CACHE_KEY = "wallviz-marshalls-catalog";
const CACHE_TS_KEY = "wallviz-marshalls-catalog-ts";
const CACHE_TTL_MS = 1000 * 60 * 60 * 12; // 12 h

interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  images: { src: string; width?: number; height?: number }[];
  variants: { sku: string }[];
}

interface ShopifyResponse {
  products: ShopifyProduct[];
}

function skuFrom(product: ShopifyProduct): string {
  const sku = product.variants?.[0]?.sku?.trim();
  if (sku) return sku;
  return product.handle.replace(/^sale-?/i, "") || String(product.id);
}

function toWallpaper(p: ShopifyProduct): Wallpaper | null {
  const img = p.images?.[0]?.src;
  if (!img) return null;
  const sku = skuFrom(p);
  return {
    id: `marshalls-${sku.toLowerCase().replace(/\s+/g, "-")}`,
    name: p.title.replace(/^Sale\((.*)\)$/i, "Marshalls $1").replace(/^Sale/i, "Marshalls"),
    texture: img,
    physicalRepeatCm: [104, 104],
    accent: "#6ea8fe",
    tileable: false,
    source: "Marshalls India",
  };
}

/** Load cached remote catalog (if fresh enough). */
export function loadCachedMarshalls(): Wallpaper[] {
  try {
    const ts = Number(localStorage.getItem(CACHE_TS_KEY) || 0);
    if (Date.now() - ts > CACHE_TTL_MS) return [];
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Wallpaper[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function cacheMarshalls(items: Wallpaper[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(items));
    localStorage.setItem(CACHE_TS_KEY, String(Date.now()));
  } catch {
    /* quota */
  }
}

/**
 * Pull wallpapers from the public Marshalls Shopify feed (paginated).
 * Falls back to the bundled static list when offline or blocked.
 */
export async function fetchMarshallsCatalog(): Promise<Wallpaper[]> {
  const all: Wallpaper[] = [];
  const seen = new Set<string>();
  let page = 1;

  try {
    for (;;) {
      const res = await fetch(`${SHOPIFY}?limit=250&page=${page}`);
      if (!res.ok) break;
      const data = (await res.json()) as ShopifyResponse;
      const batch = data.products ?? [];
      if (!batch.length) break;
      for (const p of batch) {
        const w = toWallpaper(p);
        if (w && !seen.has(w.id)) {
          seen.add(w.id);
          all.push(w);
        }
      }
      if (batch.length < 250) break;
      page++;
      if (page > 20) break; // safety cap
    }
  } catch {
    /* network / CORS in dev — use fallback */
  }

  const result = all.length ? all : MARSHALLS;
  if (all.length) cacheMarshalls(all);
  return result;
}

/** Bundled + cached (no network). */
export function getMarshallsCatalogSync(): Wallpaper[] {
  const cached = loadCachedMarshalls();
  return cached.length ? cached : MARSHALLS;
}
