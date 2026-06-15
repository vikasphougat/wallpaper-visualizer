/** Small CDN thumbnail for tray / grid previews (full texture used on wall). */
export function thumbTexture(uri: string, width = 144): string {
  if (!uri.startsWith("http")) return uri;
  if (uri.includes("width=")) return uri;
  const sep = uri.includes("?") ? "&" : "?";
  return `${uri}${sep}width=${width}`;
}
