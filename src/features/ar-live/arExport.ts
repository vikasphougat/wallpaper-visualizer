/** Compose a side-by-side before/after image for customer sharing. */
export async function compositeBeforeAfter(
  beforeDataUrl: string,
  afterDataUrl: string,
  labels = { before: "Before", after: "After" },
): Promise<string> {
  const [before, after] = await Promise.all([loadImg(beforeDataUrl), loadImg(afterDataUrl)]);
  const pad = 16;
  const labelH = 28;
  const w = before.width + after.width + pad * 3;
  const h = Math.max(before.height, after.height) + pad * 2 + labelH;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#0f1115";
  ctx.fillRect(0, 0, w, h);

  const y = pad + labelH;
  ctx.drawImage(before, pad, y, before.width, before.height);
  ctx.drawImage(after, pad * 2 + before.width, y, after.width, after.height);

  ctx.fillStyle = "#fff";
  ctx.font = "600 14px system-ui, sans-serif";
  ctx.fillText(labels.before, pad, pad + 18);
  ctx.fillText(labels.after, pad * 2 + before.width, pad + 18);

  return canvas.toDataURL("image/png");
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}
