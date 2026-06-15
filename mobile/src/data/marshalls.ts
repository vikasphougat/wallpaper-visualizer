import type { Wallpaper } from "@/types";

const CDN = "https://cdn.shopify.com/s/files/1/0668/4069/0771/files";

function marshalls(sku: string, file: string, version: string): Wallpaper {
  return {
    id: `marshalls-${sku.toLowerCase().replace(/\s+/g, "-")}`,
    name: `Marshalls ${sku}`,
    texture: `${CDN}/${file}?v=${version}`,
    physicalRepeatCm: [104, 104],
    accent: "#6ea8fe",
    tileable: false,
    source: "Marshalls India",
  };
}

export const MARSHALLS: Wallpaper[] = [
  marshalls("M-RET27", "M-RET27.jpg", "1781101881"),
  marshalls("54524", "54524.jpg", "1781101750"),
  marshalls("31-275", "31-275.jpg", "1781101393"),
  marshalls("30-189", "30-189.jpg", "1781101091"),
  marshalls("CRE 502", "CRE502.jpg", "1781101023"),
  marshalls("55011", "55011.jpg", "1781100877"),
  marshalls("55026", "55026.jpg", "1781100821"),
  marshalls("8804", "8804.jpg", "1781100764"),
  marshalls("8512", "8512.jpg", "1781100668"),
  marshalls("54329-4", "54329-4.jpg", "1781100302"),
  marshalls("54328-3", "54328-3.jpg", "1781100195"),
  marshalls("54323-1", "54323-1.jpg", "1781100122"),
  marshalls("54323-2", "54323-2.jpg", "1781099892"),
  marshalls("54321-3", "54321-3.jpg", "1781099816"),
  marshalls("65309-1", "65309-1.jpg", "1781099762"),
  marshalls("721546", "721546.jpg", "1775729526"),
  marshalls("31-621", "31-621.jpg", "1781101436"),
];
