import type { Wallpaper } from "@/types";
import { MARSHALLS } from "./marshalls";

function svgPattern(inner: string, bg: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">` +
    `<rect width="256" height="256" fill="${bg}"/>${inner}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const stripes = svgPattern(
  `<g fill="#c9a36b"><rect x="0" y="0" width="64" height="256"/><rect x="128" y="0" width="64" height="256"/></g>`,
  "#f3ead7",
);
const grid = svgPattern(
  `<g stroke="#3f5d57" stroke-width="6" fill="none" opacity="0.85"><path d="M0 0H256M0 128H256M0 256H256"/><path d="M0 0V256M128 0V256M256 0V256"/></g>`,
  "#eef3f1",
);
const polka = svgPattern(
  `<g fill="#d7607a"><circle cx="64" cy="64" r="26"/><circle cx="192" cy="192" r="26"/><circle cx="192" cy="64" r="14"/><circle cx="64" cy="192" r="14"/></g>`,
  "#fbeef1",
);
const chevron = svgPattern(
  `<g fill="none" stroke="#2f4858" stroke-width="14"><path d="M-16 96 L64 32 L144 96 L224 32 L304 96"/><path d="M-16 224 L64 160 L144 224 L224 160 L304 224"/></g>`,
  "#e9eef2",
);
const botanical = svgPattern(
  `<g fill="#5a7d4f" opacity="0.9"><path d="M64 24 C48 64 48 96 64 128 C80 96 80 64 64 24 Z"/><path d="M192 152 C176 192 176 224 192 256 C208 224 208 192 192 152 Z"/></g><g stroke="#8aa97f" stroke-width="4" fill="none"><path d="M64 24 V160"/><path d="M192 152 V256"/></g>`,
  "#eef3ea",
);

export const PATTERNS: Wallpaper[] = [
  { id: "stripes", name: "Heritage Stripe", texture: stripes, physicalRepeatCm: [53, 53], accent: "#c9a36b", tileable: true },
  { id: "grid", name: "Sage Grid", texture: grid, physicalRepeatCm: [53, 53], accent: "#3f5d57", tileable: true },
  { id: "polka", name: "Rose Dot", texture: polka, physicalRepeatCm: [53, 53], accent: "#d7607a", tileable: true },
  { id: "chevron", name: "Slate Chevron", texture: chevron, physicalRepeatCm: [53, 64], accent: "#2f4858", tileable: true },
  { id: "botanical", name: "Botanical Leaf", texture: botanical, physicalRepeatCm: [53, 64], accent: "#5a7d4f", tileable: true },
];

export const CATALOG: Wallpaper[] = [...PATTERNS, ...MARSHALLS];
export const DEFAULT_WALLPAPER = CATALOG[0];
