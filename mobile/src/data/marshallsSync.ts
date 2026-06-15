import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Wallpaper } from "@/types";
import { MARSHALLS } from "./marshalls";

const SHOPIFY = "https://www.marshallsindia.com/products.json";
const CACHE_KEY = "wallviz-marshalls-catalog";
const CACHE_TS_KEY = "wallviz-marshalls-catalog-ts";
const CACHE_TTL_MS = 1000 * 60 * 60 * 12;

interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  images: { src: string }[];
  variants: { sku: string }[];
}

function skuFrom(p: ShopifyProduct): string {
  const sku = p.variants?.[0]?.sku?.trim();
  return sku || p.handle.replace(/^sale-?/i, "") || String(p.id);
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

export async function loadCachedMarshalls(): Promise<Wallpaper[]> {
  try {
    const ts = Number((await AsyncStorage.getItem(CACHE_TS_KEY)) || 0);
    if (Date.now() - ts > CACHE_TTL_MS) return [];
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Wallpaper[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function cacheMarshalls(items: Wallpaper[]) {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(items));
    await AsyncStorage.setItem(CACHE_TS_KEY, String(Date.now()));
  } catch {
    /* quota */
  }
}

export async function fetchMarshallsCatalog(): Promise<Wallpaper[]> {
  const all: Wallpaper[] = [];
  const seen = new Set<string>();
  let page = 1;

  try {
    for (;;) {
      const res = await fetch(`${SHOPIFY}?limit=250&page=${page}`);
      if (!res.ok) break;
      const data = (await res.json()) as { products: ShopifyProduct[] };
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
      if (page > 40) break;
    }
  } catch {
    /* offline */
  }

  const result = all.length ? all : MARSHALLS;
  if (all.length) await cacheMarshalls(all);
  return result;
}

export async function getMarshallsCatalogSync(): Promise<Wallpaper[]> {
  const cached = await loadCachedMarshalls();
  return cached.length ? cached : MARSHALLS;
}
